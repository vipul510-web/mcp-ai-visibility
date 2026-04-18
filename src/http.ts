/**
 * AEO Visibility MCP — HTTP server entry point
 *
 * Exposes the MCP server over HTTP (Streamable HTTP transport) so it can be
 * used as a remote MCP by:
 *   - Claude.ai (Settings → Integrations → Add MCP server)
 *   - Any MCP-compatible client
 *
 * Also exposes a REST API at /api/* for use with ChatGPT custom GPTs or
 * any HTTP client (OpenAI function calling, Zapier, etc.)
 *
 * Auth: pass your API key in the `x-api-key` header.
 * Get an API key at https://sellonllm.com
 */

import express, { type Request, type Response, type NextFunction } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createMcpServer } from "./server.js";
import { analyzeWebsiteSchema, analyzeWebsiteTool } from "./tools/analyze-website.js";
import { checkVisibilitySchema, checkVisibilityTool } from "./tools/check-visibility.js";
import { discoverPromptsSchema, discoverPromptsTool } from "./tools/discover-prompts.js";
import { visibilityReportSchema, visibilityReportTool } from "./tools/visibility-report.js";
import { competitorAnalysisSchema, competitorAnalysisTool } from "./tools/competitor-analysis.js";

const PORT = parseInt(process.env.PORT ?? "3000");

// ---------------------------------------------------------------------------
// API key validation
// ---------------------------------------------------------------------------

function getValidApiKeys(): Set<string> {
  const raw = process.env.VALID_API_KEYS ?? "";
  return new Set(
    raw
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
  );
}

function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const validKeys = getValidApiKeys();

  // No keys configured → open access (dev mode)
  if (validKeys.size === 0) {
    next();
    return;
  }

  const provided =
    req.headers["x-api-key"] as string ??
    (req.query["api_key"] as string) ??
    "";

  if (!provided || !validKeys.has(provided)) {
    res.status(401).json({
      error: "Unauthorized",
      message:
        "Provide your API key in the x-api-key header. Get a key at https://sellonllm.com",
    });
    return;
  }

  next();
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());

// Health check (no auth required)
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "aeo-visibility-mcp",
    version: "1.0.0",
    transport: ["mcp-streamable-http", "rest-api"],
  });
});

// MCP manifest (for discovery)
app.get("/", (_req, res) => {
  res.json({
    name: "AEO Visibility MCP",
    description:
      "Analyze your website's AI visibility and AEO score. Find out which user prompts your site ranks for on AI platforms like Claude and ChatGPT.",
    version: "1.0.0",
    provider: "sellonllm.com",
    mcpEndpoint: "/mcp",
    restEndpoint: "/api",
    docs: "https://sellonllm.com/mcp-docs",
    auth: {
      type: "apiKey",
      header: "x-api-key",
      signup: "https://sellonllm.com",
    },
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
// MCP Streamable HTTP transport
// Stateless per-request — each POST creates a fresh server+transport pair.
// ---------------------------------------------------------------------------

const mcpTransports: Map<string, StreamableHTTPServerTransport> = new Map();

app.post("/mcp", requireApiKey, async (req: Request, res: Response) => {
  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    let transport = sessionId ? mcpTransports.get(sessionId) : undefined;

    if (!transport) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () =>
          `session_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        onsessioninitialized: (id) => {
          mcpTransports.set(id, transport!);
          // clean up after 10 minutes of inactivity
          setTimeout(() => mcpTransports.delete(id), 10 * 60 * 1000);
        },
      });

      const server = createMcpServer();
      await server.connect(transport);
    }

    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: String(err) });
    }
  }
});

app.get("/mcp", requireApiKey, async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const transport = sessionId ? mcpTransports.get(sessionId) : undefined;

  if (!transport) {
    res.status(400).json({ error: "No active session. POST to /mcp first." });
    return;
  }

  await transport.handleRequest(req, res);
});

app.delete("/mcp", requireApiKey, async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const transport = sessionId ? mcpTransports.get(sessionId) : undefined;

  if (transport) {
    await transport.handleRequest(req, res);
    if (sessionId) mcpTransports.delete(sessionId);
  } else {
    res.status(200).json({ message: "No session to close" });
  }
});

// ---------------------------------------------------------------------------
// REST API — for ChatGPT custom GPTs and OpenAI function calling
// Each endpoint mirrors an MCP tool.
// ---------------------------------------------------------------------------

app.post(
  "/api/analyze",
  requireApiKey,
  async (req: Request, res: Response) => {
    const parsed = analyzeWebsiteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const result = await analyzeWebsiteTool(parsed.data);
    res.json({ result });
  }
);

app.post(
  "/api/check-visibility",
  requireApiKey,
  async (req: Request, res: Response) => {
    const parsed = checkVisibilitySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const result = await checkVisibilityTool(parsed.data);
    res.json({ result });
  }
);

app.post(
  "/api/discover-prompts",
  requireApiKey,
  async (req: Request, res: Response) => {
    const parsed = discoverPromptsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const result = await discoverPromptsTool(parsed.data);
    res.json({ result });
  }
);

app.post(
  "/api/visibility-report",
  requireApiKey,
  async (req: Request, res: Response) => {
    const parsed = visibilityReportSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const result = await visibilityReportTool(parsed.data);
    res.json({ result });
  }
);

app.post(
  "/api/competitor-analysis",
  requireApiKey,
  async (req: Request, res: Response) => {
    const parsed = competitorAnalysisSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const result = await competitorAnalysisTool(parsed.data);
    res.json({ result });
  }
);

// OpenAI-compatible function schema endpoint (for ChatGPT custom GPT actions)
app.get("/api/openai-schema", (_req, res) => {
  res.json({
    openapi: "3.1.0",
    info: {
      title: "AEO Visibility API",
      description: "Analyze website AI visibility and AEO scores",
      version: "1.0.0",
    },
    servers: [{ url: `https://your-domain.com` }],
    paths: {
      "/api/analyze": {
        post: {
          operationId: "analyzeWebsiteAEO",
          summary: "Analyze a website's AEO score",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["url"],
                  properties: {
                    url: { type: "string", description: "Website URL" },
                    max_pages: {
                      type: "integer",
                      default: 5,
                      description: "Pages to crawl",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "AEO analysis result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { result: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      },
      "/api/check-visibility": {
        post: {
          operationId: "checkAIVisibility",
          summary: "Check if a website appears in AI responses for a query",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["url", "query"],
                  properties: {
                    url: { type: "string" },
                    query: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Visibility check result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { result: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  process.stdout.write(
    `AEO Visibility MCP running on http://localhost:${PORT}\n` +
      `  MCP endpoint:  http://localhost:${PORT}/mcp\n` +
      `  REST endpoint: http://localhost:${PORT}/api\n` +
      `  Health check:  http://localhost:${PORT}/health\n`
  );
});
