import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getSql, ensureSchema } from './db.js';

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

function getSecret() {
    const s = process.env.JWT_SECRET;
    if (!s) throw new Error('JWT_SECRET is not set');
    return s;
}

export function publicBase() {
    const b = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
    if (!b) {
        throw new Error('PUBLIC_BASE_URL must be set to your HTTPS origin (e.g. https://www.example.com)');
    }
    return b;
}

/**
 * Apex + www variants of the configured public origin (e.g. both https://sellonllm.com and https://www.sellonllm.com).
 * MCP clients often use the site URL the user typed; JWT `aud` follows the OAuth `resource` host, which may differ from PUBLIC_BASE_URL.
 */
export function publicHostVariants() {
    const raw = publicBase().replace(/\/+$/, '');
    const origins = new Set();
    try {
        const withProto = raw.includes('://') ? raw : `https://${raw}`;
        const u = new URL(withProto);
        const origin = `${u.protocol}//${u.hostname}`;
        origins.add(origin);
        if (u.hostname.startsWith('www.')) {
            origins.add(`${u.protocol}//${u.hostname.slice(4)}`);
        } else {
            origins.add(`${u.protocol}//www.${u.hostname}`);
        }
    } catch {
        origins.add(raw);
    }
    return [...origins];
}

/** Canonical MCP resource URL (no trailing slash) — matches OAuth `resource` and JWT `aud`. */
export function normalizeMcpAudience(resource) {
    const base = publicBase();
    const fallback = `${base}/api/mcp`;
    if (!resource || typeof resource !== 'string') return fallback;
    const r = resource.trim().replace(/\/+$/, '');
    return r || fallback;
}

export function signAccessToken({ userId, clientId, resource, scope }) {
    const aud = normalizeMcpAudience(resource || `${publicBase()}/api/mcp`);
    return jwt.sign(
        {
            sub: userId,
            cid: clientId,
            scope: scope || 'mcp.read',
            typ: 'mcp_access',
        },
        getSecret(),
        {
            expiresIn: ACCESS_TOKEN_TTL_SECONDS,
            audience: aud,
            issuer: publicBase(),
        },
    );
}

export function signRefreshToken({ userId, clientId, resource }) {
    const aud = normalizeMcpAudience(resource || `${publicBase()}/api/mcp`);
    return jwt.sign(
        { sub: userId, cid: clientId, typ: 'mcp_refresh' },
        getSecret(),
        {
            expiresIn: '30d',
            audience: aud,
            issuer: publicBase(),
        },
    );
}

function mcpJwtAudiencesForVerify() {
    const auds = new Set();
    for (const origin of publicHostVariants()) {
        const base = String(origin).replace(/\/+$/, '');
        const aud = `${base}/api/mcp`.replace(/\/+$/, '');
        auds.add(aud);
        auds.add(`${aud}/`);
    }
    return [...auds];
}

export function verifyAccessToken(token) {
    try {
        const payload = jwt.verify(token, getSecret(), {
            audience: mcpJwtAudiencesForVerify(),
            issuer: publicHostVariants(),
        });
        if (payload.typ !== 'mcp_access') return null;
        return payload;
    } catch {
        return null;
    }
}

export function verifyRefreshToken(token) {
    try {
        const payload = jwt.verify(token, getSecret(), {
            audience: mcpJwtAudiencesForVerify(),
            issuer: publicHostVariants(),
        });
        if (payload.typ !== 'mcp_refresh') return null;
        return payload;
    } catch {
        return null;
    }
}

/** JWT `aud` may be a string or (rarely) an array of strings. */
export function audienceFromJwtPayload(aud) {
    if (Array.isArray(aud)) return normalizeMcpAudience(aud[0]);
    return normalizeMcpAudience(aud);
}

/** Verify PKCE code_challenge against a provided code_verifier (S256 only). */
export function verifyPkceS256(codeVerifier, codeChallenge) {
    if (!codeVerifier || !codeChallenge) return false;
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    const computed = hash.toString('base64url');
    return computed === codeChallenge;
}

export function genRandomId(bytes = 24) {
    return crypto.randomBytes(bytes).toString('base64url');
}

export async function createAuthCode({ clientId, userId, redirectUri, codeChallenge, codeChallengeMethod, resource, scope }) {
    await ensureSchema();
    const sql = getSql();
    const code = genRandomId(32);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await sql`
        INSERT INTO mcp_auth_codes (code, client_id, user_id, redirect_uri, code_challenge, code_challenge_method, resource, scope, expires_at)
        VALUES (${code}, ${clientId}, ${userId}, ${redirectUri}, ${codeChallenge}, ${codeChallengeMethod}, ${resource}, ${scope}, ${expiresAt})
    `;
    return code;
}

export async function consumeAuthCode(code) {
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`
        UPDATE mcp_auth_codes
        SET used_at = NOW()
        WHERE code = ${code}
          AND used_at IS NULL
          AND expires_at > NOW()
        RETURNING client_id, user_id, redirect_uri, code_challenge, code_challenge_method, resource, scope
    `;
    return rows[0] || null;
}

export async function lookupClient(clientId) {
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`
        SELECT id, client_name, redirect_uris, token_endpoint_auth_method
        FROM mcp_clients WHERE id = ${clientId} LIMIT 1
    `;
    return rows[0] || null;
}

export async function registerClient({ client_name, redirect_uris, grant_types, response_types, scope, token_endpoint_auth_method, software_id, software_version }) {
    await ensureSchema();
    const sql = getSql();
    const id = 'mcp_' + genRandomId(16);
    await sql`
        INSERT INTO mcp_clients (id, client_name, redirect_uris, token_endpoint_auth_method, grant_types, response_types, scope, software_id, software_version)
        VALUES (
            ${id},
            ${client_name || 'Unnamed MCP Client'},
            ${JSON.stringify(redirect_uris)}::jsonb,
            ${token_endpoint_auth_method || 'none'},
            ${JSON.stringify(grant_types || ['authorization_code', 'refresh_token'])}::jsonb,
            ${JSON.stringify(response_types || ['code'])}::jsonb,
            ${scope || 'mcp.read'},
            ${software_id || null},
            ${software_version || null}
        )
    `;
    return { id };
}
