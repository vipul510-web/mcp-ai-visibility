# Troubleshooting — SellOnLLM MCP (Claude)

**Analytics MCP:** `https://www.sellonllm.com/api/mcp`  
**AI visibility MCP:** `https://www.sellonllm.com/api/mcp-ai-visibility` — see also [`AI_VISIBILITY.md`](./AI_VISIBILITY.md)

---

## “Authorization failed” but tools still work

Some Claude UI builds show **Authorization failed** in connector settings even when the integration works.

**Try:** Ask a concrete question:

> “Call tools to list my GA4 properties and Search Console sites.”

If you get real property/site names back, the connection is functional. Known discussion: [anthropics/claude-ai-mcp#132](https://github.com/anthropics/claude-ai-mcp/issues/132).

---

## No tools appear / Claude never uses GA or GSC

1. Confirm the connector is **enabled** for the project or chat you are in.
2. Remove the connector and re-add it; paste the URL **exactly** (analytics vs AI visibility):
   - Analytics: `https://www.sellonllm.com/api/mcp`
   - AI visibility: `https://www.sellonllm.com/api/mcp-ai-visibility`
3. Complete Google OAuth in the **same browser profile** you expect.
4. Ask explicitly: *“Use SellOnLLM analytics tools for this answer.”*

---

## Wrong Google account

If you pick the wrong Google login during OAuth, you will only see GA4 properties and GSC sites that account can access.

**Fix:** Disconnect the connector, revoke SellOnLLM on [Google permissions](https://myaccount.google.com/permissions), reconnect, and choose the correct workspace account.

---

## Google OAuth “Testing” mode (only test users allowed)

If the SellOnLLM Google Cloud OAuth app is in **Testing**, only **test users** added in Google Cloud Console can sign in.

**Symptom:** Access blocked / “app not verified” for normal users.

**Fix:** For public launch, the OAuth consent screen must move through Google’s **verification** for sensitive scopes (timeline depends on Google’s review).

---

## Multiple GA4 properties or GSC sites

**Symptom:** Claude picks the wrong property or site.

**Fix:** Say explicitly:

> “List all GA4 properties and all GSC sites. Then use GA4 property `…` and GSC site `…` for everything below.”

---

## Claude Free tier: connector limit

Claude **Free** may allow only **one** custom MCP connector. If you already use another connector, you may need to remove it or upgrade your Claude plan.

You **cannot** add both SellOnLLM connectors on Free if the limit is one—pick **analytics** or **AI visibility**, or use the [web chat](https://www.sellonllm.com/chat-with-google-analytics.html) for GA/GSC and reserve your single slot for AI visibility (or vice versa).

---

## AI visibility: Perplexity errors or “no API key”

1. Confirm you connected **`/api/mcp-ai-visibility`** (not only the analytics URL).
2. Save your key on **[AI Visibility MCP for Claude](https://www.sellonllm.com/ai-visibility-mcp-claude.html)** while signed in with the **same Google account** used for OAuth. Keys must start with `pplx-`.
3. **`analyze_website_aeo`** should still work **without** Perplexity — use it to verify the connector before debugging Perplexity.

---

## Rate limits, empty data, or truncated tables

**Symptom:** Tool returns fewer rows than expected or errors on huge properties.

**Mitigations:**

- Narrow the **date range**
- Add **filters** (specific path prefix, country, device)
- Ask for **top N** instead of “all URLs ever”

---

## Cursor / other MCP clients

This repo documents the **hosted** server URL. Client-specific wiring (config file paths, transport) depends on the product. If something works in Claude but not elsewhere, include **client name + version** in a GitHub issue.

---

## Still stuck?

Open an [issue](https://github.com/vipul510-web/mcp-ga-gsc-seo/issues) with:

- Client (Claude Web / Claude Desktop / Cursor / other)
- Approximate **timestamp** (UTC)
- Whether OAuth **completed**
- Redacted screenshot of any error (no tokens, no cookies)
