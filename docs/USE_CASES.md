# Use cases & playbooks — AI Visibility MCP

Assume the **hosted** connector is connected:

- Server URL: `https://www.sellonllm.com/api/mcp-ai-visibility`

Save your **Perplexity** key on the [AI Visibility setup page](https://www.sellonllm.com/ai-visibility-mcp-claude.html) before workflows that use citation tools. **`analyze_website_aeo`** does not need Perplexity.

---

## 1. AEO scorecard before a major content push

**Goal:** Fix schema, FAQ, and depth issues before you chase AI citations.

**Prompt idea:**

```text
Run analyze_website_aeo on https://example.com (max_pages 8). Return:
1) Overall AEO readiness in plain language
2) Top 5 fixes ranked by impact vs effort
3) Whether FAQ / HowTo / Organization schema gaps likely hurt answer engines

Assume I will hand this to a developer and a content lead.
```

---

## 2. “Are we cited for our money prompts?”

**Goal:** Quick Perplexity checks for 2–3 commercial questions.

**Prompt idea:**

```text
Our site is https://example.com. Use check_ai_visibility for each query below and report cited/not cited, any competitor domains that appear, and one specific on-page or off-page action if we are not cited.

Queries:
- "best [your category] for [use case]"
- "[your brand] reviews"
- "[your brand] vs [main competitor]"
```

---

## 3. Discover blind spots from the site itself

**Goal:** Auto-generate test prompts from headings/FAQ, then see visibility.

**Prompt idea:**

```text
Run discover_ranking_prompts on https://example.com with industry hint "[e.g. B2B SaaS]". Summarize:
- which auto-generated prompts we win vs lose
- 5 new content or FAQ bullets to close the biggest gaps
```

---

## 4. Stakeholder-friendly visibility snapshot

**Goal:** One short narrative + table, not raw JSON.

**Prompt idea:**

```text
Run get_visibility_report on https://example.com with auto_generate true. If I give custom queries, merge them. Output:
- 5-bullet executive summary for a CMO
- table of prompts × visible yes/no
- 3 recommendations for next sprint only
```

---

## 5. Competitive AI visibility on the same prompts

**Goal:** Compare your domain vs 1–2 named competitors on strategic questions.

**Prompt idea:**

```text
Use compare_competitor_visibility with:
- your_url: https://oursite.com
- competitor_urls: ["https://competitor-a.com", "https://competitor-b.com"]
- queries: ["best [category] tool", "how to [job-to-be-done]", "is [brand] worth it"]

Explain who wins each prompt and what we should change on our site first.
```

---

## 6. Connector smoke test (no Perplexity)

**Goal:** Confirm OAuth and MCP wiring before adding a paid Perplexity key.

**Prompt idea:**

```text
Run analyze_website_aeo on https://example.com with max_pages 3. Return only the executive summary and the top 3 technical fixes.
```

---

## More copy/paste blocks

See [`PROMPTS.md`](PROMPTS.md) and the [product page](https://www.sellonllm.com/ai-visibility-mcp-claude.html).

For **GA4 + Search Console** workflows, use the separate Analytics MCP: [mcp-ga-gsc-seo](https://github.com/vipul510-web/mcp-ga-gsc-seo).
