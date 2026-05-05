let globalBaseURL = "";
let globalHeaders: Record<string, string> = {};

/**
 * Venus Configuration Manager
 * Handles global settings like Base URL for all network requests.
 */
export const venusConfig = {
  /**
   * Sets the global base URL (e.g., https://api.braydev.xyz).
   * It automatically handles trailing slashes for consistency.
   */
  setBaseURL: (url: string) => {
    // Optimization: Ensures the URL is clean to avoid redundant slashes
    globalBaseURL = url.endsWith("/") ? url.slice(0, -1) : url;
  },

  /**
   * Returns the current global base URL.
   * Internal use only.
   */
  getBaseURL: () => globalBaseURL,
  /**
   * Set global headers to be applied to every request.
   * Accepts a plain object of header entries.
   */
  setGlobalHeaders: (headers: Record<string, string>) => {
    globalHeaders = { ...(headers || {}) };
  },

  /**
   * Returns the current global headers as a plain object.
   */
  getGlobalHeaders: (): Record<string, string> => ({ ...globalHeaders }),
};
