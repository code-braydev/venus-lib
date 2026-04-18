import {
  ParamsArrayFormat,
  VenusErrorCode,
  VenusOptions,
  VenusResponse,
  VenusResponseType,
  VenusRetryOptions,
} from "./types";
import { venusConfig } from "../utils/config";

const DEFAULT_RETRY_STATUS = [408, 429, 500, 502, 503, 504];

type ParsedRetry = Required<
  Pick<VenusRetryOptions, "attempts" | "backoffMs" | "maxBackoffMs">
> &
  Pick<VenusRetryOptions, "retryOn" | "shouldRetry">;

type RequestBuildResult = {
  fetchOptions: RequestInit;
  clearTimeout?: () => void;
  timeoutTriggered: () => boolean;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function appendArray(
  search: URLSearchParams,
  key: string,
  values: unknown[],
  format: ParamsArrayFormat,
) {
  if (format === "comma") {
    search.append(key, values.map(String).join(","));
    return;
  }

  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value == null) {
      continue;
    }

    if (format === "brackets") {
      search.append(`${key}[]`, String(value));
      continue;
    }

    if (format === "indices") {
      search.append(`${key}[${i}]`, String(value));
      continue;
    }

    search.append(key, String(value));
  }
}

function serializeParams(
  params: VenusOptions["params"] | undefined,
  format: ParamsArrayFormat,
): string {
  if (!params) {
    return "";
  }

  const search = new URLSearchParams();

  const visit = (key: string, value: unknown) => {
    if (value == null) {
      return;
    }

    if (value instanceof Date) {
      search.append(key, value.toISOString());
      return;
    }

    if (Array.isArray(value)) {
      appendArray(search, key, value, format);
      return;
    }

    if (isPlainObject(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        visit(`${key}.${nestedKey}`, nestedValue);
      }
      return;
    }

    search.append(key, String(value));
  };

  for (const [key, value] of Object.entries(params)) {
    visit(key, value);
  }

  return search.toString();
}

function composeUrl(path: string, options: VenusOptions): string {
  const baseUrl = options.baseUrl ?? venusConfig.getBaseURL();
  const rootUrl = path.startsWith("http")
    ? path
    : `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const query = serializeParams(
    options.params,
    options.paramsArrayFormat ?? "repeat",
  );
  if (!query) {
    return rootUrl;
  }

  const separator = rootUrl.includes("?") ? "&" : "?";
  return `${rootUrl}${separator}${query}`;
}

function normalizeRetryConfig(
  retry: VenusOptions["retry"],
): ParsedRetry | null {
  if (!retry) {
    return null;
  }

  if (retry === true) {
    return {
      attempts: 2,
      backoffMs: 200,
      maxBackoffMs: 2_000,
      retryOn: DEFAULT_RETRY_STATUS,
      shouldRetry: undefined,
    };
  }

  if (typeof retry === "number") {
    return {
      attempts: Math.max(0, retry),
      backoffMs: 200,
      maxBackoffMs: 2_000,
      retryOn: DEFAULT_RETRY_STATUS,
      shouldRetry: undefined,
    };
  }

  return {
    attempts: Math.max(0, retry.attempts ?? 2),
    backoffMs: Math.max(0, retry.backoffMs ?? 200),
    maxBackoffMs: Math.max(0, retry.maxBackoffMs ?? 2_000),
    retryOn: retry.retryOn ?? DEFAULT_RETRY_STATUS,
    shouldRetry: retry.shouldRetry,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getAbortErrorCode(
  externalSignal: AbortSignal | null,
  timeoutTriggered: boolean,
): { code: VenusErrorCode; status: number; message: string } {
  if (externalSignal?.aborted) {
    return {
      code: "ABORTED",
      status: 499,
      message: "Venus: Request was aborted.",
    };
  }

  if (timeoutTriggered) {
    return {
      code: "TIMEOUT",
      status: 408,
      message: "Venus: Request timed out.",
    };
  }

  return {
    code: "ABORTED",
    status: 499,
    message: "Venus: Request was aborted.",
  };
}

function buildFetchOptions(options: VenusOptions): RequestBuildResult {
  const {
    responseType: _responseType,
    timeout,
    params: _params,
    paramsArrayFormat: _paramsArrayFormat,
    retry: _retry,
    hooks: _hooks,
    onTelemetry: _onTelemetry,
    baseUrl: _baseUrl,
    signal,
    headers: rawHeaders,
    ...rest
  } = options;

  const headers = new Headers(rawHeaders);
  const hasBody = rest.body !== undefined && rest.body !== null;

  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  let didTimeout = false;
  let timeoutController: AbortController | null = null;

  if (typeof timeout === "number" && timeout > 0) {
    timeoutController = new AbortController();
    timer = setTimeout(() => {
      didTimeout = true;
      timeoutController?.abort();
    }, timeout);
  }

  let externalAbortListener: (() => void) | undefined;
  const signalController = new AbortController();

  if (signal?.aborted) {
    signalController.abort();
  }

  if (timeoutController?.signal.aborted) {
    signalController.abort();
  }

  const syncAbort = () => {
    if (signal?.aborted || timeoutController?.signal.aborted) {
      signalController.abort();
    }
  };

  if (signal) {
    externalAbortListener = () => syncAbort();
    signal.addEventListener("abort", externalAbortListener, { once: true });
  }

  if (timeoutController) {
    timeoutController.signal.addEventListener("abort", () => syncAbort(), {
      once: true,
    });
  }

  return {
    fetchOptions: {
      ...rest,
      headers,
      signal: signalController.signal,
    },
    clearTimeout: () => {
      if (timer) {
        clearTimeout(timer);
      }
      if (signal && externalAbortListener) {
        signal.removeEventListener("abort", externalAbortListener);
      }
    },
    timeoutTriggered: () => didTimeout,
  };
}

function statusError<T>(status: number, statusText: string): VenusResponse<T> {
  return {
    data: null,
    ok: false,
    status,
    errorCode: "HTTP_ERROR",
    error: `Error ${status}: ${statusText}`,
  };
}

async function parseResponse<T>(
  response: Response,
  responseType: VenusResponseType,
): Promise<VenusResponse<T>> {
  if (response.status === 204 || response.status === 205) {
    return {
      data: null,
      ok: response.ok,
      status: response.status,
      errorCode: response.ok ? null : "HTTP_ERROR",
      error: response.ok
        ? null
        : `Error ${response.status}: ${response.statusText}`,
    };
  }

  const contentType = response.headers.get("content-type") || "";
  const expectsJson =
    responseType === "json" ||
    (responseType === "auto" &&
      (contentType.includes("application/json") ||
        contentType.includes("+json")));

  try {
    let data: unknown;

    if (expectsJson) {
      const raw = await response.text();
      data = raw.trim() ? JSON.parse(raw) : null;
    } else if (responseType === "blob") {
      data = await response.blob();
    } else if (responseType === "formData") {
      data = await response.formData();
    } else if (responseType === "arrayBuffer") {
      data = await response.arrayBuffer();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const baseError = statusError<T>(response.status, response.statusText);
      return {
        ...baseError,
        data: data as T,
      };
    }

    return {
      data: data as T,
      ok: true,
      status: response.status,
      errorCode: null,
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      ok: false,
      status: response.status,
      errorCode: "PARSING_ERROR",
      error:
        err instanceof Error
          ? `Venus: Response parsing failed. ${err.message}`
          : "Venus: Response parsing failed.",
    };
  }
}

function shouldRetry(
  retry: ParsedRetry | null,
  attempt: number,
  status: number | undefined,
  errorCode: VenusErrorCode | null,
): boolean {
  if (!retry || attempt > retry.attempts) {
    return false;
  }

  if (retry.shouldRetry) {
    return retry.shouldRetry({
      attempt,
      status,
      errorCode: errorCode ?? undefined,
    });
  }

  if (errorCode === "NETWORK_ERROR" || errorCode === "TIMEOUT") {
    return true;
  }

  if (status && retry.retryOn?.includes(status)) {
    return true;
  }

  return false;
}

/**
 * Core request engine for Venus.
 * Handles URL assembly, header injection, and multi-format response parsing.
 */
export async function request<T>(
  path: string,
  options: VenusOptions = {},
): Promise<VenusResponse<T>> {
  const responseType = options.responseType ?? "auto";
  const retry = normalizeRetryConfig(options.retry);
  const method = options.method ?? "GET";
  const url = composeUrl(path, options);
  const externalSignal = options.signal ?? null;

  for (let attempt = 0; ; attempt += 1) {
    const build = buildFetchOptions(options);
    let fetchOptions = build.fetchOptions;

    if (options.hooks?.beforeRequest) {
      const maybeOverride = await options.hooks.beforeRequest({
        url,
        options: fetchOptions,
        attempt,
      });
      if (maybeOverride) {
        fetchOptions = maybeOverride;
      }
    }

    const startedAt = Date.now();

    try {
      const response = await fetch(url, fetchOptions);

      if (options.hooks?.afterResponse) {
        await options.hooks.afterResponse({
          url,
          options: fetchOptions,
          response,
          durationMs: Date.now() - startedAt,
          attempt,
        });
      }

      const parsed = await parseResponse<T>(response, responseType);

      options.onTelemetry?.({
        url,
        method,
        ok: parsed.ok,
        status: parsed.status,
        durationMs: Date.now() - startedAt,
        attempt,
        errorCode: parsed.errorCode,
      });

      build.clearTimeout?.();

      if (!shouldRetry(retry, attempt + 1, parsed.status, parsed.errorCode)) {
        return parsed;
      }
    } catch (err) {
      build.clearTimeout?.();

      const isAbort =
        err instanceof DOMException
          ? err.name === "AbortError"
          : err instanceof Error && err.name === "AbortError";

      if (isAbort) {
        const abortInfo = getAbortErrorCode(
          externalSignal,
          build.timeoutTriggered(),
        );
        const abortResponse: VenusResponse<T> = {
          data: null,
          ok: false,
          status: abortInfo.status,
          errorCode: abortInfo.code,
          error: abortInfo.message,
        };

        options.onTelemetry?.({
          url,
          method,
          ok: false,
          status: abortResponse.status,
          durationMs: Date.now() - startedAt,
          attempt,
          errorCode: abortResponse.errorCode,
        });

        if (abortInfo.code === "ABORTED") {
          return abortResponse;
        }

        if (
          !shouldRetry(
            retry,
            attempt + 1,
            abortResponse.status,
            abortResponse.errorCode,
          )
        ) {
          return abortResponse;
        }
      } else {
        const networkResponse: VenusResponse<T> = {
          data: null,
          ok: false,
          status: 0,
          errorCode: "NETWORK_ERROR",
          error:
            err instanceof Error
              ? `Venus: Network error. ${err.message}`
              : "Venus: Network error.",
        };

        options.onTelemetry?.({
          url,
          method,
          ok: false,
          status: networkResponse.status,
          durationMs: Date.now() - startedAt,
          attempt,
          errorCode: networkResponse.errorCode,
        });

        if (
          !shouldRetry(
            retry,
            attempt + 1,
            networkResponse.status,
            networkResponse.errorCode,
          )
        ) {
          return networkResponse;
        }
      }
    }

    if (!retry) {
      return {
        data: null,
        ok: false,
        status: 500,
        errorCode: "UNKNOWN_ERROR",
        error: "Venus: Unexpected request state.",
      };
    }

    const backoff = Math.min(
      retry.backoffMs * 2 ** attempt,
      retry.maxBackoffMs,
    );
    if (backoff > 0) {
      await delay(backoff);
    }

    if (attempt + 1 > retry.attempts) {
      return {
        data: null,
        ok: false,
        status: 503,
        errorCode: "RETRY_EXHAUSTED",
        error: "Venus: Retry attempts exhausted.",
      };
    }
  }
}
