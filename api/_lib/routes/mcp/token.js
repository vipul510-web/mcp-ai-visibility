import {
    consumeAuthCode,
    verifyPkceS256,
    signAccessToken,
    signRefreshToken,
    verifyRefreshToken,
    lookupClient,
    audienceFromJwtPayload,
} from '../../mcp-auth.js';

/**
 * OAuth 2.1 token endpoint. Supports authorization_code and refresh_token grants.
 * Accepts both application/x-www-form-urlencoded and application/json bodies (MCP clients vary).
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'method_not_allowed' });
    }

    const body = parseBody(req);
    const grantType = body.grant_type;
    try {
        if (grantType === 'authorization_code') {
            return await handleAuthCode(body, res);
        }
        if (grantType === 'refresh_token') {
            return await handleRefresh(body, res);
        }
        return res.status(400).json({ error: 'unsupported_grant_type' });
    } catch (err) {
        console.error('mcp token error:', err);
        return res.status(500).json({ error: 'server_error', error_description: err.message });
    }
}

async function handleAuthCode(body, res) {
    const { code, redirect_uri, client_id, code_verifier } = body;
    if (!code || !redirect_uri || !client_id || !code_verifier) {
        return res.status(400).json({ error: 'invalid_request', error_description: 'code, redirect_uri, client_id and code_verifier are required' });
    }
    const client = await lookupClient(client_id);
    if (!client) return res.status(400).json({ error: 'invalid_client' });

    const record = await consumeAuthCode(code);
    if (!record) return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code is invalid, used, or expired' });

    if (record.client_id !== client_id) return res.status(400).json({ error: 'invalid_grant', error_description: 'client_id mismatch' });
    if (record.redirect_uri !== redirect_uri) return res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' });
    if (!verifyPkceS256(code_verifier, record.code_challenge)) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
    }

    const access = signAccessToken({ userId: record.user_id, clientId: client_id, resource: record.resource, scope: record.scope });
    const refresh = signRefreshToken({ userId: record.user_id, clientId: client_id, resource: record.resource });

    return res.status(200).json({
        access_token: access,
        token_type: 'Bearer',
        expires_in: 60 * 60,
        refresh_token: refresh,
        scope: record.scope || 'mcp.read',
    });
}

async function handleRefresh(body, res) {
    const { refresh_token, client_id } = body;
    if (!refresh_token || !client_id) {
        return res.status(400).json({ error: 'invalid_request' });
    }
    const payload = verifyRefreshToken(refresh_token);
    if (!payload) return res.status(400).json({ error: 'invalid_grant', error_description: 'Refresh token invalid or expired' });
    if (payload.cid !== client_id) return res.status(400).json({ error: 'invalid_grant', error_description: 'client_id mismatch' });

    const resource = audienceFromJwtPayload(payload.aud);
    const access = signAccessToken({ userId: payload.sub, clientId: client_id, resource, scope: 'mcp.read' });
    const refresh = signRefreshToken({ userId: payload.sub, clientId: client_id, resource });

    return res.status(200).json({
        access_token: access,
        token_type: 'Bearer',
        expires_in: 60 * 60,
        refresh_token: refresh,
        scope: 'mcp.read',
    });
}

function parseBody(req) {
    if (!req.body) return {};
    if (typeof req.body === 'string') {
        try {
            return Object.fromEntries(new URLSearchParams(req.body));
        } catch {
            return {};
        }
    }
    return req.body;
}
