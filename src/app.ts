/**
 * AEO Visibility MCP — Express app (Vercel-compatible, no listen() here)
 *
 * Exported so Vercel can wrap it as a serverless function.
 * For local dev, src/http.ts imports this and calls app.listen().
 *
 * MCP sessions run in stateless mode: each POST /mcp creates a fresh
 * server+transport pair that is discarded after the response. This is
 * required for Vercel (no shared memory between invocations).
 */

import express, { type Request, type Response, type NextFunction } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./server.js";
import { analyzeWebsiteSchema, analyzeWebsiteTool } from "./tools/analyze-website.js";
import { checkVisibilitySchema, checkVisibilityTool } from "./tools/check-visibility.js";
import { discoverPromptsSchema, discoverPromptsTool } from "./tools/discover-prompts.js";
import { visibilityReportSchema, visibilityReportTool } from "./tools/visibility-report.js";
import { competitorAnalysisSchema, competitorAnalysisTool } from "./tools/competitor-analysis.js";
import { isApiKeyValid, recordApiKeyUsage } from "./db/api-keys.js";

// ---------------------------------------------------------------------------
// Auth middleware
// Falls back to VALID_API_KEYS env var if DB is not configured.
// ---------------------------------------------------------------------------

async function requireApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const provided =
    (req.headers["x-api-key"] as string | undefined) ??
    (req.query["api_key"] as string | undefined) ??
    "";

  const valid = await isApiKeyValid(provided);

  if (!valid) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Provide your API key in the x-api-key header. Get a key at https://sellonllm.com",
    });
    return;
  }

  // Fire-and-forget usage log (don't block the request)
  if (provided) {
    recordApiKeyUsage(provided, req.path).catch(() => {});
  }

  next();
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json({ limit: "1mb" }));

// CORS — allow any origin so Claude.ai and ChatGPT can reach the hosted MCP
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key, mcp-session-id");
  if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

// Health check (no auth)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "aeo-visibility-mcp", version: "1.0.0" });
});

// Service manifest (for discovery)
app.get("/", (_req, res) => {
  res.json({
    name: "AEO Visibility MCP",
    description: "Analyze your website's AI visibility and AEO score.",
    version: "1.0.0",
    provider: "sellonllm.com",
    mcpEndpoint: "/mcp",
    restEndpoint: "/api",
    docs: "https://sellonllm.com/mcp-docs",
    auth: { type: "apiKey", header: "x-api-key", signup: "https://sellonllm.com" },
    tools: [
      "analyze_website_aeo",
      "check_ai_visibility",
      "discover_ranking_prompts",
      "get_visibility_report",
      "compare_competitor_visibility",
    ],
  });
});

// ---------------------------------------------------------------------------
// MCP Streamable HTTP — stateless per-request (required for Vercel)
// Each POST creates its own server+transport, handles the request, then done.
// ---------------------------------------------------------------------------

app.post("/mcp", requireApiKey, async (req: Request, res: Response) => {
  try {
    // sessionIdGenerator: undefined → stateless mode, no session persistence
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const server = createMcpServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    // transport & server are GC'd after res.end()
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: String(err) });
  }
});

// GET /mcp → SSE streaming (not supported in stateless mode)
app.get("/mcp", (_req, res) => {
  res.status(405).json({
    error: "SSE streaming not supported in stateless mode. Use POST /mcp for tool calls.",
  });
});

app.delete("/mcp", (_req, res) => {
  res.status(200).json({ message: "ok" });
});

// ---------------------------------------------------------------------------
// REST API — mirrors the MCP tools for ChatGPT custom GPTs / HTTP clients
// ---------------------------------------------------------------------------

app.post("/api/analyze", requireApiKey, async (req: Request, res: Response) => {
  const parsed = analyzeWebsiteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json({ result: await analyzeWebsiteTool(parsed.data) });
});

app.post("/api/check-visibility", requireApiKey, async (req: Request, res: Response) => {
  const parsed = checkVisibilitySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json({ result: await checkVisibilityTool(parsed.data) });
});

app.post("/api/discover-prompts", requireApiKey, async (req: Request, res: Response) => {
  const parsed = discoverPromptsSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json({ result: await discoverPromptsTool(parsed.data) });
});

app.post("/api/visibility-report", requireApiKey, async (req: Request, res: Response) => {
  const parsed = visibilityReportSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json({ result: await visibilityReportTool(parsed.data) });
});

app.post("/api/competitor-analysis", requireApiKey, async (req: Request, res: Response) => {
  const parsed = competitorAnalysisSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json({ result: await competitorAnalysisTool(parsed.data) });
});

// OpenAI schema for ChatGPT custom GPT actions
app.get("/api/openai-schema", (_req, res) => {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://mcp.sellonllm.com";

  res.json({
    openapi: "3.1.0",
    info: { title: "AEO Visibility API", description: "Analyze website AI visibility", version: "1.0.0" },
    servers: [{ url: baseUrl }],
    paths: {
      "/api/analyze": {
        post: {
          operationId: "analyzeWebsiteAEO",
          summary: "Analyze a website's AEO score (0-100)",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["url"], properties: {
              url: { type: "string" }, max_pages: { type: "integer", default: 5 },
            }}}},
          },
          responses: { "200": { description: "AEO analysis", content: { "application/json": { schema: { type: "object", properties: { result: { type: "string" } } } } } } },
        },
      },
      "/api/check-visibility": {
        post: {
          operationId: "checkAIVisibility",
          summary: "Check if a site is cited by AI for a query",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["url", "query"], properties: {
              url: { type: "string" }, query: { type: "string" },
            }}}},
          },
          responses: { "200": { description: "Visibility result", content: { "application/json": { schema: { type: "object", properties: { result: { type: "string" } } } } } } },
        },
      },
      "/api/discover-prompts": {
        post: {
          operationId: "discoverRankingPrompts",
          summary: "Find which prompts make a site visible in AI",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["url"], properties: {
              url: { type: "string" }, industry: { type: "string" }, max_prompts: { type: "integer", default: 10 },
            }}}},
          },
          responses: { "200": { description: "Prompt rankings", content: { "application/json": { schema: { type: "object", properties: { result: { type: "string" } } } } } } },
        },
      },
    },
  });
});

export default app;
