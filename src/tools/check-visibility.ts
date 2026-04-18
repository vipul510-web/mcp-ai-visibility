import { z } from "zod";
import {
  rateLimitedCheckVisibility,
  formatVisibilityResult,
} from "../services/ai-checker.js";

export const checkVisibilitySchema = z.object({
  url: z
    .string()
    .url()
    .describe("Your website URL (e.g. https://example.com)"),
  query: z
    .string()
    .min(5)
    .describe(
      "The user prompt / search query to test (e.g. 'best tools for selling on Amazon')"
    ),
});

export type CheckVisibilityInput = z.infer<typeof checkVisibilitySchema>;

export async function checkVisibilityTool(
  input: CheckVisibilityInput
): Promise<string> {
  const { url, query } = input;

  const result = await rateLimitedCheckVisibility(query, url);

  const lines: string[] = [
    `## AI Visibility Check`,
    `**Site:** ${url}`,
    `**Query:** "${query}"`,
    "",
    formatVisibilityResult(result),
    "",
  ];

  if (result.checkedVia === "mock") {
    lines.push(
      "⚠️ **Note:** No AI API key is configured. Set `PERPLEXITY_API_KEY` or `OPENAI_API_KEY` in your environment to get real visibility data."
    );
  } else {
    lines.push(
      result.isVisible
        ? `✅ Your site **was cited** by the AI when asked "${query}".`
        : `❌ Your site was **not cited** by the AI for this query. Consider optimizing your content for this topic.`
    );

    if (result.allCitations.length > 0) {
      lines.push("", "**Sites that were cited instead:**");
      result.allCitations.slice(0, 5).forEach((c, i) => {
        lines.push(`${i + 1}. ${c}`);
      });
    }
  }

  return lines.join("\n");
}
