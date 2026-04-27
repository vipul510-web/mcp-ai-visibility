# Copy/paste prompts — AI Visibility MCP

Use after connecting **`https://www.sellonllm.com/api/mcp-ai-visibility`** in Claude.

For **Perplexity** tools, save your key on [AI Visibility MCP for Claude](https://www.sellonllm.com/ai-visibility-mcp-claude.html) (same Google account as MCP).

---

## AEO crawl + prioritized fix list

```text
Run analyze_website_aeo on https://example.com with max_pages 8.

Output:
1) One-paragraph executive summary for a head of marketing
2) Table: theme | current score | risk | recommended fix
3) Top 10 actions sorted by impact × effort for the next 14 days

Assume EU/US English audience; call out schema.org gaps explicitly.
```

---

## Citation check pack (3 prompts)

```text
Site under test: https://example.com

Use check_ai_visibility for each:
1) "What is the best [category] for [specific use case]?"
2) "How does [Brand] compare to [Competitor]?"
3) "Is [Brand] worth it for [persona]?"

For each: cited yes/no, short excerpt of how we appear (if at all), and 2 concrete improvements (on-page or off-page).
```

---

## Visibility report (auto + custom)

```text
Run get_visibility_report for https://example.com with:
- auto_generate: true
- queries: ["[custom question 1]", "[custom question 2]"]

Deliver: visibility rate, table of prompts vs cited, and a sprint backlog of 7 items max.
```

---

## Competitor comparison (same prompts)

```text
compare_competitor_visibility:
- your_url: https://oursite.com
- competitor_urls: ["https://competitor.com"]
- queries: ["best [category] software 2026", "how to choose [category] vendor", "[OurBrand] pricing"]

Summarize who wins per query and the single biggest content or authority gap we should close first.
```

---

## Discover prompts from the site, then act

```text
Run discover_ranking_prompts on https://example.com with industry hint "ecommerce apparel".

Then: group failures by theme (trust, comparisons, how-to), and propose 3 net-new URL ideas or FAQ expansions—not generic advice.
```

---

## Research-first workflow (use with browsing if available)

This is the “skill” pattern: **research → MCP → recommendations**. If browsing isn’t available in your Claude environment, skip Phase 1 and infer context from on-site content and your own assumptions.

```text
Do this in three phases:

Phase 1 — Research (if browsing is available):
- Look up my company using the URL I provide next.
- Infer: what we sell (offerings), target audience/persona, geographic focus, and 2–5 close competitors.
- Identify 8–12 realistic buyer-intent prompts people would type into ChatGPT/Claude/Perplexity (pricing, alternatives, reviews, vs competitor, best-for-persona, local intent).

Phase 2 — MCP testing:
- Use discover_ranking_prompts on my URL with:
  - offerings (3–6 items)
  - audience (1 short phrase)
  - geo (if relevant)
  - competitors (2–5)
  - seed_prompts (your best 6–8 buyer-intent prompts)
  - max_prompts 8
- Then run check_ai_visibility on the top 3 most important prompts.

Phase 3 — Output:
- Provide a table: prompt | visible? | who is cited instead | 1 specific fix.
- End with a prioritized 14-day action plan (impact × effort).

I will paste the website URL next.
```
