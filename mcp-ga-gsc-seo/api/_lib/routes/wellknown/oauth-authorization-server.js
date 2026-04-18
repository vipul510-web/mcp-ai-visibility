/**
 * RFC 8414 - OAuth 2.0 Authorization Server Metadata.
 * Exposed at /.well-known/oauth-authorization-server via a rewrite.
 */
export default function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
    if (!base) {
        return res.status(500).json({ error: 'PUBLIC_BASE_URL is not set' });
    }
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
        issuer: base,
        authorization_endpoint: `${base}/api/mcp/authorize`,
        token_endpoint: `${base}/api/mcp/token`,
        registration_endpoint: `${base}/api/mcp/register`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'],
        scopes_supported: ['mcp.read'],
    });
}
