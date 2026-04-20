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
