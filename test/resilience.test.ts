import { describe, it, expect, afterEach, vi } from "vitest";
import { get } from "../src/index";

describe("Venus Resilience & Resilience Strategies", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should retry on 503 and recover successfully", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response("Service Unavailable", { status: 503 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    const { ok, data, status } = await get("https://api.example.com/flaky", {
      retry: {
        attempts: 2,
        backoffMs: 10,
      },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(ok).toBe(true);
    expect(status).toBe(200);
    expect(data).toEqual({ success: true });
  });

  it("should exhaust retries and return RETRY_EXHAUSTED", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Response("Gateway Timeout", { status: 504 }),
    );

    const { ok, errorCode, status, error } = await get("https://api.example.com/down", {
      retry: {
        attempts: 2,
        backoffMs: 5,
      },
    });

    expect(ok).toBe(false);
    expect(errorCode).toBe("RETRY_EXHAUSTED");
    expect(status).toBe(504);
    expect(error).toContain("Retry attempts exhausted");
  });

  it("should respect custom shouldRetry decision", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Response("Bad Request", { status: 400 }),
    );

    const { ok, errorCode, status } = await get("https://api.example.com/custom", {
      retry: {
        attempts: 3,
        backoffMs: 5,
        shouldRetry: ({ status }) => status === 400, // Retry on 400 for test purposes
      },
    });

    expect(ok).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(4); // initial + 3 retries
    expect(errorCode).toBe("RETRY_EXHAUSTED");
    expect(status).toBe(400);
  });

  it("should handle network errors (fetch throwing exception)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Failed to fetch"));

    const { ok, errorCode, error, status } = await get("https://api.example.com/network-fail");

    expect(ok).toBe(false);
    expect(errorCode).toBe("NETWORK_ERROR");
    expect(status).toBe(0);
    expect(error).toContain("Network error");
  });

  it("should return success when the last retry attempt succeeds", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("Service Unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response("Service Unavailable", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    const { ok, data, errorCode } = await get("https://api.example.com/flaky2", {
      retry: { attempts: 2, backoffMs: 5 },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(ok).toBe(true);
    expect(errorCode).toBe(null);
    expect(data).toEqual({ ok: true });
  });

  it("should handle request timeout correctly", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_url, init) => {
        const signal = init?.signal;
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 200);
          signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
          );
        });
        return new Response("ok", { status: 200 });
      },
    );

    const { ok, errorCode, status } = await get("https://api.example.com/slow", {
      timeout: 30,
    });

    expect(ok).toBe(false);
    expect(errorCode).toBe("TIMEOUT");
    expect(status).toBe(408);
  });
});
