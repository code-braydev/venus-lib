# Changelog

All notable changes to this project will be documented in this file.

## 2.0.0 - 2026-04-18

### Added

- Unified request API across get, send, update, updateOnly and remove.
- Full timeout and AbortSignal support in the core request engine.
- RSS helper via getRss with strict and lenient parsing modes.
- Multi-format response parsing: json, text, blob, formData and arrayBuffer.
- Typed response metadata with errorCode and optional status.
- Retry policy with backoff for transient failures.
- Query params serialization with support for arrays, objects and multiple formats.
- Lightweight hooks for beforeRequest and afterResponse.
- Frontend and backend usage examples for RSS consumption.

### Changed

- Request responses now use a normalized contract for success and error cases.
- RSS parsing was separated into strict and lenient modes for better control.
- Documentation was expanded to explain production usage and migration paths.

### Fixed

- Improved handling of 204/205 responses.
- Improved normalization of RSS and Atom item links.
- Better resilience for malformed or partial XML feeds in lenient mode.

### Breaking Changes

- HTTP methods now accept a unified options object instead of mixed positional arguments.
- The response type now includes errorCode and an optional status field.
- RSS helper uses rssMode to avoid conflicts with RequestInit.mode.

### Migration Notes

- Replace old positional method signatures with the new options-based API.
- Use rssMode: "strict" for standards-compliant feeds and rssMode: "lenient" for custom XML.
- Update any response handling to read errorCode when branching on failures.

## 1.3.0 - 2026-04-18

### Added

- New RSS helper: getRss(path, options) for RSS/Atom feeds.
- RSS parsing modes:
  - strict (default): requires valid RSS/Atom XML structure.
  - lenient: best-effort parsing for non-standard XML feeds.
- Typed RSS models: VenusRssFeed, VenusRssItem, VenusRssOptions.
- Frontend and backend RSS usage examples in README.

### Changed

- README documentation expanded with RSS modes and practical integration examples.

### Fixed

- Improved feed normalization for Atom links and mixed XML content.

## 1.2.0 - 2026-04-18

### Added

- Unified request options across methods.
- Rich error model with stable errorCode.
- Configurable retry with backoff.
- Smart parser control and robust query serialization.
