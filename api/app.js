// Single serverless function that dispatches every new route we added
// (auth, user, ga, gsc, mcp, chat, and .well-known/*).
// Vercel rewrites map the real URLs to /api/app, and we route internally
// based on the original req.url. This keeps us under Vercel's 12-function
// limit on the Hobby plan.

import chat from './_lib/routes/chat.js';
import authGoogle from './_lib/routes/auth/google.js';
import authGoogleCallback from './_lib/routes/auth/google-callback.js';
import authMe from './_lib/routes/auth/me.js';
import authLogout from './_lib/routes/auth/logout.js';
import userApiKey from './_lib/routes/user/api-key.js';
import gaProperties from './_lib/routes/ga/properties.js';
import gscSites from './_lib/routes/gsc/sites.js';
import mcpIndex from './_lib/routes/mcp/index.js';
import mcpRegister from './_lib/routes/mcp/register.js';
import mcpAuthorize from './_lib/routes/mcp/authorize.js';
import mcpToken from './_lib/routes/mcp/token.js';
import wellknownProtectedResource from './_lib/routes/wellknown/oauth-protected-resource.js';
import wellknownAuthServer from './_lib/routes/wellknown/oauth-authorization-server.js';

// Order matters: put more-specific patterns before less-specific ones.
const ROUTES = [
    // Auth
    [/^\/api\/auth\/google\/callback\/?$/, authGoogleCallback],
    [/^\/api\/auth\/google\/?$/, authGoogle],
    [/^\/api\/auth\/me\/?$/, authMe],
    [/^\/api\/auth\/logout\/?$/, authLogout],

    // User / connected services
    [/^\/api\/user\/api-key\/?$/, userApiKey],
    [/^\/api\/ga\/properties\/?$/, gaProperties],
    [/^\/api\/gsc\/sites\/?$/, gscSites],

    // LLM chat
    [/^\/api\/chat\/?$/, chat],

    // MCP OAuth + JSON-RPC endpoints
    [/^\/api\/mcp\/register\/?$/, mcpRegister],
    [/^\/api\/mcp\/authorize\/?$/, mcpAuthorize],
    [/^\/api\/mcp\/token\/?$/, mcpToken],
    [/^\/api\/mcp\/?$/, mcpIndex],

    // .well-known discovery (served via rewrites)
    [/^\/\.well-known\/oauth-protected-resource\/?$/, wellknownProtectedResource],
    [/^\/\.well-known\/oauth-authorization-server\/?$/, wellknownAuthServer],
];

/** Vercel rewrites can leave query params only on `req.url`; merge into `req.query` for handlers. */
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
        console.error('[app.js dispatcher error]', pathname, err);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Internal server error',
                path: pathname,
                message: err?.message || String(err),
            });
        }
    }
}
