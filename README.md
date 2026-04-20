# SellOnLLM

**SEO you can measure → AEO & GEO you can win.**  
Marketing site, audits, **Chat with GA4 + Google Search Console**, **two Claude MCP connectors**, Shopify app integration, and supporting tools.

Live site: **[sellonllm.com](https://www.sellonllm.com)** (use `www` in production for OAuth consistency).

---

## Claude MCP connectors (discoverability hub)

SellOnLLM hosts **two** [Model Context Protocol](https://modelcontextprotocol.io) servers for [Claude](https://claude.ai) **Settings → Connectors → Add custom connector**. Same Google sign-in; **different server URLs** and **different tools**.

| Connector | Server URL (paste in Claude) | Public setup page |
|-----------|------------------------------|-------------------|
| **Analytics** — GA4 + GSC | `https://www.sellonllm.com/api/mcp` | [GA + GSC MCP for Claude](https://www.sellonllm.com/google-analytics-mcp-claude.html) |
| **AI visibility** — AEO crawl + Perplexity tools | `https://www.sellonllm.com/api/mcp-ai-visibility` | [AI Visibility MCP for Claude](https://www.sellonllm.com/ai-visibility-mcp-claude.html) |

**Perplexity API key:** enter it only on the **[AI Visibility setup page](https://www.sellonllm.com/ai-visibility-mcp-claude.html)** (after Google sign-in). Used for citation-style tools; `analyze_website_aeo` does **not** require Perplexity.

| Doc | What it is |
|-----|------------|
| **[GitHub: vipul510-web/mcp-ai-visibility](https://github.com/vipul510-web/mcp-ai-visibility)** | Public repo for issues, stars, and MCP discoverability |
| **[`docs/MCP_CONNECTORS.md`](docs/MCP_CONNECTORS.md)** | Short hub (tables + links) |
| **[`MCP_CLAUDE_SETUP.md`](MCP_CLAUDE_SETUP.md)** | Operators: endpoints, env vars, JWT audiences, curl, deploy |
| **[`mcp-ga-gsc-seo/README.md`](mcp-ga-gsc-seo/README.md)** | Overview, use cases, architecture (synced with docs on GitHub) |
| **[`mcp-ga-gsc-seo/docs/`](mcp-ga-gsc-seo/docs/)** | Prompts, tools, **[`AI_VISIBILITY.md`](mcp-ga-gsc-seo/docs/AI_VISIBILITY.md)**, security, troubleshooting |

### Use cases at a glance

**Analytics MCP**

- Weekly organic health: sessions, landing pages, top queries, week-over-week deltas.
- CTR rescue: high impressions, weak CTR → title/meta variants grounded in GSC.
- “Almost page one” sprints: positions ~4–15, content and internal linking plans.
- Post-release checks: GA4 landing-page losses paired with GSC impression/position moves.
- Stakeholder summaries in plain language with numbers from *your* properties.

**AI visibility MCP**

- AEO readiness: schema, FAQ coverage, depth, trust signals from a live crawl.
- Prompt-level checks: is your domain cited for specific buyer questions?
- Auto-generated test prompts from your site copy; gap list for editorial.
- Competitor comparison on the same small set of strategic prompts.

### Quick test

1. Add the connector URL in Claude → Connect → Google → Allow.  
2. **Analytics:** *“List my GA4 properties and GSC sites, then a 28-day snapshot.”*  
3. **AI visibility:** *“Run analyze_website_aeo on https://example.com”* (no Perplexity key).  
4. Add Perplexity on the [AI Visibility page](https://www.sellonllm.com/ai-visibility-mcp-claude.html), then try `check_ai_visibility` via natural language or **`/` → `ai_visibility_pulse`**.

---

## Other products (same repo)

| Surface | Description |
|---------|-------------|
| **[Chat with GA + GSC](https://www.sellonllm.com/chat-with-google-analytics.html)** | Browser UI: Google OAuth + your LLM API key (Claude/OpenAI). Not MCP. |
| **Free LLM audit** | [`free-llm-audit.html`](free-llm-audit.html) + API |
| **LLM.txt generator** | [`llm-txt-generator.html`](llm-txt-generator.html) |
| **Chrome extension** | [`chrome-extension/`](chrome-extension/) |
| **Shopify** | Linked from homepage; AI-referred traffic attribution |

Setup for the web chat: **[`CHAT_WITH_GA_SETUP.md`](CHAT_WITH_GA_SETUP.md)**.

---

## Repository structure (high level)

```
sellonllm/
├── api/                          # Vercel serverless: unified app router
│   ├── app.js                    # Routes /api/* and /.well-known/*
│   └── _lib/                     # Auth, DB, Google, MCP, AEO/visibility
│       ├── routes/mcp/           # Analytics MCP + OAuth authorize/token/register
│       ├── routes/mcp-ai-visibility/
│       ├── routes/wellknown/     # oauth-protected-resource (per-resource), AS metadata
│       ├── aeo-visibility/       # Crawler, AEO scorer, Perplexity checks
│       └── ...
├── index.html                    # Homepage (nav + CTAs for both MCPs)
├── google-analytics-mcp-claude.html
├── ai-visibility-mcp-claude.html
├── chat-with-google-analytics.html
├── docs/
│   └── MCP_CONNECTORS.md         # MCP hub doc
├── mcp-ga-gsc-seo/               # Public docs for GitHub / community
│   ├── README.md
│   └── docs/                     # USE_CASES, AI_VISIBILITY, TOOLS, …
├── MCP_CLAUDE_SETUP.md           # Operator deep dive
├── vercel.json                   # Rewrites to api/app
├── package.json
└── css/, js/, images/, blog/, …
```

Legacy references in older guides to a single `api/audit.js` entrypoint are outdated; MCP and chat routes are handled by **`api/app.js`**.

---

## Local development

- **Static pages:** open `index.html` in a browser, or use any static server.
- **API + MCP:** requires Node, env vars (see **`MCP_CLAUDE_SETUP.md`**), and typically **`vercel dev`** for a faithful local `/api` experience.

Deploy:

```bash
vercel --prod
```

Use the Vercel project tied to **`PUBLIC_BASE_URL`** (production: `https://www.sellonllm.com`).

---

## Contributing

See **[`CONTRIBUTING.md`](CONTRIBUTING.md)** — documentation PRs for MCP are especially welcome under **`mcp-ga-gsc-seo/docs/`**.

---

## License & support

- **Repository:** proprietary unless individual subfolders state otherwise (e.g. **`mcp-ga-gsc-seo/LICENSE`** is MIT for that documentation package).
- **Support:** [Contact](https://www.sellonllm.com/contact-us.html) · [Privacy](https://www.sellonllm.com/privacy-policy.html)

---

### Suggested GitHub topics (root repo)

`seo` `aeo` `geo` `google-analytics` `ga4` `google-search-console` `claude` `mcp` `model-context-protocol` `llm` `ai-search` `ai-visibility` `perplexity` `vercel` `shopify`
