import axios from "axios";
import * as cheerio from "cheerio";
import type { CrawledPage } from "../types.js";

const DEFAULT_TIMEOUT = parseInt(process.env.CRAWL_TIMEOUT_MS ?? "10000");
const MAX_CRAWL_PAGES = parseInt(process.env.MAX_CRAWL_PAGES ?? "10");

const USER_AGENT =
  "Mozilla/5.0 (compatible; AEO-Visibility-Bot/1.0; +https://sellonllm.com/bot)";

export function normalizeDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}`.replace(/\/$/, "");
  } catch {
    return url;
  }
}

function extractFAQItems(
  $: cheerio.CheerioAPI
): Array<{ question: string; answer: string }> {
  const items: Array<{ question: string; answer: string }> = [];

  // JSON-LD FAQ schema
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      const schemas = Array.isArray(data) ? data : [data];
      for (const schema of schemas) {
        if (schema["@type"] === "FAQPage" && Array.isArray(schema.mainEntity)) {
          for (const entry of schema.mainEntity) {
            items.push({
              question: entry.name ?? "",
              answer:
                typeof entry.acceptedAnswer?.text === "string"
                  ? entry.acceptedAnswer.text.slice(0, 300)
                  : "",
            });
          }
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  });

  // HTML-based FAQ patterns (accordion, dt/dd pairs, etc.)
  if (items.length === 0) {
    $("details").each((_, el) => {
      const question = $(el).find("summary").text().trim();
      const answer = $(el)
        .find("summary")
        .nextAll()
        .text()
        .trim()
        .slice(0, 300);
      if (question) items.push({ question, answer });
    });

    // dt/dd pattern
    $("dl").each((_, dl) => {
      $(dl)
        .find("dt")
        .each((i, dt) => {
          const question = $(dt).text().trim();
          const answer = $(dt).next("dd").text().trim().slice(0, 300);
          if (question) items.push({ question, answer });
        });
    });
  }

  return items.slice(0, 20);
}

// Recursively collect all @type values from a JSON-LD object tree so that
// nested schemas (e.g. Organization inside WebSite) are not missed.
function collectTypes(obj: unknown, types: string[], depth = 0): void {
  if (!obj || typeof obj !== "object" || depth > 6) return;
  if (Array.isArray(obj)) {
    obj.forEach((item) => collectTypes(item, types, depth + 1));
    return;
  }
  const record = obj as Record<string, unknown>;
  if (record["@type"]) {
    const t = Array.isArray(record["@type"])
      ? (record["@type"] as string[])
      : [record["@type"] as string];
    types.push(...t);
  }
  for (const val of Object.values(record)) {
    if (val && typeof val === "object") collectTypes(val, types, depth + 1);
  }
}

function extractStructuredDataTypes($: cheerio.CheerioAPI): string[] {
  const types: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      collectTypes(Array.isArray(data) ? data : [data], types);
    } catch {
      // ignore
    }
  });
  return [...new Set(types)];
}

function extractAuthorInfo($: cheerio.CheerioAPI): string | null {
  let author: string | null = null;

  // JSON-LD — recurse to find author.name or creator.name anywhere in the tree
  $('script[type="application/ld+json"]').each((_, el) => {
    if (author) return;
    try {
      const data = JSON.parse($(el).text());
      const findAuthor = (obj: unknown): string | null => {
        if (!obj || typeof obj !== "object") return null;
        const rec = obj as Record<string, unknown>;
        const nameVal = (rec.author as Record<string, unknown>)?.name
          ?? (rec.creator as Record<string, unknown>)?.name;
        if (typeof nameVal === "string") return nameVal;
        for (const val of Object.values(rec)) {
          if (val && typeof val === "object") {
            const found = findAuthor(val);
            if (found) return found;
          }
        }
        return null;
      };
      author = findAuthor(Array.isArray(data) ? { items: data } : data);
    } catch {
      // ignore
    }
  });
  if (author) return author;

  // Meta tags
  const metaAuthor =
    $('meta[name="author"]').attr("content") ??
    $('meta[property="article:author"]').attr("content");
  if (metaAuthor) return metaAuthor;

  // Semantic / microdata
  const itemPropAuthor = $('[itemprop="author"]').first().text().trim();
  if (itemPropAuthor) return itemPropAuthor;

  // rel=author link
  const relAuthor = $('a[rel="author"]').first().text().trim();
  if (relAuthor) return relAuthor;

  // Class-name heuristics (.author, .byline, .written-by)
  const bylineText = $('[class*="author"],[class*="byline"],[class*="written-by"]')
    .first().text().trim();
  if (bylineText && bylineText.length < 120) return bylineText;

  return null;
}

function cleanText(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 5000); // cap for analysis
}

export async function crawlPage(url: string): Promise<CrawledPage> {
  const response = await axios.get(url, {
    timeout: DEFAULT_TIMEOUT,
    headers: { "User-Agent": USER_AGENT },
    maxRedirects: 5,
    validateStatus: (s) => s < 500,
  });

  const $ = cheerio.load(response.data as string);

  // Remove noise elements
  $("script:not([type='application/ld+json']), style, noscript, svg").remove();

  const title = $("title").text().trim() || $("h1").first().text().trim();
  const description =
    $('meta[name="description"]').attr("content") ??
    $('meta[property="og:description"]').attr("content") ??
    "";

  const h1 = $("h1")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
  const h2 = $("h2")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 20);
  const h3 = $("h3")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 20);

  const bodyText = cleanText($("body").text());
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

  const structuredDataTypes = extractStructuredDataTypes($);
  const hasStructuredData = structuredDataTypes.length > 0;
  const faqItems = extractFAQItems($);
  const hasFAQ =
    faqItems.length > 0 ||
    /faq|frequently asked/i.test($("body").text().slice(0, 2000));

  const authorInfo = extractAuthorInfo($);

  const baseUrl = new URL(url);
  const externalLinks: string[] = [];
  const internalLinks: string[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    try {
      const resolved = new URL(href, url);
      if (resolved.hostname === baseUrl.hostname) {
        internalLinks.push(normalizeUrl(resolved.href));
      } else if (resolved.protocol.startsWith("http")) {
        externalLinks.push(resolved.href);
      }
    } catch {
      // ignore malformed hrefs
    }
  });

  const ogTags: Record<string, string> = {};
  $("meta[property^='og:']").each((_, el) => {
    const prop = $(el).attr("property")?.replace("og:", "") ?? "";
    const content = $(el).attr("content") ?? "";
    if (prop && content) ogTags[prop] = content;
  });

  const canonical = $('link[rel="canonical"]').attr("href") ?? null;

  return {
    url,
    title,
    description,
    h1,
    h2,
    h3,
    bodyText,
    wordCount,
    hasStructuredData,
    structuredDataTypes,
    hasFAQ,
    faqItems,
    authorInfo,
    externalLinks: [...new Set(externalLinks)].slice(0, 50),
    internalLinks: [...new Set(internalLinks)].slice(0, 50),
    ogTags,
    canonical,
    statusCode: response.status,
    loadedAt: new Date().toISOString(),
  };
}

export async function crawlSite(
  rootUrl: string,
  maxPages = MAX_CRAWL_PAGES
): Promise<CrawledPage[]> {
  const visited = new Set<string>();
  const queue: string[] = [normalizeUrl(rootUrl)];
  const pages: CrawledPage[] = [];

  while (queue.length > 0 && pages.length < maxPages) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    try {
      const page = await crawlPage(url);
      pages.push(page);

      // Enqueue internal links (same domain, not asset URLs)
      for (const link of page.internalLinks) {
        if (
          !visited.has(link) &&
          !queue.includes(link) &&
          !link.match(/\.(jpg|jpeg|png|gif|pdf|zip|mp4|svg|ico|css|js)$/i)
        ) {
          queue.push(link);
        }
      }
    } catch {
      // skip unreachable pages
    }
  }

  return pages;
}
