# Advanced — OAuth discovery & verification (AI Visibility MCP)

For normal Claude setup, paste only:

`https://www.sellonllm.com/api/mcp-ai-visibility`

---

## Unauthenticated MCP request

```bash
curl -i https://www.sellonllm.com/api/mcp-ai-visibility
```

Expect **401** and a `WWW-Authenticate` header whose `resource_metadata` URL identifies this MCP resource (often includes `?resource=` URL-encoding).

---

## Discovery endpoints (shared auth server)

| URL | Purpose |
|-----|---------|
| `https://www.sellonllm.com/.well-known/oauth-protected-resource` | RFC 9728 — pass `resource=` for the specific MCP URL when required |
| `https://www.sellonllm.com/.well-known/oauth-authorization-server` | RFC 8414 — authorization server metadata |

```bash
curl -s "https://www.sellonllm.com/.well-known/oauth-protected-resource?resource=https%3A%2F%2Fwww.sellonllm.com%2Fapi%2Fmcp-ai-visibility" | head
```

Claude.ai performs OAuth on your behalf after you add the custom connector.

---

## Claude Desktop (`mcp-remote`)

```json
{
  "mcpServers": {
    "sellonllm-ai-visibility": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://www.sellonllm.com/api/mcp-ai-visibility"]
    }
  }
}
```

---

## MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

Use **Streamable HTTP** and server URL `https://www.sellonllm.com/api/mcp-ai-visibility`, then complete OAuth in the browser.

---

## Analytics MCP (separate)

GA4 + Search Console MCP: `https://www.sellonllm.com/api/mcp` — documentation: [mcp-ga-gsc-seo](https://github.com/vipul510-web/mcp-ga-gsc-seo).
