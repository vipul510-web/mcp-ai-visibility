# mcp-ga-gsc-seo

**Remote [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server** so [Claude.ai](https://claude.ai) (and other MCP clients) can call **read-only** tools backed by **Google Analytics 4** and **Google Search Console** — with **OAuth 2.1**, **PKCE**, dynamic client registration, and encrypted token storage.

This repository is a **standalone, deployable slice** of the MCP stack used in production; you host it on your own domain (e.g. [Vercel](https://vercel.com) + [Neon](https://neon.tech)).

---

## Secrets, GitHub, and MCP marketplaces — what you can and cannot do

**Do not put SellOnLLM’s (or anyone’s) production secrets in this repo.** That includes:

- `GOOGLE_CLIENT_SECRET`
- `DATABASE_URL` (Neon)
- `JWT_SECRET`, `ENCRYPTION_KEY`
- Any API key or private key

A public GitHub repository is **world-readable**. Bots scrape commits for credentials. Once leaked, you must **rotate everything**: new OAuth client, new DB credentials, re-encrypt or invalidate stored tokens, and assume data exposure risk.

### How distribution actually works for MCP “marketplaces”

| Model | What you publish | Where secrets live |
|--------|-------------------|---------------------|
| **Hosted SaaS (SellOnLLM)** | The **HTTPS MCP URL** (e.g. `https://www.sellonllm.com/api/mcp`) + short setup docs | **Only** on your Vercel / Neon / Google Cloud consoles — never in git |
| **Open-source template** | This **code** + README + optional “Deploy to Vercel” | Each operator sets **their own** env vars in the host’s dashboard |
| **CI deploy** (optional) | Workflow YAML that references `secrets.*` in GitHub Actions | [GitHub encrypted secrets](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions) — still **not** in the repo files; only your pipeline can read them |

Marketplace listings (e.g. connector directories) expect a **server URL** or **install flow**, not embedded credentials. Users connect to **your deployment** and complete **Google OAuth** per user; your Neon row stores **per-user** encrypted refresh tokens.

### If your goal is “one product everyone uses”

Keep **one** production deployment (SellOnLLM). Distribute:

1. **Connector URL:** `https://www.sellonllm.com/api/mcp`
2. **This repo** as **documentation + optional self-host fork** for advanced users

That reuses **your** Google Cloud project, OAuth client, Neon, and secrets **only** in Vercel/Neon — never in the public tree.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvipul510-web%2Fmcp-ga-gsc-seo)

The button creates a **new** project for whoever clicks it; they still paste **their** env vars in Vercel (or use their own Google/Neon). It does **not** ship your secrets.

See [SECURITY.md](./SECURITY.md) for rotation and reporting basics.

---

## Will cloning this repo “just work” with Claude?

**Not by itself.** Claude needs a **public HTTPS URL** for your MCP server (e.g. `https://your-domain.com/api/mcp`). After you:

1. **Deploy** this project (Vercel is the path of least resistance — `vercel.json` is included).
2. Set **environment variables** (Google OAuth, JWT, encryption, Postgres/Neon, public origin).
3. Enable **Google Cloud APIs** and add the correct **OAuth redirect URI**,
4. Add **`https://your-domain.com/api/mcp`** as a **custom connector** in Claude,

…then **any user** who can hit your deployment can go through OAuth and use **their** GA4/GSC data (subject to your Google Cloud OAuth consent / verification settings).

Local `localhost` without a tunnel is **not** enough for Claude’s hosted connectors.

---

## Suggested GitHub metadata (searchability)

**Repository “About” description (short):**

> Remote MCP server for GA4 + Google Search Console — OAuth 2.1, PKCE, Claude custom connectors, Vercel + Neon.

**Topics / tags** (add under *Settings → General → Topics*):

`mcp` · `model-context-protocol` · `claude` · `google-analytics` · `ga4` · `google-search-console` · `gsc` · `seo` · `oauth2` · `pkce` · `vercel` · `neon` · `postgresql` · `analytics-api` · `search-console-api` · `ai-seo`

---

## Architecture (high level)

| Area | What happens |
|------|----------------|
| Discovery | `GET /.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server` |
| Registration | `POST /api/mcp/register` (RFC 7591-style dynamic client) |
| User login | Browser hits `GET /api/mcp/authorize` → optional bounce to `GET /api/auth/google` → Google → `GET /api/auth/google/callback` → session cookie |
| Token | `POST /api/mcp/token` exchanges auth code + PKCE for MCP JWT access/refresh tokens |
| MCP | `POST /api/mcp` — JSON-RPC tools (`list_ga4_properties`, `list_search_console_sites`, `query_ga4`, `query_search_console`, …) |

Google **refresh tokens** are stored **encrypted** in Postgres (`user_connections`). Claude only ever sees **your** short-lived MCP JWTs, not the user’s Google refresh token.

---

## Prerequisites

- **Google Cloud** project with **Analytics Admin API**, **Analytics Data API**, and **Search Console API** enabled.
- **OAuth 2.0 Client ID** (type: **Web application**).
- **Authorized redirect URI**:  
  `{PUBLIC_BASE_URL}/api/auth/google/callback`  
  (e.g. `https://www.example.com/api/auth/google/callback`).
- **Neon** (or any Postgres) database — schema is auto-created on first request (`CREATE TABLE IF NOT EXISTS`).

---

## Environment variables

Copy `.env.example` to `.env` locally (for experiments) or configure the same keys in **Vercel → Project → Settings → Environment Variables**.

| Variable | Required | Purpose |
|----------|----------|---------|
| `PUBLIC_BASE_URL` | **Yes** | Canonical `https://` origin (no trailing slash). Used in OAuth metadata and JWT issuer/audience. |
| `GOOGLE_CLIENT_ID` | **Yes** | OAuth web client ID. |
| `GOOGLE_CLIENT_SECRET` | **Yes** | OAuth web client secret. |
| `GOOGLE_REDIRECT_URI` | No* | Defaults to `{PUBLIC_BASE_URL}/api/auth/google/callback`. |
| `JWT_SECRET` | **Yes** | Signs MCP access/refresh tokens and browser session cookies. |
| `ENCRYPTION_KEY` | **Yes** | AES-256-GCM key material for Google refresh tokens at rest. |
| `DATABASE_URL` | **Yes** | Postgres connection string (Neon serverless driver). |
| `MCP_SERVER_DISPLAY_NAME` | No | Connector name in MCP `serverInfo` (default `mcp-ga-gsc-seo`). |
| `MCP_RESOURCE_DOCUMENTATION_URL` | No | Shown in protected-resource metadata (default `{PUBLIC_BASE_URL}/`). |
| `MCP_POST_OAUTH_FALLBACK_PATH` | No | If Google returns without `return_to` cookie (default `/`). |

---

## Deploy on Vercel

```bash
npm install
npx vercel
```

Link the project, set env vars for **Production** (and **Preview** if you use preview URLs — then set `PUBLIC_BASE_URL` per preview or use a stable staging host).

### Smoke tests

```bash
curl -sS "$PUBLIC_BASE_URL/.well-known/oauth-protected-resource" | jq .
curl -sS "$PUBLIC_BASE_URL/.well-known/oauth-authorization-server" | jq .
curl -i "$PUBLIC_BASE_URL/api/mcp"
# Expect 401 + WWW-Authenticate with resource_metadata URL
```

---

## Claude.ai custom connector

1. **Settings → Connectors → Add custom connector**
2. **Server URL:** `https://<your-domain>/api/mcp`
3. **Connect** → complete Google sign-in + in-app **Allow** on the consent screen.

Ensure the Google account has **Search Console** properties verified if you expect GSC tools to return data.

---

## Local development

This repo targets the **Vercel** request/response shape (`export default async function handler(req, res)`). For local iteration, use:

```bash
npm install
npx vercel dev
```

---

## Publish this folder as its own GitHub repository

From the machine that has this copy:

```bash
cd mcp-ga-gsc-seo
git init
git add -A
git commit -m "Initial commit: GA4 + GSC remote MCP for Claude"
git branch -M main
git remote add origin https://github.com/vipul510-web/mcp-ga-gsc-seo.git
git push -u origin main
```

If this directory currently lives **inside** another monorepo, either move `mcp-ga-gsc-seo/` out before `git init`, or use `git subtree split` / a one-off export so you do not nest two `.git` roots.

---

## Relationship to [SellOnLLM](https://www.sellonllm.com)

SellOnLLM ships a **full product** (web chat, Shopify, etc.) that includes the same MCP routes behind a larger router. **This repo** is the **MCP-only** server: fewer routes, neutral branding defaults, and stricter requirement for `PUBLIC_BASE_URL` so forks do not accidentally point at someone else’s domain.

---

## License

MIT — see [LICENSE](./LICENSE).
