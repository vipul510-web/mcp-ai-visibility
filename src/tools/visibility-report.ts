import { z } from "zod";
import { rateLimitedCheckVisibility } from "../services/ai-checker.js";
import { crawlSite } from "../services/crawler.js";
import { generateTestPrompts } from "../services/prompt-gen.js";
import { normalizeDomain } from "../services/crawler.js";
import type { CrawledPage, VisibilityReport } from "../types.js";

export const visibilityReportSchema = z.object({
  url: z
    .string()
    .url()
    .describe("Your website URL"),
  queries: z
    .array(z.string().min(5))
    .min(1)
    .max(15)
    .optional()
    .describe(
      "Custom list of queries to test. If omitted, queries are auto-generated from your site content."
    ),
  auto_generate: z
    .boolean()
    .optional()
    .default(true)
    .describe("Auto-generate additional queries from site content"),
});

export type VisibilityReportInput = z.infer<typeof visibilityReportSchema>;

export async function visibilityReportTool(
  input: VisibilityReportInput
): Promise<string> {
  const { url, queries: customQueries, auto_generate } = input;

  const domain = normalizeDomain(url);

  // Gather queries
  let queries: string[] = customQueries ?? [];

  if (auto_generate || queries.length === 0) {
    let pages: CrawledPage[];
    try {
      pages = await crawlSite(url, 5);
    } catch {
      pages = [];
    }
    const autoQueries = generateTestPrompts(pages, [], 10);
    queries = [...new Set([...queries, ...autoQueries])].slice(0, 15);
  }

  // Run visibility checks
  const rankings = await Promise.all(
    queries.map(async (q) => {
      const result = await rateLimitedCheckVisibility(q, url);
      return {
        prompt: q,
        isVisible: result.isVisible,
        citationPosition: result.citationPosition,
        aiResponseSnippet: result.aiResponseSnippet,
        allCitations: result.allCitations,
      };
    })
  );

  const visibleCount = rankings.filter((r) => r.isVisible).length;
  const visibilityRate = rankings.length
    ? visibleCount / rankings.length
    : 0;

  const report: VisibilityReport = {
    url,
    domain,
    totalPromptsTested: rankings.length,
    visibleCount,
    visibilityRate,
    rankings,
    topPerformingPrompts: rankings
      .filter((r) => r.isVisible)
      .sort(
        (a, b) =>
          (a.citationPosition ?? 999) - (b.citationPosition ?? 999)
      )
      .map((r) => r.prompt),
    missedOpportunityPrompts: rankings
      .filter((r) => !r.isVisible)
      .map((r) => r.prompt),
    generatedAt: new Date().toISOString(),
  };

  // Format output
  const pct = Math.round(visibilityRate * 100);
  const grade =
    pct >= 70 ? "Excellent" : pct >= 40 ? "Good" : pct >= 20 ? "Fair" : "Poor";

  const lines: string[] = [
    `# AI Visibility Report`,
    `**Site:** ${url}  |  **Domain:** ${domain}`,
    `**Generated:** ${report.generatedAt}`,
    "",
    `## Summary`,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Visibility Rate | **${pct}%** (${grade}) |`,
    `| Queries Tested | ${report.totalPromptsTested} |`,
    `| Visible For | ${visibleCount} queries |`,
    `| Not Visible | ${report.totalPromptsTested - visibleCount} queries |`,
    "",
  ];

  if (report.topPerformingPrompts.length > 0) {
    lines.push("## ✅ Ranking Queries (your site appears here)");
    lines.push("");
    const visible = rankings.filter((r) => r.isVisible);
    for (const r of visible) {
      lines.push(`**#${r.citationPosition} — "${r.prompt}"**`);
      if (r.allCitations.length > 0) {
        lines.push(
          `Other citations: ${r.allCitations.slice(0, 3).join(", ")}`
        );
      }
      lines.push("");
    }
  }

  if (report.missedOpportunityPrompts.length > 0) {
    lines.push("## 🎯 Missed Opportunities (not visible for these)");
    lines.push("");
    const missed = rankings.filter((r) => !r.isVisible);
    for (const r of missed.slice(0, 8)) {
      const top = r.allCitations[0] ?? "unknown";
      lines.push(`- **"${r.prompt}"** → ${top} ranked instead`);
    }
    lines.push("");
  }

  lines.push("## Recommendations");
  if (pct < 20) {
    lines.push(
      "- Your AI visibility is very low. Start with AEO analysis (`analyze_website_aeo`) to find structural issues."
    );
  }
  if (report.missedOpportunityPrompts.length > 0) {
    lines.push(
      `- Create dedicated content pages targeting your missed queries.`
    );
    lines.push(
      `- Add FAQ sections with exact question phrasing matching these queries.`
    );
  }
  if (visibleCount > 0) {
    lines.push(
      `- Reinforce your ranking queries by linking to those pages internally and building backlinks.`
    );
  }

  return lines.join("\n");
}
