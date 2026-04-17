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
    return (process.env.PUBLIC_BASE_URL || 'https://sellonllm.com').replace(/\/+$/, '');
}

export function signAccessToken({ userId, clientId, resource, scope }) {
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
            audience: resource || `${publicBase()}/api/mcp`,
            issuer: publicBase(),
        },
    );
}

export function signRefreshToken({ userId, clientId, resource }) {
    return jwt.sign(
        { sub: userId, cid: clientId, typ: 'mcp_refresh' },
        getSecret(),
        {
            expiresIn: '30d',
            audience: resource || `${publicBase()}/api/mcp`,
            issuer: publicBase(),
        },
    );
}

export function verifyAccessToken(token) {
    try {
        const payload = jwt.verify(token, getSecret(), {
            audience: `${publicBase()}/api/mcp`,
            issuer: publicBase(),
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
            audience: `${publicBase()}/api/mcp`,
            issuer: publicBase(),
        });
        if (payload.typ !== 'mcp_refresh') return null;
        return payload;
    } catch {
        return null;
    }
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
