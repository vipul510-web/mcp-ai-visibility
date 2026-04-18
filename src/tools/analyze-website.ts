import { z } from "zod";
import { crawlSite } from "../services/crawler.js";
import { analyzeAEO, formatAEOReport } from "../services/aeo-analyzer.js";

export const analyzeWebsiteSchema = z.object({
  url: z
    .string()
    .url()
    .describe("The website URL to analyze (e.g. https://example.com)"),
  max_pages: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .default(5)
    .describe("Number of pages to crawl (1–20, default 5)"),
});

export type AnalyzeWebsiteInput = z.infer<typeof analyzeWebsiteSchema>;

export async function analyzeWebsiteTool(
  input: AnalyzeWebsiteInput
): Promise<string> {
  const { url, max_pages } = input;

  let pages;
  try {
    pages = await crawlSite(url, max_pages);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return `❌ Failed to crawl ${url}: ${msg}\n\nMake sure the URL is publicly accessible and returns HTML.`;
  }

  if (pages.length === 0) {
    return `❌ Could not fetch any pages from ${url}. The site may be blocking crawlers or require authentication.`;
  }

  const analysis = analyzeAEO(pages, url);
  return formatAEOReport(analysis);
}
