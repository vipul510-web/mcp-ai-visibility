# Copy/paste prompts (GA4 + GSC MCP)

These work best after you’ve connected the hosted server in Claude:

- Server URL: `https://www.sellonllm.com/api/mcp`

Claude should automatically call tools to list your GA4 properties and Search Console sites first.

---

## Monthly SEO review (GA4 + GSC)

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

## CTR audit (titles + metas)

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

## Traffic deltas (pages that dropped)

```text
Using my GA4 property, identify the landing pages that lost the most organic sessions in the last 14 days vs the previous 14 days.

Return:
- top 20 pages by session loss (absolute and %)
- for each: sessions, engaged sessions, engagement rate, conversions (if available)

Then cross-check each page in Search Console:
- impressions/clicks/CTR/position deltas for the same periods

Explain likely causes (rank drop vs CTR vs demand vs tracking vs seasonality) and give a prioritized fix list.
```

## Rank booster (positions 4–15)

```text
Using Google Search Console, find pages with strong impressions and average position between 4 and 15 over the last 28 days.

For the top 10 pages (by impressions):
1) list top queries and their positions/CTR
2) recommend on-page improvements (heading structure, internal links, missing sections, schema, FAQs)
3) provide a short content brief per page (outline + key points)

Finish with a recommended internal linking plan (which pages should link to which, with suggested anchor text patterns).
```

