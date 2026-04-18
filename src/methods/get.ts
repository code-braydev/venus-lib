import { request } from "../core/request";
import { VenusOptions, VenusResponse } from "../core/types";

/**
 * Performs a GET request.
 * @param path - The endpoint or absolute URL to fetch.
 * @param options - Unified Venus options (headers, timeout, signal, params, parser, retry, hooks).
 */
export const get = async <T>(
  path: string,
  options: VenusOptions = {},
): Promise<VenusResponse<T>> => {
  return request<T>(path, {
    ...options,
    method: "GET",
  });
};
