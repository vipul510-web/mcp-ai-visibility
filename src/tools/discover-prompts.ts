import { z } from "zod";
import { crawlSite } from "../services/crawler.js";
import { generateTestPrompts, generateIndustryPrompts } from "../services/prompt-gen.js";
import { rateLimitedCheckVisibility } from "../services/ai-checker.js";
import type { CrawledPage, PromptRanking } from "../types.js";

export const discoverPromptsSchema = z.object({
  url: z
    .string()
    .url()
    .describe("Your website URL to test visibility for"),
  industry: z
    .string()
    .optional()
    .describe(
      "Your industry or niche (e.g. 'e-commerce', 'SaaS', 'fitness'). Helps generate better test prompts."
    ),
  max_prompts: z
    .number()
    .int()
    .min(3)
    .max(15)
    .optional()
    .default(10)
    .describe("Number of prompts to test (3–15, default 10)"),
});

export type DiscoverPromptsInput = z.infer<typeof discoverPromptsSchema>;

export async function discoverPromptsTool(
  input: DiscoverPromptsInput
): Promise<string> {
  const { url, industry, max_prompts } = input;

  // Step 1: Crawl site to understand its content
  let pages: CrawledPage[];
  try {
    pages = await crawlSite(url, 5);
  } catch {
    pages = [];
  }

  // Step 2: Generate test prompts
  const extraTopics = industry ? [industry] : [];
  const contentPrompts = generateTestPrompts(pages, extraTopics, max_prompts);
  const industryPrompts = industry
    ? generateIndustryPrompts(industry).slice(0, 5)
    : [];

  const allPrompts = [
    ...new Set([...contentPrompts, ...industryPrompts]),
  ].slice(0, max_prompts);

  if (allPrompts.length === 0) {
    return `❌ Could not generate prompts for ${url}. The site may not be publicly crawlable.`;
  }

  // Step 3: Test each prompt
  const rankings: PromptRanking[] = [];
  for (const prompt of allPrompts) {
    const result = await rateLimitedCheckVisibility(prompt, url);
    rankings.push({
      prompt,
      isVisible: result.isVisible,
      citationPosition: result.citationPosition,
      aiResponseSnippet: result.aiResponseSnippet,
      allCitations: result.allCitations,
    });
  }

  // Step 4: Format report
  const visible = rankings.filter((r) => r.isVisible);
  const missed = rankings.filter((r) => !r.isVisible);
  const visibilityRate =
    rankings.length > 0
      ? Math.round((visible.length / rankings.length) * 100)
      : 0;

  const lines: string[] = [
    `# Prompt Discovery Report: ${url}`,
    "",
    `**Visibility Rate: ${visibilityRate}% (${visible.length}/${rankings.length} prompts)**`,
    "",
  ];

  if (visible.length > 0) {
    lines.push("## ✅ Prompts where your site IS visible");
    lines.push("");
    for (const r of visible) {
      lines.push(
        `- **"${r.prompt}"** — Position #${r.citationPosition}`
      );
    }
    lines.push("");
  }

  if (missed.length > 0) {
    lines.push("## ❌ Prompts where your site is NOT visible (opportunities)");
    lines.push("");
    for (const r of missed.slice(0, 10)) {
      const topCompetitor = r.allCitations[0]
        ? ` (${r.allCitations[0]} ranked instead)`
        : "";
      lines.push(`- **"${r.prompt}"**${topCompetitor}`);
    }
    lines.push("");
    lines.push(
      "💡 **Tip:** Create content specifically targeting these prompts to improve your AI visibility."
    );
  }

  if (rankings[0]?.aiResponseSnippet?.includes("Cannot check")) {
    lines.push(
      "\n⚠️ **Note:** No AI API key configured. Set `PERPLEXITY_API_KEY` to get real visibility results."
    );
  }

  return lines.join("\n");
}
