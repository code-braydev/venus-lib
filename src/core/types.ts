/**
 * Standard response structure for all Venus operations.
 * @template T - The expected data shape (e.g., User, News, etc.)
 */
export type VenusResponse<T> = {
  /** The parsed JSON data from the server or null if an error occurred. */
  data: T | null;
  /** A descriptive error message, either from Venus or the server. */
  error: string | null;
  /** Boolean flag indicating if the request was successful (status 200-299). */
  ok: boolean;
  /** The HTTP status code returned by the server, when available. */
  status?: number;
  /** Stable Venus error code for retry, telemetry and UI decisions. */
  errorCode: VenusErrorCode | null;
};

/**
 * Stable internal error codes returned by Venus.
 */
export type VenusErrorCode =
  | "HTTP_ERROR"
  | "TIMEOUT"
  | "ABORTED"
  | "NETWORK_ERROR"
  | "PARSING_ERROR"
  | "INVALID_BODY"
  | "RETRY_EXHAUSTED"
  | "UNKNOWN_ERROR";

/**
 * Output parser strategy for response bodies.
 */
export type VenusResponseType =
  | "json"
  | "text"
  | "blob"
  | "formData"
  | "arrayBuffer"
  | "auto";

type PrimitiveParam = string | number | boolean;
type QueryValue =
  | PrimitiveParam
  | PrimitiveParam[]
  | Date
  | null
  | undefined
  | { [key: string]: QueryValue };

/**
 * Query params accepted by Venus.
 */
export type VenusQueryParams = Record<string, QueryValue>;

/**
 * Strategy used when serializing array query params.
 */
export type ParamsArrayFormat = "repeat" | "comma" | "brackets" | "indices";

/**
 * Retry options for transient failures.
 */
export interface VenusRetryOptions {
  /** Number of retries after the first attempt. */
  attempts?: number;
  /** Initial backoff in milliseconds. */
  backoffMs?: number;
  /** Max backoff in milliseconds. */
  maxBackoffMs?: number;
  /** Status codes considered retryable. */
  retryOn?: number[];
  /** Optional custom retry decision. */
  shouldRetry?: (context: {
    attempt: number;
    status?: number;
    errorCode?: VenusErrorCode;
  }) => boolean;
}

/**
 * Telemetry event emitted once each request resolves.
 */
export interface VenusTelemetryEvent {
  url: string;
  method: string;
  ok: boolean;
  status?: number;
  durationMs: number;
  attempt: number;
  errorCode: VenusErrorCode | null;
}

/**
 * Request hooks to enable auth, logging, tracing or instrumentation.
 */
export interface VenusHooks {
  beforeRequest?: (context: {
    url: string;
    options: RequestInit;
    attempt: number;
  }) => void | RequestInit | Promise<void | RequestInit>;
  afterResponse?: (context: {
    url: string;
    options: RequestInit;
    response: Response;
    durationMs: number;
    attempt: number;
  }) => void | Promise<void>;
}

/**
 * Internal configuration for network requests.
 * Extends RequestInit for compatibility with fetch.
 */
export interface VenusOptions extends RequestInit {
  /** Optional base URL to avoid repeating full paths in every call. */
  baseUrl?: string;
  /** Desired parser for response body; auto uses headers/content sniffing. */
  responseType?: VenusResponseType;
  /** Request timeout in milliseconds. */
  timeout?: number;
  /** Query params to append to the URL. */
  params?: VenusQueryParams;
  /** Array serialization format for query params. */
  paramsArrayFormat?: ParamsArrayFormat;
  /** Retry policy, disabled by default. */
  retry?: boolean | number | VenusRetryOptions;
  /** Lightweight request/response hooks. */
  hooks?: VenusHooks;
  /** Optional telemetry callback. */
  onTelemetry?: (event: VenusTelemetryEvent) => void;
}

/**
 * Utility type to infer payload data from a VenusResponse.
 */
export type InferData<T extends VenusResponse<unknown>> = T["data"];

/**
 * Normalized error shape for non-success responses.
 */
export type VenusNormalizedError = Pick<
  VenusResponse<never>,
  "ok" | "status" | "error" | "errorCode"
>;

/**
 * Parsed RSS/Atom item returned by Venus RSS helpers.
 */
export interface VenusRssItem {
  title: string;
  link?: string;
  description?: string;
  content?: string;
  pubDate?: string;
  guid?: string;
  author?: string;
  categories?: string[];
}

/**
 * Parsed RSS/Atom feed returned by Venus RSS helpers.
 */
export interface VenusRssFeed {
  sourceType: "rss" | "atom";
  title: string;
  description?: string;
  link?: string;
  language?: string;
  updatedAt?: string;
  image?: string;
  items: VenusRssItem[];
}

/**
 * Parsing strictness for RSS/Atom feeds.
 */
export type VenusRssMode = "strict" | "lenient";

/**
 * Options accepted by the RSS helper.
 */
export interface VenusRssOptions extends VenusOptions {
  /**
   * strict: fail when the XML is not valid RSS/Atom
   * lenient: best-effort normalization for non-standard feeds
   */
  rssMode?: VenusRssMode;
}
