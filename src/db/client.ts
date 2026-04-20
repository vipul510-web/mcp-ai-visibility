import { neon } from "@neondatabase/serverless";

// DATABASE_URL is set in Vercel environment variables (same as your other MCP).
// Falls back gracefully if not set (auth will use VALID_API_KEYS env var instead).
const connectionString = process.env.DATABASE_URL;

export const sql = connectionString ? neon(connectionString) : null;
