/**
 * MCP-only HTTP dispatcher for Vercel (or any Node request/response handler).
 * Maps the same routes as SellOnLLM’s production MCP surface: OAuth, JSON-RPC, discovery.
 */

import authGoogle from './_lib/routes/auth/google.js';
import authGoogleCallback from './_lib/routes/auth/google-callback.js';
import mcpIndex from './_lib/routes/mcp/index.js';
import mcpRegister from './_lib/routes/mcp/register.js';
import mcpAuthorize from './_lib/routes/mcp/authorize.js';
import mcpToken from './_lib/routes/mcp/token.js';
import wellknownProtectedResource from './_lib/routes/wellknown/oauth-protected-resource.js';
import wellknownAuthServer from './_lib/routes/wellknown/oauth-authorization-server.js';

const ROUTES = [
    [/^\/api\/auth\/google\/callback\/?$/, authGoogleCallback],
    [/^\/api\/auth\/google\/?$/, authGoogle],
    [/^\/api\/mcp\/register\/?$/, mcpRegister],
    [/^\/api\/mcp\/authorize\/?$/, mcpAuthorize],
    [/^\/api\/mcp\/token\/?$/, mcpToken],
    [/^\/api\/mcp\/?$/, mcpIndex],
    [/^\/\.well-known\/oauth-protected-resource\/?$/, wellknownProtectedResource],
    [/^\/\.well-known\/oauth-authorization-server\/?$/, wellknownAuthServer],
];

function mergeQueryFromUrl(req) {
    const existing =
        req.query && typeof req.query === 'object' && !Array.isArray(req.query)
            ? { ...req.query }
            : {};
    try {
        const u = new URL(req.url || '', 'http://localhost');
        u.searchParams.forEach((v, k) => {
            if (existing[k] === undefined) existing[k] = v;
        });
    } catch {
        /* ignore */
    }
    return existing;
}

export default async function handler(req, res) {
    req.query = mergeQueryFromUrl(req);

    const pathname = (() => {
        try {
            return new URL(req.url, 'http://x').pathname;
        } catch {
            return req.url || '';
        }
    })();

    try {
        for (const [pattern, fn] of ROUTES) {
            if (pattern.test(pathname)) {
                return await fn(req, res);
            }
        }
        res.status(404).json({ error: 'Not found', path: pathname });
    } catch (err) {
        console.error('[mcp-ga-gsc-seo app]', pathname, err);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Internal server error',
                path: pathname,
                message: err?.message || String(err),
            });
        }
    }
}
