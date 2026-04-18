import { request } from "../core/request";
import { VenusOptions, VenusResponse } from "../core/types";

/**
 * Performs a DELETE request to remove a specific resource.
 * Optimized to handle '204 No Content' success states and server-side error extraction.
 * * @param path - The endpoint or absolute URL of the resource to be deleted.
 * @param options - Unified Venus options (headers, timeout, signal, params, parser, retry, hooks).
 */
export const remove = async <T>(
  path: string,
  options: VenusOptions = {},
): Promise<VenusResponse<T>> => {
  const response = await request<T>(path, {
    ...options,
    method: "DELETE",
  });

  /**
   * Success Handling: HTTP 204 (No Content)
   * Common in RESTful APIs where a successful deletion does not return a body.
   * We explicitly mark this as successful and clear any residual errors.
   */
  if (response.status === 204) {
    return {
      ...response,
      ok: true,
      data: null,
      errorCode: null,
      error: null,
    };
  }

  /**
   * Error Normalization: Handle Server-Side Rejection (4xx or 5xx)
   * Attempts to extract a readable message from the backend (e.g., JSON response with { message: "..." })
   * Fallback to the standard status text if no specific error body is provided.
   */
  if (!response.ok) {
    const serverMessage =
      (response.data as { message?: string } | null)?.message || response.error;

    return {
      ...response,
      error: serverMessage
        ? `Venus: Delete operation failed. ${serverMessage}`
        : response.error,
    };
  }

  return response;
};
