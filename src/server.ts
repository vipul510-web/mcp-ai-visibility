import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  analyzeWebsiteSchema,
  analyzeWebsiteTool,
} from "./tools/analyze-website.js";
import {
  checkVisibilitySchema,
  checkVisibilityTool,
} from "./tools/check-visibility.js";
import {
  discoverPromptsSchema,
  discoverPromptsTool,
} from "./tools/discover-prompts.js";
import {
  visibilityReportSchema,
  visibilityReportTool,
} from "./tools/visibility-report.js";
import {
  competitorAnalysisSchema,
  competitorAnalysisTool,
} from "./tools/competitor-analysis.js";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "aeo-visibility",
    version: "1.0.0",
  });

  // -------------------------------------------------------------------------
  // Tool 1: Analyze Website AEO
  // -------------------------------------------------------------------------
  server.tool(
    "analyze_website_aeo",
    `Crawl a website and score it for AEO (Answer Engine Optimization) — how well it's structured for AI assistants to discover and cite it.

Returns a 100-point score across 8 signals: structured data, FAQ content, content clarity, E-E-A-T, citations, content depth, meta information, and internal linking. Includes specific recommendations for improvement.

Example use: "Analyze https://sellonllm.com for AEO"`,
    analyzeWebsiteSchema.shape,
    async (args) => {
      const result = await analyzeWebsiteTool(
        analyzeWebsiteSchema.parse(args)
      );
      return { content: [{ type: "text", text: result }] };
    }
  );

  // -------------------------------------------------------------------------
  // Tool 2: Check AI Visibility for a Specific Query
  // -------------------------------------------------------------------------
  server.tool(
    "check_ai_visibility",
    `Check whether a website is cited/visible when an AI assistant (Claude, ChatGPT, Perplexity) answers a specific user query.

Uses Perplexity's web-search AI to test the query and check if the target domain appears in the citations. Returns: visible (yes/no), citation position, context, and which competitors ranked instead.

Example use: "Does https://sellonllm.com appear when someone asks 'best tools for selling on Amazon'?"`,
    checkVisibilitySchema.shape,
    async (args) => {
      const result = await checkVisibilityTool(
        checkVisibilitySchema.parse(args)
      );
      return { content: [{ type: "text", text: result }] };
    }
  );

  // -------------------------------------------------------------------------
  // Tool 3: Discover Which Prompts Make Your Site Rank
  // -------------------------------------------------------------------------
  server.tool(
    "discover_ranking_prompts",
    `Automatically discover which user prompts/queries cause your website to appear in AI responses.

Crawls your site to understand its content, generates relevant test prompts, then checks each one against AI search. Returns a ranked list of prompts where you're visible and a list of missed opportunities.

Example use: "What prompts does https://sellonllm.com rank for in AI?" or "Find prompts for my e-commerce site"`,
    discoverPromptsSchema.shape,
    async (args) => {
      const result = await discoverPromptsTool(
        discoverPromptsSchema.parse(args)
      );
      return { content: [{ type: "text", text: result }] };
    }
  );

  // -------------------------------------------------------------------------
  // Tool 4: Full Visibility Report
  // -------------------------------------------------------------------------
  server.tool(
    "get_visibility_report",
    `Generate a comprehensive AI visibility report for a website across multiple queries.

Optionally provide your own list of queries, or let the tool auto-generate them from your site content. Returns a full breakdown: visibility rate, which queries rank, missed opportunities, and recommendations.

Example use: "Give me a full visibility report for https://sellonllm.com" or provide custom queries like ["how to sell on LLMs", "AI commerce tools"]`,
    visibilityReportSchema.shape,
    async (args) => {
      const result = await visibilityReportTool(
        visibilityReportSchema.parse(args)
      );
      return { content: [{ type: "text", text: result }] };
    }
  );

  // -------------------------------------------------------------------------
  // Tool 5: Competitor Visibility Comparison
  // -------------------------------------------------------------------------
  server.tool(
    "compare_competitor_visibility",
    `Compare your website's AI visibility against competitors for a set of queries.

For each query, shows which sites get cited by AI and which don't — revealing where competitors are beating you and where you have an advantage.

Example use: "Compare my site https://sellonllm.com against https://competitor1.com and https://competitor2.com for queries about 'selling on AI platforms'"`,
    competitorAnalysisSchema.shape,
    async (args) => {
      const result = await competitorAnalysisTool(
        competitorAnalysisSchema.parse(args)
      );
      return { content: [{ type: "text", text: result }] };
    }
  );

  return server;
}
