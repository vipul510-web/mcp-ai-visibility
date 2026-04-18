#!/usr/bin/env node
/**
 * AEO Visibility MCP — stdio entry point
 *
 * Connect this to Claude Desktop by adding to ~/Library/Application Support/Claude/claude_desktop_config.json:
 * {
 *   "mcpServers": {
 *     "aeo-visibility": {
 *       "command": "node",
 *       "args": ["/path/to/dist/index.js"],
 *       "env": {
 *         "PERPLEXITY_API_KEY": "your-key-here"
 *       }
 *     }
 *   }
 * }
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server.js";

async function main() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // MCP runs over stdio — no console output so it doesn't pollute the protocol
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
