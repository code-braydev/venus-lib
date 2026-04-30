import { request } from "../core/request.js";
import { VenusOptions, VenusResponse } from "../core/types.js";

/**
 * Shared logic for update operations to ensure body consistency and detailed error capturing.
 * This helper unifies the processing for both PUT and PATCH methods.
 */
async function performUpdate<T>(
  path: string,
  method: "PUT" | "PATCH",
  body: unknown,
  options: VenusOptions = {},
): Promise<VenusResponse<T>> {
  /**
   * Pre-flight Check:
   * Ensures the payload is not empty to save bandwidth and prevent the server
   * from processing invalid update requests.
   */
  if (!body || (typeof body === "object" && Object.keys(body).length === 0)) {
    return {
      data: null,
      ok: false,
      status: 400,
      errorCode: "INVALID_BODY",
      error: `Venus: ${method} requires a non-empty body.`,
    };
  }

  const preparedBody =
    typeof body === "string" || body instanceof FormData || body instanceof Blob
      ? body
      : JSON.stringify(body);

  const response = await request<T>(path, {
    ...options,
    method,
    body: preparedBody,
  });

  if (!response.ok) {
    const serverMessage =
      (response.data as { message?: string } | null)?.message || response.error;
    return {
      ...response,
      error: serverMessage
        ? `Venus: Update failed. ${serverMessage}`
        : response.error,
    };
  }

  return response;
}

/**
 * Performs a full resource replacement using HTTP PUT.
 * Use this when you want to overwrite an entire object with a complete new data set.
 * * @param path - The endpoint or absolute URL of the resource.
 * @param body - The complete data object to replace the resource.
 * @param options - Unified Venus options (headers, timeout, signal, params, parser, retry, hooks).
 * @returns A promise with the standardized VenusResponse.
 */
export const update = async <T>(
  path: string,
  body: unknown,
  options: VenusOptions = {},
): Promise<VenusResponse<T>> => {
  return performUpdate<T>(path, "PUT", body, options);
};

/**
 * Performs a partial resource modification using HTTP PATCH.
 * Use this to update specific fields without affecting the rest of the object.
 * * @param path - The endpoint or absolute URL of the resource.
 * @param body - An object containing only the fields you wish to change.
 * @param options - Unified Venus options (headers, timeout, signal, params, parser, retry, hooks).
 * @returns A promise with the standardized VenusResponse.
 */
export const updateOnly = async <T>(
  path: string,
  body: unknown,
  options: VenusOptions = {},
): Promise<VenusResponse<T>> => {
  return performUpdate<T>(path, "PATCH", body, options);
};
