/**
 * Site crawler for AEO / AI visibility tools (ported from mcp-ai-visibility).
 */
import * as cheerio from 'cheerio';

const DEFAULT_TIMEOUT = parseInt(process.env.CRAWL_TIMEOUT_MS ?? '10000', 10);
const MAX_CRAWL_PAGES = parseInt(process.env.MAX_CRAWL_PAGES ?? '10', 10);

const USER_AGENT = 'Mozilla/5.0 (compatible; SellOnLLM-AEO-Bot/1.0; +https://www.sellonllm.com)';

export function normalizeDomain(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
}

export function normalizeUrl(url) {
    try {
        const u = new URL(url);
        return `${u.protocol}//${u.host}${u.pathname}`.replace(/\/$/, '');
    } catch {
        return url;
    }
}

function extractFAQItems($) {
    const items = [];

    $('script[type="application/ld+json"]').each((_, el) => {
        try {
            const data = JSON.parse($(el).text());
            const schemas = Array.isArray(data) ? data : [data];
            for (const schema of schemas) {
                if (schema['@type'] === 'FAQPage' && Array.isArray(schema.mainEntity)) {
                    for (const entry of schema.mainEntity) {
                        items.push({
                            question: entry.name ?? '',
                            answer:
                                typeof entry.acceptedAnswer?.text === 'string'
                                    ? entry.acceptedAnswer.text.slice(0, 300)
                                    : '',
                        });
                    }
                }
            }
        } catch {
            /* ignore */
        }
    });

    if (items.length === 0) {
        $('details').each((_, el) => {
            const question = $(el).find('summary').text().trim();
            const answer = $(el).find('summary').nextAll().text().trim().slice(0, 300);
            if (question) items.push({ question, answer });
        });

        $('dl').each((_, dl) => {
            $(dl).find('dt').each((i, dt) => {
                const question = $(dt).text().trim();
                const answer = $(dt).next('dd').text().trim().slice(0, 300);
                if (question) items.push({ question, answer });
            });
        });
    }

    return items.slice(0, 20);
}

function collectTypes(obj, types, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 6) return;
    if (Array.isArray(obj)) {
        obj.forEach((item) => collectTypes(item, types, depth + 1));
        return;
    }
    if (obj['@type']) {
        const t = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
        types.push(...t);
    }
    for (const val of Object.values(obj)) {
        if (val && typeof val === 'object') collectTypes(val, types, depth + 1);
    }
}

function extractStructuredDataTypes($) {
    const types = [];
    $('script[type="application/ld+json"]').each((_, el) => {
        try {
            const data = JSON.parse($(el).text());
            collectTypes(Array.isArray(data) ? data : [data], types);
        } catch {
            /* ignore */
        }
    });
    return [...new Set(types)];
}

function extractAuthorInfo($) {
    let author = null;

    // Check JSON-LD — recurse to find any author.name in nested schemas
    $('script[type="application/ld+json"]').each((_, el) => {
        if (author) return;
        try {
            const data = JSON.parse($(el).text());
            const findAuthor = (obj) => {
                if (!obj || typeof obj !== 'object') return null;
                if (obj.author?.name) return obj.author.name;
                if (obj.creator?.name) return obj.creator.name;
                for (const val of Object.values(obj)) {
                    if (val && typeof val === 'object') {
                        const found = findAuthor(val);
                        if (found) return found;
                    }
                }
                return null;
            };
            author = findAuthor(Array.isArray(data) ? { items: data } : data);
        } catch { /* ignore */ }
    });
    if (author) return author;

    const metaAuthor =
        $('meta[name="author"]').attr('content') ??
        $('meta[property="article:author"]').attr('content');
    if (metaAuthor) return metaAuthor;

    // Semantic / microdata author
    const itemPropAuthor = $('[itemprop="author"]').first().text().trim();
    if (itemPropAuthor) return itemPropAuthor;

    const relAuthor = $('a[rel="author"]').first().text().trim();
    if (relAuthor) return relAuthor;

    // Class-name heuristics (.author, .byline, .written-by)
    const bylineText = $('[class*="author"],[class*="byline"],[class*="written-by"]')
        .first().text().trim();
    if (bylineText && bylineText.length < 120) return bylineText;

    return null;
}

function cleanText(raw) {
    return raw
        .replace(/\s+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, 5000);
}

export async function crawlPage(url) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
    let response;
    try {
        response = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': USER_AGENT },
            redirect: 'follow',
        });
    } finally {
        clearTimeout(t);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    $("script:not([type='application/ld+json']), style, noscript, svg").remove();

    const title = $('title').text().trim() || $('h1').first().text().trim();
    const description =
        $('meta[name="description"]').attr('content') ??
        $('meta[property="og:description"]').attr('content') ??
        '';

    const h1 = $('h1')
        .map((_, el) => $(el).text().trim())
        .get()
        .filter(Boolean);
    const h2 = $('h2')
        .map((_, el) => $(el).text().trim())
        .get()
        .filter(Boolean)
        .slice(0, 20);
    const h3 = $('h3')
        .map((_, el) => $(el).text().trim())
        .get()
        .filter(Boolean)
        .slice(0, 20);

    const bodyText = cleanText($('body').text());
    const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

    const structuredDataTypes = extractStructuredDataTypes($);
    const hasStructuredData = structuredDataTypes.length > 0;
    const faqItems = extractFAQItems($);
    const hasFAQ =
        faqItems.length > 0 || /faq|frequently asked/i.test($('body').text().slice(0, 2000));

    const authorInfo = extractAuthorInfo($);

    const baseUrl = new URL(url);
    const externalLinks = [];
    const internalLinks = [];

    $('a[href]').each((_, el) => {
        const href = $(el).attr('href') ?? '';
        try {
            const resolved = new URL(href, url);
            if (resolved.hostname === baseUrl.hostname) {
                internalLinks.push(normalizeUrl(resolved.href));
            } else if (resolved.protocol.startsWith('http')) {
                externalLinks.push(resolved.href);
            }
        } catch {
            /* ignore */
        }
    });

    const ogTags = {};
    $("meta[property^='og:']").each((_, el) => {
        const prop = $(el).attr('property')?.replace('og:', '') ?? '';
        const content = $(el).attr('content') ?? '';
        if (prop && content) ogTags[prop] = content;
    });

    const canonical = $('link[rel="canonical"]').attr('href') ?? null;

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

export async function crawlSite(rootUrl, maxPages = MAX_CRAWL_PAGES) {
    const visited = new Set();
    const queue = [normalizeUrl(rootUrl)];
    const pages = [];

    while (queue.length > 0 && pages.length < maxPages) {
        const url = queue.shift();
        if (!url || visited.has(url)) continue;
        visited.add(url);

        try {
            const page = await crawlPage(url);
            if (page.statusCode >= 500) continue;
            pages.push(page);

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
            /* skip unreachable */
        }
    }

    return pages;
}
