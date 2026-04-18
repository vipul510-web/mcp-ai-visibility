import { z } from "zod";
import { rateLimitedCheckVisibility } from "../services/ai-checker.js";
import { normalizeDomain } from "../services/crawler.js";
import type { CompetitorComparison, CompetitorReport } from "../types.js";

export const competitorAnalysisSchema = z.object({
  your_url: z
    .string()
    .url()
    .describe("Your website URL"),
  competitor_urls: z
    .array(z.string().url())
    .min(1)
    .max(5)
    .describe("List of competitor URLs to compare against (up to 5)"),
  queries: z
    .array(z.string().min(5))
    .min(1)
    .max(10)
    .describe(
      "Queries to test visibility for (e.g. ['best e-commerce tools', 'how to sell on Amazon'])"
    ),
});

export type CompetitorAnalysisInput = z.infer<typeof competitorAnalysisSchema>;

export async function competitorAnalysisTool(
  input: CompetitorAnalysisInput
): Promise<string> {
  const { your_url, competitor_urls, queries } = input;

  const allUrls = [your_url, ...competitor_urls];
  const comparisons: CompetitorComparison[] = [];

  for (const query of queries) {
    const results = await Promise.all(
      allUrls.map(async (url) => {
        const r = await rateLimitedCheckVisibility(query, url);
        return {
          url,
          domain: normalizeDomain(url),
          isVisible: r.isVisible,
          citationPosition: r.citationPosition,
        };
      })
    );
    comparisons.push({ query, results });
  }

  // Compute visibility rates
  const yourDomain = normalizeDomain(your_url);
  const yourVisible = comparisons.filter((c) =>
    c.results.find((r) => r.domain === yourDomain)?.isVisible
  ).length;
  const yourVisibilityRate =
    queries.length > 0 ? yourVisible / queries.length : 0;

  const competitorRates = competitor_urls.map((cUrl) => {
    const cDomain = normalizeDomain(cUrl);
    const visible = comparisons.filter((c) =>
      c.results.find((r) => r.domain === cDomain)?.isVisible
    ).length;
    return {
      url: cUrl,
      domain: cDomain,
      rate: queries.length > 0 ? visible / queries.length : 0,
      visibleCount: visible,
    };
  });

  // Format report
  const lines: string[] = [
    `# Competitor AI Visibility Comparison`,
    `**Your site:** ${your_url}`,
    `**Queries tested:** ${queries.length}`,
    `**Generated:** ${new Date().toISOString()}`,
    "",
    `## Visibility Rate Summary`,
    "",
    `| Site | Visibility Rate | Visible For |`,
    `|------|----------------|-------------|`,
    `| **${yourDomain} (YOU)** | **${Math.round(yourVisibilityRate * 100)}%** | ${yourVisible}/${queries.length} |`,
  ];

  for (const c of competitorRates) {
    lines.push(
      `| ${c.domain} | ${Math.round(c.rate * 100)}% | ${c.visibleCount}/${queries.length} |`
    );
  }

  lines.push("");
  lines.push("## Query-by-Query Breakdown");
  lines.push("");

  for (const comp of comparisons) {
    lines.push(`### "${comp.query}"`);

    const sorted = [...comp.results].sort((a, b) => {
      if (a.isVisible && !b.isVisible) return -1;
      if (!a.isVisible && b.isVisible) return 1;
      return (a.citationPosition ?? 999) - (b.citationPosition ?? 999);
    });

    for (const r of sorted) {
      const isYou = r.domain === yourDomain;
      const icon = r.isVisible ? "✅" : "❌";
      const pos = r.citationPosition ? ` #${r.citationPosition}` : "";
      const you = isYou ? " **(YOU)**" : "";
      lines.push(`${icon} ${r.domain}${pos}${you}`);
    }
    lines.push("");
  }

  // Strategic insights
  lines.push("## Strategic Insights");
  lines.push("");

  const competitorsAhead = competitorRates.filter(
    (c) => c.rate > yourVisibilityRate
  );
  if (competitorsAhead.length > 0) {
    lines.push(
      `⚠️ **${competitorsAhead.length} competitor(s) have higher AI visibility than you:**`
    );
    for (const c of competitorsAhead) {
      lines.push(
        `   - ${c.domain}: ${Math.round(c.rate * 100)}% vs your ${Math.round(yourVisibilityRate * 100)}%`
      );
    }
    lines.push("");
  }

  // Find queries where competitors rank but you don't
  const lostQueries = comparisons.filter((c) => {
    const yours = c.results.find((r) => r.domain === yourDomain);
    const anyCompetitorVisible = c.results
      .filter((r) => r.domain !== yourDomain)
      .some((r) => r.isVisible);
    return !yours?.isVisible && anyCompetitorVisible;
  });

  if (lostQueries.length > 0) {
    lines.push(`🎯 **${lostQueries.length} queries where competitors rank but you don't:**`);
    for (const c of lostQueries) {
      lines.push(`   - "${c.query}"`);
    }
    lines.push("");
    lines.push(
      "💡 These are your highest-priority AEO opportunities — create targeted content for each."
    );
  }

  const wonQueries = comparisons.filter((c) => {
    const yours = c.results.find((r) => r.domain === yourDomain);
    return yours?.isVisible;
  });

  if (wonQueries.length > 0) {
    lines.push(
      `\n🏆 **You're visible for ${wonQueries.length} quer${wonQueries.length === 1 ? "y" : "ies"}:**`
    );
    for (const c of wonQueries) {
      lines.push(`   - "${c.query}"`);
    }
  }

  return lines.join("\n");
}
