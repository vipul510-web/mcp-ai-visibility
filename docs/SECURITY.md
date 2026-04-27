# Security & privacy — AI Visibility MCP (hosted)

**Hosted MCP URL:** `https://www.sellonllm.com/api/mcp-ai-visibility`

This document describes the **security posture** for the AI visibility connector on SellOnLLM. It is **not** a legal contract; binding terms are in the [Privacy Policy](https://www.sellonllm.com/privacy-policy.html).

---

## What data flows where

```text
You  →  Google OAuth (browser)  →  SellOnLLM session / MCP identity
You  →  Perplexity API key (optional, on SellOnLLM website)  →  Encrypted storage (BYOK)
Claude  →  SellOnLLM MCP (HTTPS + Bearer)  →  Crawler + Perplexity (as invoked by tools)  →  Tool results  →  Claude
```

- Claude does **not** receive your long-lived **Google** refresh token from SellOnLLM’s perspective as an end-user secret in the chat transcript; MCP uses SellOnLLM-issued **access tokens** for the MCP resource.
- **Perplexity** calls use your saved key (encrypted at rest) or an optional **server-wide** operator key as fallback.

---

## Permissions & trust

- **Google sign-in** is used for **identity** and consent on the SellOnLLM side (same OAuth family as other SellOnLLM MCP connectors). This **AI visibility** endpoint exposes **AEO / visibility tools only** — not GA4/GSC query tools (those are on `/api/mcp`).
- **Crawler** fetches **public** URLs you supply; do not use it to exfiltrate data from authenticated-only pages.
- **Perplexity** requests send **prompts and URLs** needed for the tool; follow Perplexity’s terms for your key.

---

## What SellOnLLM can and cannot do (by design)

**Can:**

- Run hosted tools you invoke via MCP and return results to your client.
- Store encrypted OAuth / API key material needed to operate the product.
- Log operational metadata for reliability and abuse prevention (see privacy policy for retention).

**Cannot / not goals:**

- Guarantee any particular **ranking** or **citation** outcome in third-party AI systems.
- Replace legal, financial, or medical professional advice.

---

## Operational hygiene for teams

- **Rotate** Perplexity keys if a laptop is lost; remove the key on the setup page when offboarding.
- Treat Claude outputs as **draft** analysis; verify before large site or campaign changes.
