# AEO Visibility MCP — Cursor Agent Guide

This is the backend for the AEO (Answer Engine Optimization) Visibility MCP at sellonllm.com.
It's a TypeScript Express server deployed on Vercel that exposes an MCP server + REST API
so anyone can connect their Claude or ChatGPT and analyze how visible their website is on AI platforms.

---

## Architecture

```
api/index.ts          ← Vercel serverless entry (just re-exports src/app.ts)
src/app.ts            ← Express app definition (no listen — Vercel wraps it)
src/http.ts           ← Local dev only: imports app.ts and calls listen()
src/index.ts          ← Claude Desktop stdio entry point
src/server.ts         ← MCP server with all 5 tools registered
src/types.ts          ← Shared TypeScript types
src/services/
  crawler.ts          ← Crawls websites with cheerio + axios
  aeo-analyzer.ts     ← Scores sites 0-100 on AEO signals
  ai-checker.ts       ← Calls Perplexity API to check if a site is cited
  prompt-gen.ts       ← Generates test queries from site content
src/tools/            ← One file per MCP tool (called by server.ts)
src/db/
  client.ts           ← Neon serverless SQL client (null if DATABASE_URL unset)
  api-keys.ts         ← API key validation + usage logging
vercel.json           ← Routes everything to api/index.ts, maxDuration 60s
schema.sql            ← DB migration (run once in Neon console)
```

---

## The 5 MCP Tools

| Tool | What it does |
|------|-------------|
| `analyze_website_aeo` | Crawls a site and returns an AEO score (0–100) with fixes |
| `check_ai_visibility` | Tests one query via Perplexity and checks if the site is cited |
| `discover_ranking_prompts` | Auto-generates queries from site content, tests them all |
| `get_visibility_report` | Full report across many queries with miss/win breakdown |
| `compare_competitor_visibility` | Head-to-head vs up to 5 competitors per query |

---

## Deploying to Vercel (step by step)

### 1. Import this repo into Vercel

- Go to vercel.com → New Project → Import Git Repository
- Select `vipul510-web/api`
- Framework preset: **Other** (not Next.js)
- Build command: `npm run build`
- Output directory: leave blank (Vercel uses `api/` automatically)
- Install command: `npm install`

### 2. Set environment variables in Vercel

Go to Project Settings → Environment Variables and add:

| Variable | Value | Required? |
|----------|-------|-----------|
| `DATABASE_URL` | Copy from your existing Neon project (same DB) | Yes (for API key auth) |
| `PERPLEXITY_API_KEY` | Get from perplexity.ai/settings/api | Yes (core feature) |
| `OPENAI_API_KEY` | OpenAI key (fallback if Perplexity fails) | Optional |
| `VALID_API_KEYS` | Comma-separated keys as fallback (skip if using DB) | Optional |

**DATABASE_URL** is the same connection string already in your other Vercel project.
Copy it from there — Settings → Environment Variables → DATABASE_URL.

### 3. Run the DB migration

Open your Neon console (console.neon.tech), select your existing database,
open the SQL editor, and paste + run the contents of `schema.sql`.
This adds two new tables (`aeo_api_keys`, `aeo_usage_logs`) without touching anything else.

### 4. Set a custom domain (optional but recommended)

In Vercel project settings → Domains, add `mcp.sellonllm.com`.
In your DNS (Namecheap/Cloudflare), add a CNAME: `mcp` → `cname.vercel-dns.com`

### 5. Deploy

Push to main or manually trigger a deploy. Vercel will:
- Run `npm install`
- Run `npm run build` (TypeScript → dist/)
- Deploy `api/index.ts` as a serverless function
- Route all requests to it via `vercel.json`

---

## Adding an API key for a user

Generate a key and insert it into the DB:

```bash
# 1. Generate the raw key (run locally)
node -e "const c=require('crypto'); console.log('aeo_' + c.randomBytes(24).toString('hex'))"
# → aeo_a1b2c3d4...  ← give this to the user

# 2. Hash it
node -e "const c=require('crypto'); const k='aeo_PASTE_KEY_HERE'; console.log(c.createHash('sha256').update(k).digest('hex'))"
# → abc123...  ← the hash to store

# 3. Insert into Neon (in the SQL editor)
INSERT INTO aeo_api_keys (key_hash, label, user_email)
VALUES ('abc123...', 'User name', 'user@email.com');
```

---

## How users connect

### Claude Desktop (local, via stdio)
```json
// ~/Library/Application Support/Claude/claude_desktop_config.json (Mac)
// %APPDATA%\Claude\claude_desktop_config.json (Windows)
{
  "mcpServers": {
    "aeo-visibility": {
      "command": "npx",
      "args": ["-y", "aeo-visibility-mcp"],
      "env": { "PERPLEXITY_API_KEY": "their-key" }
    }
  }
}
```

### Claude.ai (remote, via HTTP)
1. Go to Claude.ai → Settings → Integrations → Add MCP Server
2. URL: `https://mcp.sellonllm.com/mcp`
3. Header: `x-api-key: their-aeo-key`

### ChatGPT custom GPT
1. Create a custom GPT → Configure → Actions → Import from URL
2. URL: `https://mcp.sellonllm.com/api/openai-schema`
3. Add auth: API Key, header name `x-api-key`

---

## Local development

```bash
cp .env.example .env
# Fill in PERPLEXITY_API_KEY at minimum

npm install
npm run dev:http      # HTTP server on :3000
# OR
npm run dev           # stdio MCP (for Claude Desktop testing)
```

---

## Adding a new MCP tool

1. Create `src/tools/my-tool.ts` — export a zod schema and an async function
2. Import and register it in `src/server.ts` using `server.tool(...)`
3. Add a matching REST endpoint in `src/app.ts` under `/api/`
4. `npm run build` to verify TypeScript compiles clean

---

## Key constraints

- **Vercel serverless**: no in-memory state between requests. The MCP transport is stateless (a new one is created per POST /mcp). Do not add in-memory caches or session stores — use Neon or Vercel KV instead.
- **Function timeout**: set to 60s in `vercel.json`. Website crawling + Perplexity API calls can take 20-40s for larger sites.
- **Perplexity rate limit**: `PERPLEXITY_RPM` env var (default 10 RPM). The `rateLimitedCheckVisibility` function in `ai-checker.ts` enforces this.
