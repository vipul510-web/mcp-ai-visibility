# Claude MCP connectors — SellOnLLM

SellOnLLM exposes **two separate remote MCP servers** for Claude custom connectors:

1. **Analytics MCP** — `https://www.sellonllm.com/api/mcp` — Google Analytics 4 + Google Search Console tools only.
2. **AI visibility MCP** — `https://www.sellonllm.com/api/mcp-ai-visibility` — AEO site crawl + Perplexity Sonar citation tools (not GA/GSC).

They share the same Google sign-in and OAuth authorization server, but issue **different MCP access tokens** (different `aud` / resource). Add **one or both** URLs in Claude depending on what you need.

User-facing setup: [GA + GSC MCP](https://www.sellonllm.com/google-analytics-mcp-claude.html) and [AI visibility MCP](https://www.sellonllm.com/ai-visibility-mcp-claude.html).

**GitHub (issues, community):** [github.com/vipul510-web/mcp-ai-visibility](https://github.com/vipul510-web/mcp-ai-visibility)

## What was added

### New endpoints

| Endpoint | Purpose |
|---|---|
| `GET /.well-known/oauth-protected-resource` | MCP auth discovery (RFC 9728) |
| `GET /.well-known/oauth-authorization-server` | OAuth 2.1 server metadata (RFC 8414) |
| `POST /api/mcp/register` | Dynamic Client Registration (RFC 7591) — Claude registers automatically |
| `GET  /api/mcp/authorize` | OAuth authorize endpoint (shows consent screen; bounces through Google if needed) |
| `POST /api/mcp/token` | Issues access + refresh tokens (JWTs, 1 h / 30 d) |
| `POST /api/mcp` | Analytics MCP JSON-RPC (Streamable HTTP, stateless) |
| `POST /api/mcp-ai-visibility` | AI visibility MCP JSON-RPC (separate connector URL) |

### Analytics MCP — tools (`POST /api/mcp`)

| Tool | Purpose |
|---|---|
| `list_ga4_properties` | Enumerate the user's GA4 properties |
| `list_search_console_sites` | Enumerate the user's GSC sites |
| `get_seo_snapshot` | 28-day GA4 + GSC summary in one call |
| `query_ga4` | Flexible GA4 report (dimensions, metrics, date range) |
| `query_search_console` | Flexible GSC query |
| `find_ctr_opportunities` | High-impression / low-CTR queries |
| `find_ranking_opportunities` | Pages ranking 4–15 with room to grow |
| `get_traffic_deltas` | Last-N-days vs previous-N-days per page |

### Analytics MCP — prompts (`/` menu)

- `ctr_audit` — rewrite titles/metas for low-CTR queries
- `content_gaps` — suggest new content based on top queries/pages
- `rank_booster` — on-page fixes for position 4–15 pages
- `monthly_review` — complete monthly SEO report

### AI visibility MCP — tools (`POST /api/mcp-ai-visibility`)

| Tool | Purpose |
|---|---|
| `analyze_website_aeo` | Crawl a public URL and score AEO / AI-citability signals (schema, FAQ, depth, etc.) |
| `check_ai_visibility` | Perplexity citation check for one query vs one URL |
| `discover_ranking_prompts` | Generate prompts from the site, then test visibility (rate-limited) |
| `get_visibility_report` | Combined visibility report (custom + auto prompts; hosted caps apply) |
| `compare_competitor_visibility` | Compare your site vs competitors (hosted caps: up to 3 queries, 2 competitor URLs) |

### AI visibility MCP — prompts

- `aeo_site_audit` — crawl + AEO scorecard prompt
- `ai_visibility_pulse` — quick Perplexity citation checks for a few prompts

### Perplexity API key (AI visibility MCP only)

Perplexity-backed tools run with **the user’s own key** when saved (encrypted in `user_secrets`):

1. Sign in on SellOnLLM with the **same Google account** used for the **AI visibility** MCP connector.
2. Open **`https://www.sellonllm.com/ai-visibility-mcp-claude.html`** and save the key in the **Perplexity** section (or use the same `POST /api/user/api-key` with `provider: "perplexity"` from your own UI).

`analyze_website_aeo` only crawls HTML and does **not** need Perplexity.

**Optional operator override:** set `PERPLEXITY_API_KEY` on Vercel for a shared fallback when a user has not saved a personal key.

| Key | Purpose |
|-----|---------|
| `PERPLEXITY_API_KEY` | Optional server-wide fallback if the user has not saved a personal key |
| `PERPLEXITY_RPM` | Optional max Perplexity calls per minute **per user** within a serverless instance (default `8`) |
| `CRAWL_TIMEOUT_MS` | Optional per-page fetch timeout (default `10000`) |
| `MAX_CRAWL_PAGES` | Optional crawl breadth cap for internal crawler (default `10`; MCP tools clamp lower where needed) |

---

## Prerequisites

You already did these when setting up *Chat with GA*:
- Google Cloud project with Analytics Admin API, Analytics Data API, and Search Console API enabled
- OAuth 2.0 Web client with redirect URI `https://www.sellonllm.com/api/auth/google/callback` (add the apex `https://sellonllm.com/api/auth/google/callback` too if you redirect both hosts)
- Vercel env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `JWT_SECRET`, `ENCRYPTION_KEY`, `DATABASE_URL`

### New env var you should add (optional but recommended)

| Key | Value |
|---|---|
| `PUBLIC_BASE_URL` | `https://www.sellonllm.com` |

Set this to the **exact origin** users hit (production is **www**). If omitted, the Node fallback is `https://sellonllm.com` (apex only)—always set `PUBLIC_BASE_URL` on Vercel so `/.well-known` metadata and JWT issuers match **www**. Use a preview URL here when testing preview deployments.

---

## 1. Deploy

Commit and push — Vercel deploys automatically. On first request, three new tables are auto-created in Neon (`mcp_clients`, `mcp_auth_codes`, and the existing `users`/`user_connections` are reused).

Verify the two discovery endpoints return 200 JSON:

```bash
curl -s https://www.sellonllm.com/.well-known/oauth-protected-resource | jq
curl -s https://www.sellonllm.com/.well-known/oauth-authorization-server | jq
```

And that each MCP endpoint returns 401 + `WWW-Authenticate` (with `resource_metadata` pointing at the matching protected resource) when unauthenticated:

```bash
curl -i https://www.sellonllm.com/api/mcp
curl -i https://www.sellonllm.com/api/mcp-ai-visibility
# Expect:  HTTP/2 401  +  www-authenticate: Bearer realm="MCP", resource_metadata="https://www.sellonllm.com/.well-known/oauth-protected-resource?resource=..."
```

---

## 2. Add the connector(s) in Claude.ai

### Analytics (GA4 + GSC)

1. Go to **claude.ai** → **Settings → Connectors** (Team/Enterprise: **Organization settings → Connectors**).
2. Click **Add custom connector**.
3. **Server URL:** `https://www.sellonllm.com/api/mcp`
4. Click **Connect** → complete Google sign-in → **Allow** on the consent screen.

You should see **`sellonllm-analytics`** (or your deployment’s server name) in Connectors. Prompts: `ctr_audit`, `content_gaps`, `rank_booster`, `monthly_review`.

### AI visibility (AEO + Perplexity tools)

Repeat **Add custom connector** with **Server URL:** `https://www.sellonllm.com/api/mcp-ai-visibility`. Same Google account; token audience is the AI visibility resource only.

User saves Perplexity on **`https://www.sellonllm.com/ai-visibility-mcp-claude.html`** (same Google session). Prompts: `aeo_site_audit`, `ai_visibility_pulse`.

### Test queries

- *"What are my top 10 Search Console queries this month?"*
- *"Find my top CTR opportunities and rewrite the meta descriptions."*
- *"Which pages lost the most traffic vs the previous 28 days?"*
- Or hit `/` → pick **ctr_audit** or **monthly_review**.

Claude should call `list_ga4_properties` and `list_search_console_sites` on its own, pick an ID, and proceed.

### Copy/paste prompts (share these with users)

**Monthly SEO review (GA4 + GSC)**

```text
Using my connected GA4 and Google Search Console, create a monthly SEO review for the last 28 days vs the previous 28 days:

1) Executive summary (5 bullets)
2) Top 10 landing pages by organic sessions and their deltas
3) Top 10 Search Console queries by impressions and their deltas
4) Biggest CTR opportunities (high impressions, low CTR) with recommended title/meta rewrites
5) Biggest ranking opportunities (avg position 4–15) with specific on-page fixes
6) A prioritized action plan (impact × effort) for the next 2 weeks

If you need me to choose a GA4 property or GSC site, ask and list options first.
```

**CTR audit (titles + metas)**

```text
Using Google Search Console for the last 28 days, find my best CTR opportunities:

- queries with high impressions, CTR below site average, and average position between 1 and 12

For the top 15 opportunities:
1) show query, page, impressions, clicks, CTR, position
2) propose 3 title rewrites (≤ 60 chars)
3) propose 2 meta description rewrites (≤ 155 chars)
4) explain why each rewrite should improve CTR

Then summarize patterns (intent, wording, missing modifiers) and give 5 site-wide snippet guidelines.
```

**Traffic deltas (pages that dropped)**

```text
Using my GA4 property, identify the landing pages that lost the most organic sessions in the last 14 days vs the previous 14 days.

Return:
- top 20 pages by session loss (absolute and %)
- for each: sessions, engaged sessions, engagement rate, conversions (if available)

Then cross-check each page in Search Console:
- impressions/clicks/CTR/position deltas for the same periods

Explain likely causes (rank drop vs CTR vs demand vs tracking vs seasonality) and give a prioritized fix list.
```

**Rank booster (positions 4–15)**

```text
Using Google Search Console, find pages with strong impressions and average position between 4 and 15 over the last 28 days.

For the top 10 pages (by impressions):
1) list top queries and their positions/CTR
2) recommend on-page improvements (heading structure, internal links, missing sections, schema, FAQs)
3) provide a short content brief per page (outline + key points)

Finish with a recommended internal linking plan (which pages should link to which, with suggested anchor text patterns).
```

---

## 3. Testing before Claude (optional but useful)

### Using the official MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

Enter `https://www.sellonllm.com/api/mcp` or `https://www.sellonllm.com/api/mcp-ai-visibility` as the server URL, choose **Streamable HTTP**, and walk through the OAuth flow. You'll see every JSON-RPC call and response.

### Using `mcp-remote` locally for dev

```bash
# From Claude Desktop's claude_desktop_config.json (add one or both):
{
  "mcpServers": {
    "sellonllm-analytics": {
      "command": "npx",
      "args": ["mcp-remote", "https://www.sellonllm.com/api/mcp"]
    },
    "sellonllm-ai-visibility": {
      "command": "npx",
      "args": ["mcp-remote", "https://www.sellonllm.com/api/mcp-ai-visibility"]
    }
  }
}
```

---

## 4. How it works end-to-end

```
┌────────────────────┐  1. GET /api/mcp (no auth)
│                    │ ─────────────────────────────▶ ┌──────────────────────┐
│   claude.ai        │ ◀───── 401 + WWW-Authenticate   │  www.sellonllm.com    │
│                    │                                 │                       │
│                    │  2. GET /.well-known/...        │  Serves metadata      │
│                    │ ─────────────────────────────▶ │                       │
│                    │  3. POST /api/mcp/register      │  Creates mcp_client   │
│                    │ ─────────────────────────────▶ │                       │
│                    │  4. Open /api/mcp/authorize     │  ┌──> Google OAuth    │
│                    │ ─────────────────────────────▶ │  │    (first time)    │
│                    │                                 │  │    User signs in  │
│                    │                                 │  └──< refresh token  │
│                    │                                 │  Consent screen ▶Allow│
│                    │  5. ← 302 claude.ai/...?code=…  │                       │
│                    │ ◀───────────────────────────── │                       │
│                    │  6. POST /api/mcp/token         │  Verify PKCE +        │
│                    │    (code, code_verifier)        │  one-time use code   │
│                    │ ─────────────────────────────▶ │                       │
│                    │  ← access_token (JWT)           │                       │
│                    │ ◀───────────────────────────── │                       │
│                    │                                 │                       │
│                    │  7. POST /api/mcp with Bearer   │  Verify JWT           │
│                    │    JSON-RPC { tools/call }      │  Load user's Google   │
│                    │ ─────────────────────────────▶ │  refresh token,       │
│                    │  ← tool result                  │  call GA/GSC, return │
└────────────────────┘                                 └──────────────────────┘
```

The key insight: Claude holds **our** access token, not the user's Google token. Google credentials never leave our server.

---

## 5. Security model

- MCP access tokens are JWTs signed with `JWT_SECRET`, scoped to the MCP **resource** audience (`${PUBLIC_BASE_URL}/api/mcp` **or** `${PUBLIC_BASE_URL}/api/mcp-ai-visibility`), 1-hour TTL.
- Refresh tokens are 30-day JWTs with the same audience as the connector that issued them.
- Google refresh tokens remain encrypted (AES-256-GCM with `ENCRYPTION_KEY`) in `user_connections` and are never returned to Claude.
- PKCE S256 is enforced on every authorization code exchange.
- Authorization codes are single-use and expire after 5 minutes.
- Only read-only Google scopes are requested (`analytics.readonly`, `webmasters.readonly`).
- Revoking access: the user can remove the connector in Claude at any time (tokens become unused), and can also revoke sellonllm at https://myaccount.google.com/permissions.

---

## 6. Gotchas

- **Google OAuth verification** — while your OAuth app is in **Testing** mode, only users you list as test users can connect. For public launch, submit the sensitive scopes for Google verification (2–6 weeks).
- **Claude Free tier** is limited to **1 custom connector** per user. Paid tiers can add many.
- **Preview deployments** — when testing on a Vercel preview URL, set `PUBLIC_BASE_URL` for that environment, and add a matching redirect URI to your Google OAuth client.
- **"Authorization failed" in Claude settings** — some users see this even when the connection works. Try asking a question; if tools run, it's the known UI bug tracked at [anthropics/claude-ai-mcp#132](https://github.com/anthropics/claude-ai-mcp/issues/132).
- **Batch limits** — Claude batches tool calls; if a user asks a very broad question the server may be called many times. All tools cap row counts to reasonable defaults.

---

## 7. What to send users

Short user-facing message you can post on the site or email:

> **SellOnLLM has two Claude MCP connectors.**
>
> **Analytics:** claude.ai → Settings → Connectors → Add custom connector → `https://www.sellonllm.com/api/mcp` → sign in with Google → Allow. Ask for GA4 + GSC grounded SEO help.
>
> **AI visibility (optional, separate):** Add another custom connector → `https://www.sellonllm.com/api/mcp-ai-visibility` → same Google sign-in. Save your Perplexity key on `https://www.sellonllm.com/ai-visibility-mcp-claude.html` for citation checks.
