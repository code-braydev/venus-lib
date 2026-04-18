import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { get, venusConfig } from "../src/index";

describe("Venus GET Method", () => {
  beforeAll(() => {
    // Using a reliable public API for testing
    venusConfig.setBaseURL("https://jsonplaceholder.typicode.com");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should fetch a post successfully", async () => {
    const { ok, data, status } = await get<any>("/posts/1");
    expect(ok).toBe(true);
    expect(status).toBe(200);
    expect(data.id).toBe(1);
  });

  it("should handle 404 errors gracefully", async () => {
    const { ok, status } = await get("/invalid-endpoint-braydev");
    expect(ok).toBe(false);
    expect(status).toBe(404);
  });

  it("should trigger timeout when server is too slow", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_input, init?: RequestInit) => {
        const signal = init?.signal;

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 100);

          signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
          );
        });

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    );

    const { ok, status, error, errorCode } = await get("/posts/1", {
      timeout: 50,
    });

    expect(ok).toBe(false);
    expect(status).toBe(408);
    expect(errorCode).toBe("TIMEOUT");
    expect(error).toContain("timed out");
  });
});
