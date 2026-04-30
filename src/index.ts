/**
 * Venus: A minimalist, type-safe network tool.
 * Designed by code-braydev.
 */

// Export core logic and configuration
export * from "./core/types.js";
export { venusConfig } from "./utils/config.js";

// Export primary network methods
export { get } from "./methods/get.js";
export { getRss } from "./methods/rss.js";
export { send } from "./methods/send.js";
export { remove } from "./methods/remove.js";
export { update, updateOnly } from "./methods/update.js";
