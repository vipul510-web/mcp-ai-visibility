/**
 * Vercel serverless entry point.
 * Vercel detects api/index.ts and wraps the exported Express app
 * as a serverless function. All routes (/, /mcp, /api/*) are handled here.
 */
export { default } from "../src/app.js";
