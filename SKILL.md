---
name: ai-visibility-mcp
description: Research a website's business context and run realistic AI search visibility checks using the SellOnLLM AI Visibility MCP. Use when a user wants to know if their site is cited in ChatGPT, Claude, or Perplexity for buyer-intent prompts; when checking competitor AI visibility; or when auditing AEO (answer engine optimization) readiness. Instructs the assistant to research the business first, then call MCP tools with realistic prompts rather than generic ones.
---

# SellOnLLM AI Visibility MCP — Skill

## What this MCP does

Hosted connector at `https://www.sellonllm.com/api/mcp-ai-visibility`.

- **`analyze_website_aeo`** — crawl + AEO scorecard (no Perplexity required).
- **`check_ai_visibility`** — is a domain cited for one specific user query? (Perplexity key required)
- **`discover_ranking_prompts`** — batch visibility check with auto-generated buyer-intent prompts.
- **`get_visibility_report`** — full report, custom + auto prompts.
- **`compare_competitor_visibility`** — same prompts across your site + competitors.

Setup page (Perplexity BYOK): https://www.sellonllm.com/ai-visibility-mcp-claude.html

---

## Core rule: research first, then run tools

Generic prompts ("what should I know about X?", "who uses X?") are **not** how real buyers search. Before calling any visibility tool, infer what the business actually sells and what a real buyer would type.

---

## Workflow

### Step 1 — Research the business

When given a URL:

1. **If browsing is available:** visit the site and note: core offering(s), pricing model, target audience/persona, geographic focus, top 2–5 competitors.
2. **If browsing is unavailable:** call `analyze_website_aeo` with `max_pages 5` first. Extract offering nouns, pain-point language, FAQs, and any competitor mentions from the scorecard output.

Output a brief "business brief" before calling any Perplexity tools:
```
Business brief
- Offering: [e.g. "AI background remover for product photos"]
- Audience: [e.g. "ecommerce sellers, marketers"]
- Geo: [e.g. "global / US-focused"]
- Competitors: [e.g. "remove.bg, Canva, Adobe Express"]
```

### Step 2 — Build buyer-intent prompts

Use **commercial intent** templates. Avoid meta-questions.

| ✅ Realistic buyer prompts | ❌ Avoid |
|---|---|
| `best background remover for ecommerce 2026` | `what should I know about background removers?` |
| `remove.bg alternatives free` | `who uses background removal tools?` |
| `[brand] pricing` | `what problems does [brand] solve?` |
| `how to remove background from product photo` | `[brand] tips and best practices` |
| `[brand] vs canva` | `compare [brand] options` |
| `free background remover for small business` | — |
| `[brand] reviews` | — |

Build a list of 6–8 buyer-intent prompts from: pricing, alternatives/vs, reviews, "best X for Y", how-to tasks, local intent, brand name searches.

### Step 3 — Call MCP tools

```
discover_ranking_prompts(
  url = <site>,
  offerings = [<3-6 core services>],
  audience = "<1 short phrase>",
  geo = "<geo or omit>",
  competitors = [<2-5 competitor brands>],
  seed_prompts = [<your 6-8 buyer prompts from Step 2>],
  max_prompts = 8
)
```

Then call `check_ai_visibility` for the 2–3 most commercially important prompts individually to get citation snippets.

### Step 4 — Output

Deliver:

1. **Business brief** (from Step 1)
2. **Table**: `prompt | visible? | citation position | who is cited instead`
3. **Prioritized 14-day action plan** (max 7 items, ranked impact × effort):
   - Page/content fixes (FAQ, schema, depth)
   - Authority gaps (citations, links)
   - Prompt-specific rewrites

---

## Quick start (paste this into Claude)

```
I want to check AI visibility for [WEBSITE URL].

Do this:
1. Research the site (browse if you can, or use analyze_website_aeo with max_pages 5).
2. Write a brief: offering, audience, geo, competitors.
3. Generate 8 buyer-intent prompts (pricing, alternatives, reviews, vs competitor, best-for-persona).
4. Run discover_ranking_prompts with those as seed_prompts.
5. Run check_ai_visibility on the top 3 most important prompts.
6. Output: business brief + table (prompt | visible | who is cited) + 14-day action plan.
```

---

## Additional resources

- Full prompt library: [docs/PROMPTS.md](docs/PROMPTS.md)
- Tool limits and behavior: [docs/TOOLS.md](docs/TOOLS.md)
- Use cases and playbooks: [docs/USE_CASES.md](docs/USE_CASES.md)
- Troubleshooting: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
