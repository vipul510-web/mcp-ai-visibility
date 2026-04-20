# Security & privacy — hosted SellOnLLM MCP (Claude)

**Analytics MCP:** `https://www.sellonllm.com/api/mcp`  
**AI visibility MCP:** `https://www.sellonllm.com/api/mcp-ai-visibility` — Perplexity-backed tools; see [`AI_VISIBILITY.md`](./AI_VISIBILITY.md)

This document describes the **security posture users and teams should understand** when connecting **Google Analytics and Search Console** through SellOnLLM’s **analytics** MCP, and notes how the **separate** AI visibility MCP fits (crawl + optional Perplexity; not a second GA/GSC export path on that URL). It is **not** a legal contract; for binding terms see the [Privacy Policy](https://www.sellonllm.com/privacy-policy.html) on the main site.

---

## What data flows where

```text
You  →  Google OAuth (browser)  →  SellOnLLM stores encrypted Google refresh token
Claude  →  SellOnLLM MCP (HTTPS + Bearer)  →  SellOnLLM calls Google APIs  →  Tool results  →  Claude
```

- **Claude never receives your long-lived Google refresh token.**
- Claude receives **short-lived SellOnLLM MCP access tokens** (JWTs) scoped to the MCP resource, plus **tool responses** (metrics, tables, summaries).

---

## Google permissions (scopes)

The connector is designed around **read-only** access to:

- **Google Analytics** — reporting and property listing as exposed by the product
- **Google Search Console** — performance and site listing as exposed by the product

You approve scopes explicitly in the Google consent screen. There is **no** write path to change GA configuration, GSC removals, sitemaps, or URLs from this connector’s intended use.

---

## What SellOnLLM can and cannot do

**Can (by design):**

- Call Google APIs on your behalf while your connection is active and permitted
- Store **encrypted** OAuth tokens needed to refresh access
- Log operational metadata for reliability and abuse prevention (exact retention: see privacy policy)

**Cannot / does not include in normal product goals:**

- Impersonate you on unrelated Google products outside the granted scopes
- Expose your Google password (Google never sends it to us)

---

## Token handling (conceptual)

- **MCP access token:** presented by the client on each MCP request; short TTL.
- **MCP refresh token:** used to renew MCP access; distinct from Google’s token.
- **Google refresh token:** stored **encrypted** server-side; used only inside SellOnLLM’s backend to obtain short-lived Google access tokens for API calls.

---

## Your controls

1. **Disconnect** the MCP connector in your AI client (Claude, Cursor, etc.).
2. **Revoke** SellOnLLM’s access in [Google Account → Third-party access](https://myaccount.google.com/permissions).
3. For organizations: follow your **vendor review**, **DPA**, and **subprocessor** processes before enabling connectors for production Google identities.

---

## Responsible use of AI outputs

Tool results are **factual inputs** from Google APIs; the **natural-language narrative** Claude produces is still **model-generated**. Always verify:

- Business-critical numbers in the GA / GSC UI when stakes are high
- Robots, canonicals, and redirects in your CMS or edge config before shipping

---

## Reporting security issues

If you believe you have found a **security vulnerability** in SellOnLLM’s hosted service, contact the team through the website’s [Contact](https://www.sellonllm.com/contact-us.html) page and avoid posting exploit details in public GitHub issues until acknowledged.
