# Troubleshooting — AI Visibility MCP

**Hosted MCP URL:** `https://www.sellonllm.com/api/mcp-ai-visibility`

---

## “Authorization failed” in Claude but tools still work

Some Claude UI builds show **Authorization failed** in connector settings even when the integration works.

**Try:** *“Run analyze_website_aeo on https://example.com with max_pages 2.”*

If you get a real scorecard back, the connection works. See [anthropics/claude-ai-mcp#132](https://github.com/anthropics/claude-ai-mcp/issues/132).

---

## Perplexity errors or “no API key”

1. Confirm you connected **`https://www.sellonllm.com/api/mcp-ai-visibility`** (not only the analytics URL).
2. Save your key on **[AI Visibility MCP for Claude](https://www.sellonllm.com/ai-visibility-mcp-claude.html)** while signed in with the **same Google account** as MCP. Keys must start with `pplx-`.
3. Test **`analyze_website_aeo` first** — it does **not** use Perplexity.

---

## Claude Free tier: one custom connector

If you can only add **one** connector, choose **AI visibility** *or* **Analytics** (`/api/mcp`), or upgrade your Claude plan. You cannot use both MCPs simultaneously on Free if the limit is one.

---

## Google OAuth “Testing” mode

If the SellOnLLM OAuth app is in **Testing**, only **test users** in Google Cloud Console can complete sign-in.

---

## Crawl looks empty or wrong

- **Paywalled / login-only** content will not appear.
- **Heavy client-side rendering** may not fully match what the crawler sees.
- Try fewer pages or a simpler URL (homepage) first.

---

## Still stuck?

Open an [issue](https://github.com/vipul510-web/mcp-ai-visibility/issues) with:

- Client (Claude Web / Desktop / Cursor / other)
- Approximate **timestamp** (UTC)
- Whether OAuth **completed**
- Whether **Perplexity** is configured (yes/no — do not paste keys)
- Redacted screenshot of any error
