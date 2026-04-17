import { neon } from '@neondatabase/serverless';

let _sql = null;

export function getSql() {
    if (_sql) return _sql;
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is not set');
    }
    _sql = neon(process.env.DATABASE_URL);
    return _sql;
}

let _schemaReady = false;

export async function ensureSchema() {
    if (_schemaReady) return;
    const sql = getSql();
    await sql`
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            google_sub VARCHAR(64) UNIQUE NOT NULL,
            email VARCHAR(255) NOT NULL,
            name VARCHAR(255),
            picture TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `;
    await sql`
        CREATE TABLE IF NOT EXISTS user_connections (
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            provider VARCHAR(32) NOT NULL,
            encrypted_refresh_token TEXT NOT NULL,
            scope TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            PRIMARY KEY (user_id, provider)
        )
    `;
    await sql`
        CREATE TABLE IF NOT EXISTS user_secrets (
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            provider VARCHAR(32) NOT NULL,
            encrypted_key TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            PRIMARY KEY (user_id, provider)
        )
    `;
    await sql`
        CREATE TABLE IF NOT EXISTS mcp_clients (
            id VARCHAR(64) PRIMARY KEY,
            client_name TEXT,
            redirect_uris JSONB NOT NULL,
            token_endpoint_auth_method VARCHAR(32) DEFAULT 'none',
            grant_types JSONB,
            response_types JSONB,
            scope TEXT,
            software_id TEXT,
            software_version TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `;
    await sql`
        CREATE TABLE IF NOT EXISTS mcp_auth_codes (
            code VARCHAR(128) PRIMARY KEY,
            client_id VARCHAR(64) NOT NULL,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            redirect_uri TEXT NOT NULL,
            code_challenge TEXT NOT NULL,
            code_challenge_method VARCHAR(16) NOT NULL,
            resource TEXT,
            scope TEXT,
            expires_at TIMESTAMP NOT NULL,
            used_at TIMESTAMP
        )
    `;
    _schemaReady = true;
}
