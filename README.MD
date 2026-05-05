# 🪐 Venus

### 🚀 New in v2.0.0

- **Smart Parsing**: Automatically detects if the response is JSON or Text (perfect for RSS/XML).
- **Multi-Format Support**: Added support for `blob`, `formData`, and `arrayBuffer`.
- **Query Params**: New `params` option to handle URL query strings safely.
- **Enhanced DX**: Full JSDoc documentation for better IntelliSense in VS Code.

### 🚀 v2.0.0 Improvements

- **Unified API options** across all methods: `headers`, `timeout`, `signal`, `params`, `responseType`, `retry`.
- **Richer error contract** with `errorCode` and optional `status`.
- **Configurable retry policy** with backoff for transient failures (408, 429, 5xx).
- **Lightweight hooks**: `beforeRequest` and `afterResponse`.
- **RSS/Atom helper** with normalized feed parsing via `getRss`.
- **RSS modes**: `strict` (default) and `lenient` for non-standard XML feeds.

### Networking, without the friction.

Venus is a modern, lightweight networking library for JavaScript and TypeScript that makes working with APIs feel effortless.

No bloated configs.  
No fragile patterns.  
No surprises.

Venus turns network requests into a **calm, predictable experience** by refining `fetch` into a clean, type-safe, and resilient API. You focus on your app — Venus handles the edge cases.

## ✨ Why Venus?

- **Clean syntax** that stays out of your way
- **Type-safe by default**, from request to response
- **Built-in resilience** (timeouts, predictable errors)
- **Consistent results**, no matter how a request fails
- **Zero dependencies**, powered by native Web APIs

Venus doesn’t try to do everything.  
It does one thing **exceptionally well**:  
making network requests simple, elegant, and reliable.

---

## 🚀 Quick Start

Get up and running with Venus in minutes.

### 1. Configure the base URL

Set your API base URL once at your app’s entry point (e.g. `main.ts` or `index.ts`).

```ts
import { venusConfig } from "@braydev/venus";

venusConfig.setBaseURL("https://api.yourdomain.com");
```

### 1.1 Configure global headers

You can set headers that apply to every request made with Venus (useful for auth tokens, tracing headers, etc.). Per-request headers override these global headers.

```ts
import { venusConfig } from "@braydev/venus";

venusConfig.setBaseURL("https://api.yourdomain.com");

venusConfig.setGlobalHeaders({
  Authorization: "Bearer my-token",
  "X-App-Version": "2.1.0",
});

// You can later read them back (returns a plain object)
const current = venusConfig.getGlobalHeaders();
```

### 2. Make your first request

Venus always returns a predictable response object — no `try/catch` required.

```ts
import { get, getRss, send } from "@braydev/venus";

// Fetching data
const { data, ok, error, errorCode } = await get<User>("/profile", {
  timeout: 8000,
  params: { include: ["roles", "permissions"] },
  paramsArrayFormat: "repeat",
});

if (ok) {
  console.log(data.name);
} else {
  console.error(errorCode, error);
}

// Sending data
const newUser = { name: "Brayan", role: "Developer" };
const result = await send("/users", newUser, {
  timeout: 10000,
  retry: {
    attempts: 2,
    backoffMs: 200,
  },
});

// Fetching and parsing RSS/Atom feed
const feedResult = await getRss("https://hnrss.org/frontpage", {
  timeout: 8000,
  retry: true,
  rssMode: "strict",
});

if (feedResult.ok) {
  console.log(feedResult.data.title);
  console.log(feedResult.data.items[0]?.title);
}

// --- New in v1.2.0: Powerful Query Params & Smart Parsing ---

// Effortless filtering with the 'params' option
const { data: news } = await get("/latest", {
  params: { category: "tech", limit: 5 },
  responseType: "auto",
});

/**
 * Smart Response Detection:
 * Venus automatically detects if 'news' should be a JavaScript Object (JSON)
 * or a raw String (RSS/XML/HTML). No extra configuration required.
 */
if (typeof news === "string") {
  console.log("RSS/XML content detected:", news);
} else {
  console.log("JSON API object detected:", news);
}
```

That’s it.
No boilerplate. No guesswork. Just clean network calls.

---

## 📦 API Methods

| Method       | Function                              | Description                                           |
| :----------- | :------------------------------------ | :---------------------------------------------------- |
| `get`        | `get<T>(path, options?)`              | Fetch resources with parser/timeout/retry controls.   |
| `getRss`     | `getRss(path, options?)`              | Fetch and parse RSS/Atom feeds to normalized objects. |
| `send`       | `send<T>(path, body, options?)`       | Create resources (POST) with validated body.          |
| `update`     | `update<T>(path, body, options?)`     | Replace resources entirely (PUT).                     |
| `updateOnly` | `updateOnly<T>(path, body, options?)` | Update resources partially (PATCH).                   |
| `remove`     | `remove<T>(path, options?)`           | Delete resources with 204 handling.                   |

### Response Contract

```ts
type VenusResponse<T> = {
  data: T | null;
  ok: boolean;
  error: string | null;
  status?: number;
  errorCode:
    | "HTTP_ERROR"
    | "TIMEOUT"
    | "ABORTED"
    | "NETWORK_ERROR"
    | "PARSING_ERROR"
    | "INVALID_BODY"
    | "RETRY_EXHAUSTED"
    | "UNKNOWN_ERROR"
    | null;
};
```

### Common Options

```ts
{
  headers?: HeadersInit;
  timeout?: number;
  signal?: AbortSignal;
  params?: Record<string, unknown>;
  paramsArrayFormat?: "repeat" | "comma" | "brackets" | "indices";
  responseType?: "auto" | "json" | "text" | "blob" | "formData" | "arrayBuffer";
  retry?: boolean | number | {
    attempts?: number;
    backoffMs?: number;
    maxBackoffMs?: number;
    retryOn?: number[];
  };
  hooks?: {
    beforeRequest?: (ctx) => void | RequestInit | Promise<void | RequestInit>;
    afterResponse?: (ctx) => void | Promise<void>;
  };
}
```

### RSS and Atom

Venus can consume feeds without manual XML parsing:

```ts
import { getRss } from "@braydev/venus";

const feed = await getRss("https://example.com/rss.xml", {
  timeout: 7000,
  rssMode: "strict", // strict | lenient
});

if (feed.ok) {
  for (const item of feed.data.items) {
    console.log(item.title, item.link);
  }
}
```

### RSS Modes

- `strict` (default): fails if XML is not valid RSS/Atom structure.
- `lenient`: does best-effort normalization for custom/non-standard XML feeds.

```ts
const strictFeed = await getRss("https://example.com/feed.xml", {
  rssMode: "strict",
});

const lenientFeed = await getRss("https://example.com/custom-xml", {
  rssMode: "lenient",
});
```

### Frontend Example (SPA)

```ts
import { getRss } from "@braydev/venus";

export async function loadNews() {
  const result = await getRss("https://hnrss.org/frontpage", {
    timeout: 6000,
    retry: true,
    rssMode: "strict",
  });

  if (!result.ok) {
    throw new Error(result.error ?? "Feed error");
  }

  return result.data.items.slice(0, 10);
}
```

### Backend Example (Node/SSR)

```ts
import { getRss } from "@braydev/venus";

export async function fetchTechFeed() {
  const result = await getRss("https://example.com/custom-feed", {
    timeout: 8000,
    retry: { attempts: 2, backoffMs: 200 },
    rssMode: "lenient",
  });

  if (!result.ok) {
    return { items: [], source: "fallback", error: result.error };
  }

  return {
    source: result.data.title,
    items: result.data.items.map((item) => ({
      title: item.title,
      link: item.link,
      publishedAt: item.pubDate,
    })),
  };
}
```

### Changelog

A changelog is the file where you record what changed in each version (features, fixes, breaking changes).
It helps users trust updates and migrate faster.

- Convention: keep one section per version (`## 1.3.0`, `## 1.2.1`, etc.)
- Include: Added, Changed, Fixed, Breaking (if any)
- Follow SemVer (`major.minor.patch`)

### 🧪 Testing

Venus is fully tested with **Vitest**.  
Run the test suite with:

```bash
npm test

```

## 📄 License

MIT © [code-braydev](https://github.com/code-braydev)
