/**
 * Local development entry point.
 * Imports the shared Express app and starts the HTTP listener.
 * On Vercel, api/index.ts is used instead (no listen()).
 *
 * Run: npm run dev:http
 */

import app from "./app.js";

const PORT = parseInt(process.env.PORT ?? "3000");

app.listen(PORT, () => {
  process.stdout.write(
    `AEO Visibility MCP running on http://localhost:${PORT}\n` +
      `  MCP endpoint:  http://localhost:${PORT}/mcp\n` +
      `  REST endpoint: http://localhost:${PORT}/api\n` +
      `  Health check:  http://localhost:${PORT}/health\n`
  );
});
