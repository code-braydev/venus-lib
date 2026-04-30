# Changelog

All notable changes to this project will be documented in this file.

## [2.0.1] - 2026-04-30

### Fixed:

Resolved a "Named Export" resolution error in production environments where getRss was inaccessible to modern ESM-first frameworks like Astro 5.

### Added:

Full ESM support by implementing `"type": "module"` and a comprehensive exports map in package.json.

### Changed:

Standardized output extensions to .js for ESM and .cjs for CommonJS to guarantee cross-environment stability.

### Improved:

Optimized build workflow using tsup, incorporating the --clean flag to ensure a pristine dist directory and prevent artifact persistence.

## [2.0.0] - 2026-04-18

### Added

- **Unified Request API:** Single interface for `get`, `send`, `update`, `updateOnly`, and `remove`.
- **Advanced Engine:** Full support for `timeout` and `AbortSignal`.
- **RSS/Atom Helper:** New `getRss` function with `strict` and `lenient` parsing modes.
- **Multi-format Parsing:** Support for `json`, `text`, `blob`, `formData`, and `arrayBuffer`.
- **Resilience:** Built-in retry policy with configurable backoff for transient failures.
- **Smart Serialization:** Query params support for arrays, objects, and multiple formats.
- **Lifecycle Hooks:** Added `beforeRequest` and `afterResponse` middlewares.
- **Metadata:** Typed responses including `errorCode` and optional `status`.

### Changed

- **Response Contract:** Normalized success and error handling across all methods.
- **Documentation:** Major README update with production examples for Frontend and Backend.

### Fixed

- **HTTP 204/205:** Improved handling of "No Content" responses.
- **Feed Normalization:** Better resilience for malformed XML and Atom item links.

### Breaking Changes

- **Signature Change:** HTTP methods now accept a unified **options object** instead of mixed positional arguments.
- **Response Structure:** Data is now wrapped in a contract that includes `errorCode`.

### Migration Notes

- Replace old positional arguments: `client.get(url, headers)` -> `client.get({ url, headers })`.

---

## [1.0.4] - 2026-02-14

- **Fixed:** Minor internal bug fixes and connection stability improvements.

## [1.0.2] - 2026-02-08

- **Changed:** Documentation and README structure improvements.

## [1.0.1] - 2026-02-06

- **Changed:** Initial README adjustments and project description.

## [1.0.0] - 2026-02-05

- **Initial Release:** Basic HTTPS wrapper for API requests.
