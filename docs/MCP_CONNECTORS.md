# Claude MCP connectors (SellOnLLM)

SellOnLLM runs **two hosted** [Model Context Protocol](https://modelcontextprotocol.io) (MCP) servers for [Claude](https://claude.ai) **custom connectors**. They share Google sign-in for identity but use **different server URLs** and **different tool sets**.

| Connector | Paste in Claude (Server URL) | User docs | Best for |
|-----------|------------------------------|-----------|----------|
| **Analytics** | `https://www.sellonllm.com/api/mcp` | [GA + GSC MCP for Claude](https://www.sellonllm.com/google-analytics-mcp-claude.html) | GA4 properties, GSC queries/pages/CTR, traffic deltas, monthly reviews |
| **AI visibility** | `https://www.sellonllm.com/api/mcp-ai-visibility` | [AI Visibility MCP for Claude](https://www.sellonllm.com/ai-visibility-mcp-claude.html) | AEO site crawl / scorecard, Perplexity citation checks, visibility reports |

**Perplexity API key (BYOK):** save on the [AI Visibility setup page](https://www.sellonllm.com/ai-visibility-mcp-claude.html) while signed in with the **same Google account** you used for that connector. Required for Perplexity-backed tools only; `analyze_website_aeo` does not need it.

**Operator / self-host notes:** see [`MCP_CLAUDE_SETUP.md`](../MCP_CLAUDE_SETUP.md) in this repository (endpoints, JWT audiences, env vars, curl checks).

**GitHub repo:** [github.com/vipul510-web/mcp-ai-visibility](https://github.com/vipul510-web/mcp-ai-visibility) (issues and discoverability).

**Community docs in this monorepo:** [`mcp-ga-gsc-seo/README.md`](../mcp-ga-gsc-seo/README.md) and [`mcp-ga-gsc-seo/docs/`](../mcp-ga-gsc-seo/docs/) (prompts, security, troubleshooting, AI visibility deep dive).
