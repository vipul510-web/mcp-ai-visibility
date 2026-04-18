# Claude MCP Connector — SellOnLLM Analytics

This turns SellOnLLM into a **remote MCP server** that users can add to claude.ai as a **Custom Connector**. Once connected, Claude can read the user's Google Analytics 4 and Google Search Console data directly and produce grounded SEO advice.

## What was added

### New endpoints

| Endpoint | Purpose |
|---|---|
| `GET /.well-known/oauth-protected-resource` | MCP auth discovery (RFC 9728) |
| `GET /.well-known/oauth-authorization-server` | OAuth 2.1 server metadata (RFC 8414) |
| `POST /api/mcp/register` | Dynamic Client Registration (RFC 7591) — Claude registers automatically |
| `GET  /api/mcp/authorize` | OAuth authorize endpoint (shows consent screen; bounces through Google if needed) |
| `POST /api/mcp/token` | Issues access + refresh tokens (JWTs, 1 h / 30 d) |
| `POST /api/mcp` | The MCP JSON-RPC endpoint itself (Streamable HTTP, stateless) |

### Tools exposed

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

### Prompts (one-click templates in Claude's `/` menu)

- `ctr_audit` — rewrite titles/metas for low-CTR queries
- `content_gaps` — suggest new content based on top queries/pages
- `rank_booster` — on-page fixes for position 4–15 pages
- `monthly_review` — complete monthly SEO report

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

And that the MCP endpoint returns 401 + `WWW-Authenticate` when unauthenticated:

```bash
curl -i https://www.sellonllm.com/api/mcp
# Expect:  HTTP/2 401
#          www-authenticate: Bearer realm="MCP", resource_metadata="https://www.sellonllm.com/.well-known/oauth-protected-resource"
```

---

## 2. Add the connector in Claude.ai

1. Go to **claude.ai** → **Settings → Connectors** (Team/Enterprise users: **Organization settings → Connectors**).
2. Click **Add custom connector**.
3. **Server URL:** `https://www.sellonllm.com/api/mcp`
4. Click **Connect**.
5. Claude opens a browser tab on **www.sellonllm.com** asking you to sign in with Google (if you haven't already).
6. Sign in → grant Analytics + Search Console read-only.
7. On the consent screen click **Allow**.
8. The tab closes automatically and Claude says **Connected**.

You should now see `sellonllm-analytics` in the Connectors list, and in any Claude chat you can type `/` to see the new prompts or just ask SEO questions.

### Test queries

- *"What are my top 10 Search Console queries this month?"*
- *"Find my top CTR opportunities and rewrite the meta descriptions."*
- *"Which pages lost the most traffic vs the previous 28 days?"*
- Or hit `/` → pick **ctr_audit** or **monthly_review**.

Claude should call `list_ga4_properties` and `list_search_console_sites` on its own, pick an ID, and proceed.

---

## 3. Testing before Claude (optional but useful)

### Using the official MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

Enter `https://www.sellonllm.com/api/mcp` as the server URL, choose **Streamable HTTP**, and walk through the OAuth flow. You'll see every JSON-RPC call and response.

### Using `mcp-remote` locally for dev

```bash
# From Claude Desktop's claude_desktop_config.json:
{
  "mcpServers": {
    "sellonllm": {
      "command": "npx",
      "args": ["mcp-remote", "https://www.sellonllm.com/api/mcp"]
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

- MCP access tokens are JWTs signed with `JWT_SECRET`, scoped to the MCP audience (`${PUBLIC_BASE_URL}/api/mcp`), 1-hour TTL.
- Refresh tokens are 30-day JWTs with the same audience.
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

> **SellOnLLM Analytics now plugs directly into Claude.**
>
> 1. Open claude.ai → Settings → Connectors → Add custom connector.
> 2. Paste `https://www.sellonllm.com/api/mcp`.
> 3. Sign in with Google, click Allow.
>
> Now you can ask Claude things like *"what are my biggest SEO opportunities this month?"* and it will read your real Analytics + Search Console data to answer.
