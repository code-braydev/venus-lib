import { XMLParser } from "fast-xml-parser";
import { get } from "./get.js";
import {
  VenusRssMode,
  VenusRssOptions,
  VenusResponse,
  VenusRssFeed,
  VenusRssItem,
  VenusRssMediaContent,
} from "../core/types.js";

type XmlNode = Record<string, unknown>;

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function textOf(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "object") {
    const node = value as XmlNode;
    const candidates = ["#text", "#cdata", "@_href", "href"];

    for (const key of candidates) {
      const candidate = textOf(node[key]);
      if (candidate) {
        return candidate;
      }
    }
  }

  return undefined;
}

function attrOf(value: unknown, name: string): string | undefined {
  if (value && typeof value === "object") {
    return textOf((value as XmlNode)[`@_${name}`]);
  }
  return undefined;
}

function numberAttr(value: unknown): number | undefined {
  const raw = attrOf(value, "length");
  if (raw == null) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseEnclosure(node: XmlNode): VenusRssItem["enclosure"] {
  const enclosure = node.enclosure;
  if (enclosure == null) {
    return undefined;
  }

  const entry = asArray(enclosure)[0];
  const url = attrOf(entry, "url");
  if (!url) {
    return undefined;
  }

  return {
    url,
    type: attrOf(entry, "type"),
    length: numberAttr(entry),
  };
}

function parseAtomEnclosure(node: XmlNode): VenusRssItem["enclosure"] {
  for (const link of asArray(node.link)) {
    if (!link || typeof link !== "object") {
      continue;
    }
    const href = attrOf(link, "href");
    if (!href) {
      continue;
    }
    const rel = attrOf(link, "rel");
    const type = attrOf(link, "type");
    if (rel === "enclosure" || (type && type.startsWith("image/"))) {
      return { url: href, type, length: numberAttr(link) };
    }
  }
  return undefined;
}

function parseMedia(node: XmlNode): VenusRssItem["media"] {
  const content: VenusRssMediaContent[] = [];
  for (const entry of asArray(node["media:content"])) {
    const url = attrOf(entry, "url");
    if (url) {
      content.push({
        url,
        type: attrOf(entry, "type"),
        medium: attrOf(entry, "medium"),
      });
    }
  }

  const thumbnail: { url: string }[] = [];
  for (const entry of asArray(node["media:thumbnail"])) {
    const url = attrOf(entry, "url");
    if (url) {
      thumbnail.push({ url });
    }
  }

  if (content.length === 0 && thumbnail.length === 0) {
    return undefined;
  }

  return {
    ...(content.length > 0 ? { content } : {}),
    ...(thumbnail.length > 0 ? { thumbnail } : {}),
  };
}

const HTML_IMG_SRC = /<img[^>]+src=["']([^"']+)["']/i;

function firstImageFromHtml(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const match = value.match(HTML_IMG_SRC);
  return match?.[1];
}

function resolveItemImage(parts: {
  description?: string;
  content?: string;
  enclosure?: VenusRssItem["enclosure"];
  media?: VenusRssItem["media"];
}): string | undefined {
  const enclosure = parts.enclosure;
  if (
    enclosure &&
    (!enclosure.type || enclosure.type.startsWith("image/"))
  ) {
    return enclosure.url;
  }

  const thumbnail = parts.media?.thumbnail?.[0]?.url;
  if (thumbnail) {
    return thumbnail;
  }

  const mediaImage = parts.media?.content?.find(
    (entry) => !entry.type || entry.type.startsWith("image/"),
  )?.url;
  if (mediaImage) {
    return mediaImage;
  }

  return firstImageFromHtml(parts.content) ?? firstImageFromHtml(parts.description);
}

function atomLinkOf(node: XmlNode): string | undefined {
  const links = asArray(node.link).filter(
    (link) => link && typeof link === "object",
  );
  if (links.length === 0) {
    return undefined;
  }

  const alternate = links.find((link) => {
    const rel = attrOf(link, "rel");
    return rel === "alternate" || rel == null;
  });

  return attrOf(alternate ?? links[0], "href");
}

function parseRssItems(channel: XmlNode): VenusRssItem[] {
  return asArray(channel.item).map((entry) => {
    const node = (entry ?? {}) as XmlNode;
    const categories = asArray(node.category)
      .map((category) => textOf(category))
      .filter((value): value is string => Boolean(value));

    const description = textOf(node.description);
    const content = textOf(node["content:encoded"]) ?? textOf(node.content);
    const enclosure = parseEnclosure(node);
    const media = parseMedia(node);

    return {
      title: textOf(node.title) ?? "Untitled",
      link: textOf(node.link),
      description,
      content,
      pubDate: textOf(node.pubDate),
      guid: textOf(node.guid),
      author: textOf(node.author) ?? textOf(node["dc:creator"]),
      categories: categories.length > 0 ? categories : undefined,
      enclosure,
      media,
      image: resolveItemImage({ description, content, enclosure, media }),
    };
  });
}

function parseAtomItems(feed: XmlNode): VenusRssItem[] {
  return asArray(feed.entry).map((entry) => {
    const node = (entry ?? {}) as XmlNode;
    const categories = asArray(node.category)
      .map((category) => textOf((category as XmlNode)?.["@_term"] ?? category))
      .filter((value): value is string => Boolean(value));

    const description = textOf(node.summary);
    const content = textOf(node.content);
    const enclosure = parseAtomEnclosure(node) ?? parseEnclosure(node);
    const media = parseMedia(node);

    return {
      title: textOf(node.title) ?? "Untitled",
      link: atomLinkOf(node),
      description,
      content,
      pubDate: textOf(node.updated) ?? textOf(node.published),
      guid: textOf(node.id),
      author: textOf((node.author as XmlNode)?.name ?? node.author),
      categories: categories.length > 0 ? categories : undefined,
      enclosure,
      media,
      image: resolveItemImage({ description, content, enclosure, media }),
    };
  });
}

function flattenItemsFromUnknown(node: XmlNode): VenusRssItem[] {
  const itemCandidates = asArray(node.item);
  const entryCandidates = asArray(node.entry);
  const rawItems = itemCandidates.length > 0 ? itemCandidates : entryCandidates;

  return rawItems.map((entry) => {
    const item = (entry ?? {}) as XmlNode;
    const categories = asArray(item.category)
      .map((category) => textOf((category as XmlNode)?.["@_term"] ?? category))
      .filter((value): value is string => Boolean(value));

    const description = textOf(item.description) ?? textOf(item.summary);
    const content = textOf(item["content:encoded"]) ?? textOf(item.content);
    const enclosure = parseEnclosure(item) ?? parseAtomEnclosure(item);
    const media = parseMedia(item);

    return {
      title: textOf(item.title) ?? "Untitled",
      link: textOf(item.link),
      description,
      content,
      pubDate:
        textOf(item.pubDate) ?? textOf(item.updated) ?? textOf(item.published),
      guid: textOf(item.guid) ?? textOf(item.id),
      author: textOf(item.author) ?? textOf(item["dc:creator"]),
      categories: categories.length > 0 ? categories : undefined,
      enclosure,
      media,
      image: resolveItemImage({ description, content, enclosure, media }),
    };
  });
}

function findBestRoot(document: XmlNode): XmlNode {
  if (document.rss) {
    const rss = document.rss as XmlNode;
    return ((rss.channel as XmlNode | undefined) ?? rss) as XmlNode;
  }

  if (document.feed) {
    return document.feed as XmlNode;
  }

  const firstObject = Object.values(document).find(
    (value) => value && typeof value === "object",
  );

  return (firstObject as XmlNode | undefined) ?? document;
}

function parseLenientFeed(document: XmlNode): VenusRssFeed {
  const root = findBestRoot(document);
  const items = flattenItemsFromUnknown(root);

  const hasAtomSignals = Boolean(root.entry || root.updated || root.subtitle);

  return {
    sourceType: hasAtomSignals ? "atom" : "rss",
    title: textOf(root.title) ?? "Untitled Feed",
    description: textOf(root.description) ?? textOf(root.subtitle),
    link: textOf(root.link),
    language: textOf(root.language) ?? textOf(root["@_xml:lang"]),
    updatedAt:
      textOf(root.lastBuildDate) ??
      textOf(root.updated) ??
      textOf(root.pubDate),
    image:
      textOf((root.image as XmlNode | undefined)?.url) ?? textOf(root.logo),
    items,
  };
}

function parseFeed(xml: string, mode: VenusRssMode): VenusRssFeed {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
    parseTagValue: true,
  });

  const document = parser.parse(xml) as XmlNode;

  if (document.rss) {
    const channel = ((document.rss as XmlNode).channel ?? {}) as XmlNode;

    return {
      sourceType: "rss",
      title: textOf(channel.title) ?? "Untitled Feed",
      description: textOf(channel.description),
      link: textOf(channel.link),
      language: textOf(channel.language),
      updatedAt: textOf(channel.lastBuildDate),
      image: textOf(((channel.image as XmlNode) ?? {}).url),
      items: parseRssItems(channel),
    };
  }

  if (document.feed) {
    const feed = document.feed as XmlNode;

    return {
      sourceType: "atom",
      title: textOf(feed.title) ?? "Untitled Feed",
      description: textOf(feed.subtitle),
      link: textOf(feed.link),
      language: textOf(feed["@_xml:lang"]),
      updatedAt: textOf(feed.updated),
      image: textOf(feed.logo) ?? textOf(feed.icon),
      items: parseAtomItems(feed),
    };
  }

  if (mode === "lenient") {
    return parseLenientFeed(document);
  }

  throw new Error("Unsupported feed format. Expected RSS or Atom XML.");
}

/**
 * Fetches and parses RSS/Atom feeds into a normalized structure.
 */
export const getRss = async (
  path: string,
  options: VenusRssOptions = {},
): Promise<VenusResponse<VenusRssFeed>> => {
  const mode = options.rssMode ?? "strict";
  const headers = new Headers(options.headers);
  if (!headers.has("Accept")) {
    headers.set(
      "Accept",
      "application/rss+xml, application/atom+xml, application/xml, text/xml, text/plain;q=0.9",
    );
  }

  const response = await get<string>(path, {
    ...options,
    headers,
    responseType: "text",
  });

  if (!response.ok) {
    return {
      data: null,
      ok: false,
      status: response.status,
      errorCode: response.errorCode,
      error: response.error,
    };
  }

  if (!response.data || typeof response.data !== "string") {
    return {
      data: null,
      ok: false,
      status: response.status,
      errorCode: "PARSING_ERROR",
      error: "Venus: RSS response body is empty.",
    };
  }

  try {
    const feed = parseFeed(response.data, mode);
    return {
      data: feed,
      ok: true,
      status: response.status,
      errorCode: null,
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      ok: false,
      status: response.status,
      errorCode: "PARSING_ERROR",
      error:
        err instanceof Error
          ? `Venus: RSS parsing failed. ${err.message}`
          : "Venus: RSS parsing failed.",
    };
  }
};
