# Tools reference — SellOnLLM Analytics MCP

**Hosted endpoint:** `https://www.sellonllm.com/api/mcp`

> **Second connector:** AEO crawl + Perplexity visibility tools live on **`https://www.sellonllm.com/api/mcp-ai-visibility`** — see **[`AI_VISIBILITY.md`](./AI_VISIBILITY.md)** for tools, prompts, Perplexity BYOK, and use cases.

Claude (or another MCP client) calls these tools over **JSON-RPC**. You describe goals in natural language; the model selects tools and passes structured arguments. Row counts and date ranges are bounded so responses stay fast and safe for chat context.

---

## Discovery tools

### `list_ga4_properties`

**Purpose:** Enumerate every **GA4 property** the authenticated Google user can access (Admin API).

**When to use:** First message in a new thread, or whenever you are unsure which `propertyId` to pass to other tools.

**Typical follow-up:** *“Use property `123456789` for all subsequent GA4 calls.”*

---

### `list_search_console_sites`

**Purpose:** Enumerate **Search Console** properties (sites) the user can access — both URL-prefix and Domain properties where verified.

**When to use:** Before any GSC query if multiple sites exist (www vs non-www, staging, regional folders).

**Typical follow-up:** *“Use site `sc-domain:example.com` (or `https://www.example.com/`) for GSC.”*

---

## Combined snapshot

### `get_seo_snapshot`

**Purpose:** One opinionated call that returns a **~28-day** blend of GA4 + GSC signals — ideal for “how are we doing?” without specifying every dimension yourself.

**When to use:**

- Monday stand-ups
- Client onboarding week one
- Quick sanity check before a deeper dive

**Limitation:** Less flexible than `query_ga4` / `query_search_console` — use those when you need custom breakdowns.

---

## GA4 reporting

### `query_ga4`

**Purpose:** Run a flexible **GA4 Data API** report: you (via Claude) choose **dimensions**, **metrics**, **date ranges**, **filters**, **order by**, and **limits**.

**Common patterns:**

| Question | Typical dimensions (examples) | Typical metrics (examples) |
|----------|------------------------------|-----------------------------|
| Which landing pages drive organic? | `sessionDefaultChannelGroup`, `landingPagePlusQueryString` (often filter channel to Organic Search) | `sessions`, `engagedSessions`, `engagementRate` |
| Is mobile engagement worse? | `deviceCategory` | `sessions`, `engagementRate`, `averageSessionDuration` |
| Where do conversions come from? | `sessionCampaignName`, `landingPagePlusQueryString` | `sessions`, `conversions`, `totalRevenue` (if configured) |

**When to use:** Any time the snapshot is not specific enough.

---

### `get_traffic_deltas`

**Purpose:** Compare **last N days** vs **previous N days** at the **landing page** level — optimized for “what dropped?” investigations.

**When to use:**

- After deployments, migrations, or indexation events
- When organic sessions moved but you do not yet know which URLs

**Pairs well with:** `query_search_console` on the same URL set for the same windows (demand vs on-site behavior).

---

## Search Console reporting

### `query_search_console`

**Purpose:** Flexible **Search Analytics** query — queries, pages, countries, devices, search appearance, and **date** (depending on API constraints).

**Common patterns:**

| Question | Typical dimensions |
|----------|-------------------|
| What are we ranking for? | `query` |
| Which URLs earn impressions? | `page` |
| Is mobile CTR worse? | `device` |
| Which queries drive a specific URL? | `query`, `page` (filter) |

**When to use:** Any GSC question that is not already covered by the specialized tools below.

---

### `find_ctr_opportunities`

**Purpose:** Surfaces **high-impression** queries or pages where **CTR is low relative to opportunity** — classic snippet optimization work.

**When to use:**

- Title and meta experiments
- SERP feature or intent mismatch investigations
- “We rank but don’t get clicked”

---

### `find_ranking_opportunities`

**Purpose:** Highlights URLs or queries sitting in **roughly positions 4–15** with meaningful impressions — candidates for on-page depth, internal links, and structured data.

**When to use:**

- Content sprint planning
- Prioritizing pages that are “almost” competitive

---

## How tools chain together in real chats

A strong pattern:

1. `list_ga4_properties` + `list_search_console_sites` → disambiguate
2. `get_seo_snapshot` → orientation
3. `find_ctr_opportunities` **or** `find_ranking_opportunities` → backlog
4. `query_ga4` + `query_search_console` → evidence for specific URLs
5. `get_traffic_deltas` → confirm regressions over time

You do not need to name tools yourself — describe the outcome you want; Claude will typically follow a similar chain.

---

## Limits & expectations

- Tools return **aggregates and bounded rows** — not a full raw export of every URL on your site for all time.
- **Sampling / thresholding:** Very large properties may hit API limits; ask for narrower date ranges or filters if a call is truncated.
- **Model output:** Even perfect numbers need human judgment before irreversible SEO or business decisions.
