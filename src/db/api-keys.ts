import { sql } from "./client.js";
import { createHash } from "crypto";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// ---------------------------------------------------------------------------
// isApiKeyValid
// Checks the DB first; if DB is not configured, falls back to the
// VALID_API_KEYS env var (comma-separated list). If neither is configured,
// open access is granted (dev mode).
// ---------------------------------------------------------------------------

export async function isApiKeyValid(key: string): Promise<boolean> {
  if (!key) {
    // No key provided — allow if nothing is configured (dev mode)
    return isOpenAccess();
  }

  // DB check
  if (sql) {
    try {
      const rows = await sql`
        SELECT 1 FROM aeo_api_keys
        WHERE key_hash = ${hashKey(key)}
          AND is_active = true
        LIMIT 1
      `;
      return rows.length > 0;
    } catch {
      // DB error — fall through to env var check
    }
  }

  // Env var fallback
  const validKeys = getEnvKeys();
  if (validKeys.size > 0) return validKeys.has(key);

  // Nothing configured → open access
  return true;
}

export async function recordApiKeyUsage(key: string, path: string): Promise<void> {
  if (!sql || !key) return;
  const hash = hashKey(key);
  try {
    await sql`
      UPDATE aeo_api_keys
      SET last_used_at = NOW(), usage_count = usage_count + 1
      WHERE key_hash = ${hash}
    `;
    await sql`
      INSERT INTO aeo_usage_logs (key_hash, path, called_at)
      VALUES (${hash}, ${path}, NOW())
    `;
  } catch {
    // non-critical — ignore logging failures
  }
}

function isOpenAccess(): boolean {
  return getEnvKeys().size === 0 && !sql;
}

function getEnvKeys(): Set<string> {
  return new Set(
    (process.env.VALID_API_KEYS ?? "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
  );
}
