/**
 * RFC 9728 - OAuth 2.0 Protected Resource Metadata.
 * Tells MCP clients (like Claude) where our authorisation server lives.
 * Exposed at /.well-known/oauth-protected-resource via a rewrite.
 */
export default function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
    if (!base) {
        return res.status(500).json({ error: 'PUBLIC_BASE_URL is not set' });
    }
    const docs = process.env.MCP_RESOURCE_DOCUMENTATION_URL || `${base}/`;
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
        resource: `${base}/api/mcp`,
        authorization_servers: [base],
        scopes_supported: ['mcp.read'],
        bearer_methods_supported: ['header'],
        resource_documentation: docs,
    });
}
