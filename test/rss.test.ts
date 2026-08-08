import { afterEach, describe, expect, it, vi } from "vitest";
import { getRss } from "../src/index";

describe("Venus RSS helper", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should parse an RSS 2.0 feed", async () => {
    const rssXml = `<?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <title>Venus Blog</title>
          <link>https://venus.dev</link>
          <description>Network updates</description>
          <item>
            <title>Release 1</title>
            <link>https://venus.dev/release-1</link>
            <description>First release</description>
            <pubDate>Sat, 18 Apr 2026 12:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`;

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(rssXml, {
        status: 200,
        headers: { "content-type": "application/rss+xml" },
      }),
    );

    const result = await getRss("https://example.com/rss.xml");

    expect(result.ok).toBe(true);
    expect(result.data?.sourceType).toBe("rss");
    expect(result.data?.title).toBe("Venus Blog");
    expect(result.data?.items.length).toBe(1);
    expect(result.data?.items[0].title).toBe("Release 1");
  });

  it("should parse an Atom feed", async () => {
    const atomXml = `<?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Venus Atom</title>
        <updated>2026-04-18T12:00:00Z</updated>
        <entry>
          <title>Post A</title>
          <link href="https://venus.dev/post-a" />
          <id>tag:venus.dev,2026:post-a</id>
          <updated>2026-04-18T11:00:00Z</updated>
          <summary>Atom content</summary>
        </entry>
      </feed>`;

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(atomXml, {
        status: 200,
        headers: { "content-type": "application/atom+xml" },
      }),
    );

    const result = await getRss("https://example.com/atom.xml");

    expect(result.ok).toBe(true);
    expect(result.data?.sourceType).toBe("atom");
    expect(result.data?.items[0].link).toBe("https://venus.dev/post-a");
  });

  it("should return parsing error for unsupported XML", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<note><title>hello</title></note>", {
        status: 200,
        headers: { "content-type": "application/xml" },
      }),
    );

    const result = await getRss("https://example.com/note.xml");

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("PARSING_ERROR");
  });

  it("should keep strict mode by default", async () => {
    const xml = `<note><title>Custom Feed</title></note>`;

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(xml, {
        status: 200,
        headers: { "content-type": "application/xml" },
      }),
    );

    const result = await getRss("https://example.com/custom.xml");

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("PARSING_ERROR");
  });

  it("should parse non-standard XML in lenient mode", async () => {
    const xml = `
      <customFeed>
        <title>Custom Feed</title>
        <entry>
          <title>Item X</title>
          <link>https://custom.dev/x</link>
          <summary>desc</summary>
        </entry>
      </customFeed>
    `;

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(xml, {
        status: 200,
        headers: { "content-type": "application/xml" },
      }),
    );

    const result = await getRss("https://example.com/custom.xml", {
      rssMode: "lenient",
    });

    expect(result.ok).toBe(true);
    expect(result.data?.title).toBe("Custom Feed");
    expect(result.data?.items[0].title).toBe("Item X");
  });

  it("should extract the enclosure image from RSS items", async () => {
    const rssXml = `<?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <title>Imaged Feed</title>
          <link>https://example.com</link>
          <description>feed</description>
          <item>
            <title>Post with image</title>
            <link>https://example.com/post</link>
            <description>Some text</description>
            <enclosure url="https://example.com/photo.jpg" type="image/jpeg" length="2048"/>
          </item>
        </channel>
      </rss>`;

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(rssXml, {
        status: 200,
        headers: { "content-type": "application/rss+xml" },
      }),
    );

    const result = await getRss("https://example.com/feed.xml");
    const item = result.data?.items[0];

    expect(result.ok).toBe(true);
    expect(item?.enclosure).toEqual({
      url: "https://example.com/photo.jpg",
      type: "image/jpeg",
      length: 2048,
    });
    expect(item?.image).toBe("https://example.com/photo.jpg");
  });

  it("should extract media:thumbnail and media:content from RSS items", async () => {
    const rssXml = `<?xml version="1.0"?>
      <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
        <channel>
          <title>Media Feed</title>
          <link>https://example.com</link>
          <description>feed</description>
          <item>
            <title>Media post</title>
            <link>https://example.com/media</link>
            <description>Media desc</description>
            <media:thumbnail url="https://example.com/thumb.png"/>
            <media:content url="https://example.com/full.jpg" type="image/jpeg" medium="image"/>
          </item>
        </channel>
      </rss>`;

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(rssXml, {
        status: 200,
        headers: { "content-type": "application/rss+xml" },
      }),
    );

    const result = await getRss("https://example.com/feed.xml");
    const item = result.data?.items[0];

    expect(result.ok).toBe(true);
    expect(item?.media?.thumbnail).toEqual([
      { url: "https://example.com/thumb.png" },
    ]);
    expect(item?.media?.content).toEqual([
      {
        url: "https://example.com/full.jpg",
        type: "image/jpeg",
        medium: "image",
      },
    ]);
    expect(item?.image).toBe("https://example.com/thumb.png");
  });

  it("should extract the first <img> from item HTML as image", async () => {
    const rssXml = `<?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <title>Html Feed</title>
          <link>https://example.com</link>
          <description>feed</description>
          <item>
            <title>Html post</title>
            <link>https://example.com/html</link>
            <description><![CDATA[<p>Intro</p><img src="https://example.com/inline.png" alt="inline"/>]]></description>
          </item>
        </channel>
      </rss>`;

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(rssXml, {
        status: 200,
        headers: { "content-type": "application/rss+xml" },
      }),
    );

    const result = await getRss("https://example.com/feed.xml");
    const item = result.data?.items[0];

    expect(result.ok).toBe(true);
    expect(item?.image).toBe("https://example.com/inline.png");
  });

  it("should extract an Atom enclosure link as item image", async () => {
    const atomXml = `<?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Venus Atom Images</title>
        <updated>2026-04-18T12:00:00Z</updated>
        <entry>
          <title>Post with image</title>
          <link href="https://venus.dev/post-b" rel="alternate" />
          <link href="https://venus.dev/cover.png" rel="enclosure" type="image/png" />
          <id>tag:venus.dev,2026:post-b</id>
          <updated>2026-04-18T11:00:00Z</updated>
          <summary>Atom content</summary>
        </entry>
      </feed>`;

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(atomXml, {
        status: 200,
        headers: { "content-type": "application/atom+xml" },
      }),
    );

    const result = await getRss("https://example.com/atom.xml");
    const item = result.data?.items[0];

    expect(result.ok).toBe(true);
    expect(item?.link).toBe("https://venus.dev/post-b");
    expect(item?.enclosure).toEqual({
      url: "https://venus.dev/cover.png",
      type: "image/png",
    });
    expect(item?.image).toBe("https://venus.dev/cover.png");
  });

  it("should extract enclosure in lenient mode", async () => {
    const xml = `
      <customFeed>
        <title>Custom Feed</title>
        <entry>
          <title>Item with image</title>
          <link>https://custom.dev/x</link>
          <enclosure url="https://custom.dev/pic.jpg" type="image/jpeg"/>
          <summary>desc</summary>
        </entry>
      </customFeed>
    `;

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(xml, {
        status: 200,
        headers: { "content-type": "application/xml" },
      }),
    );

    const result = await getRss("https://example.com/custom.xml", {
      rssMode: "lenient",
    });
    const item = result.data?.items[0];

    expect(result.ok).toBe(true);
    expect(item?.enclosure?.url).toBe("https://custom.dev/pic.jpg");
    expect(item?.image).toBe("https://custom.dev/pic.jpg");
  });
});
