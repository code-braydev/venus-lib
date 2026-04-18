import { request } from "../core/request";
import { VenusOptions, VenusResponse } from "../core/types";

/**
 * Performs a POST request with payload validation and detailed server feedback.
 * Includes a pre-flight check to prevent unnecessary network overhead for empty bodies.
 * * @param path - The target endpoint or absolute URL.
 * @param body - The data payload to be serialized and sent.
 * @param options - Unified Venus options (headers, timeout, signal, params, parser, retry, hooks).
 */
export const send = async <T>(
  path: string,
  body: unknown,
  options: VenusOptions = {},
): Promise<VenusResponse<T>> => {
  /**
   * Pre-fetch Validation:
   * Prevents sending requests with null or empty objects, saving client-side
   * resources and avoiding predictable 400 Bad Request responses from the server.
   */
  if (!body || (typeof body === "object" && Object.keys(body).length === 0)) {
    return {
      data: null,
      ok: false,
      status: 400,
      errorCode: "INVALID_BODY",
      error: "Venus: Cannot send an empty body.",
    };
  }

  const preparedBody =
    typeof body === "string" || body instanceof FormData || body instanceof Blob
      ? body
      : JSON.stringify(body);

  const response = await request<T>(path, {
    ...options,
    method: "POST",
    body: preparedBody,
  });

  if (!response.ok) {
    const serverMessage =
      (response.data as { message?: string } | null)?.message || response.error;
    return {
      ...response,
      error: serverMessage ? `Venus: ${serverMessage}` : response.error,
    };
  }

  return response;
};
