import { registerClient } from '../_lib/mcp-auth.js';

/**
 * RFC 7591 - OAuth 2.0 Dynamic Client Registration.
 * Claude calls this automatically when a user adds the custom connector.
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'method_not_allowed' });
    }
    try {
        const body = req.body || {};
        const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter(u => typeof u === 'string') : [];
        if (!redirectUris.length) {
            return res.status(400).json({ error: 'invalid_client_metadata', error_description: 'redirect_uris is required' });
        }
        const { id } = await registerClient({
            client_name: body.client_name,
            redirect_uris: redirectUris,
            grant_types: body.grant_types,
            response_types: body.response_types,
            scope: body.scope,
            token_endpoint_auth_method: body.token_endpoint_auth_method || 'none',
            software_id: body.software_id,
            software_version: body.software_version,
        });
        return res.status(201).json({
            client_id: id,
            client_id_issued_at: Math.floor(Date.now() / 1000),
            redirect_uris: redirectUris,
            grant_types: body.grant_types || ['authorization_code', 'refresh_token'],
            response_types: body.response_types || ['code'],
            token_endpoint_auth_method: body.token_endpoint_auth_method || 'none',
            scope: body.scope || 'mcp.read',
        });
    } catch (err) {
        console.error('mcp register error:', err);
        return res.status(500).json({ error: 'server_error', error_description: err.message });
    }
}
