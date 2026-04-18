import { parse as parseCookie, serialize as serializeCookie } from 'cookie';
import { getOAuthClient } from '../../google.js';
import { getSql, ensureSchema } from '../../db.js';
import { encrypt } from '../../crypto.js';
import { signSession, setSessionCookie } from '../../auth.js';
import { publicBase } from '../../mcp-auth.js';

/** After Google OAuth, only redirect to same-site paths we trust (including rebuilt MCP authorize URLs). */
function pickSafeReturnTo(raw) {
    if (!raw || typeof raw !== 'string') return '/chat-with-google-analytics.html';
    const t = raw.trim();
    if (!t) return '/chat-with-google-analytics.html';
    try {
        if (t.startsWith('/') && !t.startsWith('//')) return t;
        const u = new URL(t);
        const base = new URL(`${publicBase()}/`);
        if (u.hostname === base.hostname && (u.protocol === 'https:' || u.protocol === 'http:')) {
            return `${u.pathname}${u.search}${u.hash}`;
        }
    } catch {
        /* fall through */
    }
    return '/chat-with-google-analytics.html';
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    try {
        const { code, state, error: oauthError } = req.query;

        if (oauthError) {
            return redirectWithError(res, oauthError);
        }
        if (!code) {
            return redirectWithError(res, 'missing_code');
        }

        const cookies = parseCookie(req.headers.cookie || '');
        if (!state || !cookies.sol_oauth_state || cookies.sol_oauth_state !== state) {
            return redirectWithError(res, 'invalid_state');
        }

        const client = getOAuthClient();
        const { tokens } = await client.getToken(code);
        client.setCredentials(tokens);

        const oauth2 = (await import('googleapis')).google.oauth2({ version: 'v2', auth: client });
        const { data: profile } = await oauth2.userinfo.get();

        await ensureSchema();
        const sql = getSql();

        const users = await sql`
            INSERT INTO users (google_sub, email, name, picture)
            VALUES (${profile.id}, ${profile.email}, ${profile.name || ''}, ${profile.picture || ''})
            ON CONFLICT (google_sub) DO UPDATE
            SET email = EXCLUDED.email,
                name = EXCLUDED.name,
                picture = EXCLUDED.picture,
                updated_at = NOW()
            RETURNING id, email, name, picture
        `;
        const user = users[0];

        if (tokens.refresh_token) {
            const encryptedRT = encrypt(tokens.refresh_token);
            await sql`
                INSERT INTO user_connections (user_id, provider, encrypted_refresh_token, scope)
                VALUES (${user.id}, 'google', ${encryptedRT}, ${tokens.scope || ''})
                ON CONFLICT (user_id, provider) DO UPDATE
                SET encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
                    scope = EXCLUDED.scope,
                    updated_at = NOW()
            `;
        } else {
            // No refresh token returned (user already granted before without prompt=consent).
            // Ensure a row exists; if not, we'll prompt=consent reauth next time. With prompt=consent
            // above we should always get one.
        }

        const token = signSession({ uid: user.id, email: user.email, name: user.name });
        setSessionCookie(res, token);

        const returnTo = pickSafeReturnTo(cookies.sol_return_to);

        // Clear state + return_to cookies alongside the session cookie we just set
        const existing = res.getHeader('Set-Cookie');
        const arr = Array.isArray(existing) ? existing.slice() : (existing ? [existing] : []);
        arr.push(serializeCookie('sol_oauth_state', '', { path: '/', maxAge: 0 }));
        arr.push(serializeCookie('sol_return_to', '', { path: '/', maxAge: 0 }));
        res.setHeader('Set-Cookie', arr);

        res.writeHead(302, { Location: returnTo });
        res.end();
    } catch (err) {
        console.error('google callback error:', err);
        redirectWithError(res, 'oauth_failed');
    }
}

function redirectWithError(res, code) {
    res.writeHead(302, { Location: `/chat-with-google-analytics.html?auth_error=${encodeURIComponent(code)}` });
    res.end();
}
