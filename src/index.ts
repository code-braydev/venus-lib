/**
 * Venus: A minimalist, type-safe network tool.
 * Designed by code-braydev.
 */

// Export core logic and configuration
export * from "./core/types";
export { venusConfig } from "./utils/config";

// Export primary network methods
export { get } from "./methods/get";
export { getRss } from "./methods/rss";
export { send } from "./methods/send";
export { remove } from "./methods/remove";
export { update, updateOnly } from "./methods/update";
