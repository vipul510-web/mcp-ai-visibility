# AI Visibility & AEO MCP (Claude)

**Hosted endpoint:** `https://www.sellonllm.com/api/mcp-ai-visibility`  

**GitHub:** [github.com/vipul510-web/mcp-ai-visibility](https://github.com/vipul510-web/mcp-ai-visibility) — source, issues, and community for this connector.

This is a **separate** SellOnLLM MCP server from the [Analytics MCP](./TOOLS.md) (`/api/mcp`). Add it as a **second** custom connector in Claude if you also use GA4 + Search Console tools—or use it alone if you only need AEO / citation workflows.

| Resource | Link |
|----------|------|
| Setup, copy URL, Perplexity BYOK | [ai-visibility-mcp-claude.html](https://www.sellonllm.com/ai-visibility-mcp-claude.html) |
| GA + GSC connector (different URL) | [google-analytics-mcp-claude.html](https://www.sellonllm.com/google-analytics-mcp-claude.html) |

---

## Why a second connector?

- **Clear product boundary** — Analytics questions stay on `/api/mcp`; AEO and Perplexity-backed visibility stay on `/api/mcp-ai-visibility`.
- **Token audience** — MCP access tokens are scoped to the resource you connected; each connector gets the right tool surface.
- **Claude Free** — only one custom connector on some plans; users choose analytics **or** AI visibility unless they upgrade.

---

## Quick start (Claude.ai)

1. **Settings → Connectors → Add custom connector**
2. **Server URL:** `https://www.sellonllm.com/api/mcp-ai-visibility`
3. **Connect** → Google sign-in → consent (same OAuth family as the analytics connector).
4. In chat, try **`/`** → **`aeo_site_audit`** or ask: *“Run analyze_website_aeo on https://example.com and summarize the top fixes.”*

---

## Perplexity API key (bring your own)

These tools call **Perplexity** with **your** API key (billing between you and Perplexity):

- `check_ai_visibility`
- `discover_ranking_prompts`
- `get_visibility_report`
- `compare_competitor_visibility`

**Where to save it:** open [AI Visibility MCP for Claude](https://www.sellonllm.com/ai-visibility-mcp-claude.html), sign in with the **same Google account** used for this MCP connector, paste a key from [Perplexity API settings](https://www.perplexity.ai/settings/api) (prefix `pplx-`), click **Save**.

**No key required for:** `analyze_website_aeo` (HTML crawl only).

**Optional server fallback:** operator can set `PERPLEXITY_API_KEY` on the host (e.g. Vercel) for users who have not saved a personal key. See [`MCP_CLAUDE_SETUP.md`](../../MCP_CLAUDE_SETUP.md) in the main repo.

---

## Tools (summary)

| Tool | What it does |
|------|----------------|
| `analyze_website_aeo` | Crawl public pages (hosted cap), score AEO signals: schema, FAQ, depth, trust, internal links. |
| `check_ai_visibility` | For one **query** + one **URL**, check whether Perplexity-style citations mention your domain. |
| `discover_ranking_prompts` | Generate prompts from site content, run visibility checks (rate-limited). |
| `get_visibility_report` | Broader report: optional custom queries + auto prompts from crawl (caps apply). |
| `compare_competitor_visibility` | Same prompts across your URL and competitors (hosted caps: up to **3** queries, **2** competitor URLs enforced server-side). |

Exact JSON schemas may evolve; behavior stays aligned with this list.

---

## Built-in prompts (`/` menu)

| Name | Use |
|------|-----|
| `aeo_site_audit` | Kick off `analyze_website_aeo` with a URL you provide next. |
| `ai_visibility_pulse` | Short run of `check_ai_visibility` for 2–3 questions you care about. |

---

## Use case ideas

1. **Pre-launch / redesign AEO gate** — Crawl staging or production with `analyze_website_aeo` before you ask “are we ChatGPT-ready?”
2. **Brand vs generic prompts** — `check_ai_visibility` on queries like “best [category] software” vs “[your brand] vs [competitor]”.
3. **Content calendar from gaps** — `discover_ranking_prompts` to see where you are **not** cited, then brief writers on missing angles.
4. **Executive snapshot** — `get_visibility_report` with a small set of strategic questions + auto-generated prompts.
5. **Competitive narrative** — `compare_competitor_visibility` on the same 2–3 prompts your sales team hears in the field.

Longer playbooks: [`USE_CASES.md`](./USE_CASES.md) (includes an **AI Visibility** section).

---

## Testing without Perplexity

Use **`analyze_website_aeo` only** to verify OAuth + connector wiring. Add Perplexity when you need citation-style tools.

Power users: [`ADVANCED.md`](./ADVANCED.md) (401 + `WWW-Authenticate`, discovery URLs).

---

## Security (summary)

- **Google OAuth** identifies your SellOnLLM account (same sign-in flow family as the analytics connector). The **AI visibility** MCP endpoint only exposes the tools listed above—not GA4/GSC query tools (those are on `/api/mcp`).
- **Perplexity** calls use your saved key or optional server fallback; keys at rest are encrypted on SellOnLLM.
- Treat model output as **draft** analysis; verify before high-stakes decisions.

More: [`SECURITY.md`](./SECURITY.md).

---

## Suggested GitHub topics (extra discoverability)

`mcp` `model-context-protocol` `claude` `aeo` `answer-engine-optimization` `ai-visibility` `perplexity` `geo` `seo` `llm` `oauth2`
