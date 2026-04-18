import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { get, venusConfig } from "../src/index";

describe("Venus vNext capabilities", () => {
  beforeAll(() => {
    venusConfig.setBaseURL("https://example.com");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should serialize params using brackets strategy", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await get("/search", {
      params: {
        tags: ["api", "venus"],
        filters: {
          active: true,
        },
      },
      paramsArrayFormat: "brackets",
    });

    const calledUrl = String(fetchSpy.mock.calls[0][0]);
    expect(calledUrl).toContain("tags%5B%5D=api");
    expect(calledUrl).toContain("tags%5B%5D=venus");
    expect(calledUrl).toContain("filters.active=true");
  });

  it("should support forced text parsing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<rss>ok</rss>", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await get<string>("/feed", {
      responseType: "text",
    });

    expect(result.ok).toBe(true);
    expect(result.data).toBe("<rss>ok</rss>");
  });

  it("should retry transient errors and recover", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "temporarily unavailable" }), {
          status: 503,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: "ok" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    const result = await get<{ data: string }>("/resilient", {
      retry: {
        attempts: 1,
        backoffMs: 0,
      },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
    expect(result.data?.data).toBe("ok");
  });
});
