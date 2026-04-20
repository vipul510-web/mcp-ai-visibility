# Tools reference — SellOnLLM AI Visibility MCP

**Hosted endpoint:** `https://www.sellonllm.com/api/mcp-ai-visibility`

Claude calls these tools over **JSON-RPC**. Hosted caps keep responses fast and safe for chat context. Exact JSON schemas may evolve; capabilities stay aligned with this document.

> **Sibling product:** Google Analytics + Search Console tools live on **`https://www.sellonllm.com/api/mcp`** — see [mcp-ga-gsc-seo](https://github.com/vipul510-web/mcp-ga-gsc-seo).

---

## `analyze_website_aeo`

**Purpose:** Crawl **public** HTML pages (bounded count), then score **AEO / AI citability** signals: structured data, FAQ-style content, clarity, trust cues, internal links, meta tags, depth.

**When to use:** First tool to run when you want a **site-level** scorecard without Perplexity.

**Perplexity:** Not used.

**Typical args:** `url` (required, `https://…`), optional `max_pages` (hosted maximum applies).

---

## `check_ai_visibility`

**Purpose:** Given one **user query** (natural language) and one **target URL**, call Perplexity-style retrieval to see whether your domain/site is **cited** in the response context.

**When to use:** Hypothesis testing for specific buyer questions (“best X for Y”, “brand vs competitor”).

**Perplexity:** Required (user BYOK on [setup page](https://www.sellonllm.com/ai-visibility-mcp-claude.html) or optional server fallback).

**Typical args:** `url`, `query` (minimum length enforced server-side).

---

## `discover_ranking_prompts`

**Purpose:** Crawl the site, **generate** candidate prompts from headings/FAQ/title patterns, then run visibility checks (rate-limited).

**When to use:** You want a **spreadsheet-style** list of prompts where you win vs lose without brainstorming manually.

**Perplexity:** Required for the visibility leg.

**Typical args:** `url`, optional `industry` hint, optional `max_prompts` (hosted cap).

---

## `get_visibility_report`

**Purpose:** Produce a **combined** visibility report: your optional `queries` plus optional **auto-generated** prompts from the site when enabled.

**When to use:** Executive or sprint-level snapshot across a small set of questions.

**Perplexity:** Required for Perplexity-backed parts.

**Typical args:** `url`, optional `queries[]`, optional `auto_generate`.

---

## `compare_competitor_visibility`

**Purpose:** Run the **same** prompts across **your URL** and **competitor** URLs; summarize who is cited more often.

**When to use:** Competitive positioning on a **small** fixed prompt set (not a full SERP tracker).

**Perplexity:** Required.

**Hosted caps (enforced server-side):** up to **3** queries and **2** competitor URLs per call (implementation may clamp broader client requests).

---

## How tools chain in real chats

1. **`analyze_website_aeo`** → establish on-page/AEO gaps (no API key friction).
2. **`check_ai_visibility`** → validate 2–3 critical prompts once Perplexity is configured.
3. **`get_visibility_report`** or **`discover_ranking_prompts`** → broader view.
4. **`compare_competitor_visibility`** → narrative for leadership or sales enablement.

You can describe outcomes in natural language; Claude will usually pick a sensible chain.

---

## Limits & expectations

- **Crawl** is public HTML only; paywalled or heavily JS-rendered sites may be incomplete.
- **Perplexity** usage is subject to your key’s plan and server-side rate limits.
- **Model output** still needs human judgment before irreversible business or SEO decisions.
