import cookie from 'cookie';
import { getSessionFromReq } from '../_lib/auth.js';
import { getSql, ensureSchema } from '../_lib/db.js';
import { lookupClient, createAuthCode } from '../_lib/mcp-auth.js';

/**
 * OAuth 2.1 authorization endpoint.
 *
 * Flow:
 *  1. Claude redirects the user's browser here with code_challenge + redirect_uri + state.
 *  2. If the user has no active sellonllm session, we bounce them through Google OAuth
 *     (carrying this URL in a return_to cookie) and come back here once they're signed in.
 *  3. We show a short consent page that posts to ?confirm=1, which then redirects back to
 *     Claude's callback with ?code=...&state=...
 */
export default async function handler(req, res) {
    try {
        if (req.method !== 'GET' && req.method !== 'POST') {
            return res.status(405).send('Method Not Allowed');
        }

        const q = req.query || {};
        const clientId = String(q.client_id || '');
        const redirectUri = String(q.redirect_uri || '');
        const responseType = String(q.response_type || 'code');
        const codeChallenge = String(q.code_challenge || '');
        const codeChallengeMethod = String(q.code_challenge_method || 'S256');
        const state = String(q.state || '');
        const scope = String(q.scope || 'mcp.read');
        const resource = q.resource ? String(q.resource) : null;

        if (responseType !== 'code') return renderError(res, 'unsupported_response_type', 'Only response_type=code is supported');
        if (!clientId) return renderError(res, 'invalid_request', 'client_id is required');
        if (!redirectUri) return renderError(res, 'invalid_request', 'redirect_uri is required');
        if (!codeChallenge) return renderError(res, 'invalid_request', 'code_challenge is required (PKCE)');
        if (codeChallengeMethod !== 'S256') return renderError(res, 'invalid_request', 'code_challenge_method must be S256');

        await ensureSchema();
        const client = await lookupClient(clientId);
        if (!client) return renderError(res, 'invalid_client', 'Unknown client_id — was it registered?');

        const allowed = Array.isArray(client.redirect_uris) ? client.redirect_uris : [];
        if (!allowed.includes(redirectUri)) return renderError(res, 'invalid_request', 'redirect_uri is not registered for this client');

        const session = getSessionFromReq(req);
        if (!session || !session.uid) {
            // Bounce through Google OAuth, preserving this URL.
            const returnTo = req.url;
            res.setHeader('Set-Cookie', cookie.serialize('sol_return_to', returnTo, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 600,
            }));
            res.writeHead(302, { Location: '/api/auth/google' });
            return res.end();
        }

        // Verify the user still exists
        const sql = getSql();
        const rows = await sql`SELECT id, email, name FROM users WHERE id = ${session.uid} LIMIT 1`;
        if (!rows.length) {
            return renderError(res, 'access_denied', 'Session user not found');
        }
        const user = rows[0];

        // If user clicked "Allow", mint a code and redirect back to Claude.
        if (req.method === 'POST' || q.confirm === '1') {
            const code = await createAuthCode({
                clientId,
                userId: user.id,
                redirectUri,
                codeChallenge,
                codeChallengeMethod,
                resource,
                scope,
            });
            const url = new URL(redirectUri);
            url.searchParams.set('code', code);
            if (state) url.searchParams.set('state', state);
            res.writeHead(302, { Location: url.toString() });
            return res.end();
        }

        // Otherwise, show a consent screen.
        const clientName = client.client_name || 'an MCP client';
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(renderConsent({
            user,
            clientName,
            scope,
            continueUrl: `${req.url}${req.url.includes('?') ? '&' : '?'}confirm=1`,
        }));
    } catch (err) {
        console.error('mcp authorize error:', err);
        return renderError(res, 'server_error', err.message);
    }
}

function renderConsent({ user, clientName, scope, continueUrl }) {
    const safe = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Authorise ${safe(clientName)} | SellOnLLM</title>
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #0f172a; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #fff; max-width: 480px; width: 100%; border-radius: 16px; padding: 36px 32px; box-shadow: 0 20px 50px -15px rgba(15,23,42,.15); border: 1px solid #e2e8f0; }
    .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
    .brand img { width: 32px; height: 32px; }
    .brand span { font-weight: 800; font-size: 1.05rem; }
    .brand span em { color: #6366f1; font-style: normal; }
    h1 { font-size: 1.35rem; font-weight: 800; line-height: 1.3; margin-bottom: 10px; letter-spacing: -0.01em; }
    p { color: #475569; line-height: 1.55; margin-bottom: 18px; font-size: 0.95rem; }
    .who { background: #f1f5f9; border-radius: 10px; padding: 12px 14px; margin-bottom: 22px; font-size: 0.88rem; color: #334155; }
    .who strong { color: #0f172a; }
    ul { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px 12px 32px; margin-bottom: 24px; }
    li { padding: 3px 0; font-size: 0.9rem; color: #334155; }
    .btns { display: flex; gap: 10px; }
    .btn { flex: 1; padding: 12px 16px; border-radius: 10px; font-weight: 600; font-size: 0.95rem; cursor: pointer; border: 1px solid transparent; text-align: center; text-decoration: none; display: inline-block; }
    .btn.primary { background: #6366f1; color: #fff; }
    .btn.primary:hover { background: #4f46e5; }
    .btn.ghost { background: #fff; color: #334155; border-color: #e2e8f0; }
    .btn.ghost:hover { border-color: #cbd5e1; }
    .muted { font-size: 0.78rem; color: #64748b; margin-top: 18px; text-align: center; }
</style>
</head><body>
<div class="card">
    <div class="brand">
        <img src="/images/logo.png" alt="SellOnLLM">
        <span>Sell<em>On</em>LLM</span>
    </div>
    <h1>Allow <strong>${safe(clientName)}</strong> to read your Analytics data?</h1>
    <div class="who">Signed in as <strong>${safe(user.email)}</strong></div>
    <p>${safe(clientName)} is asking to use your connected Google Analytics and Search Console through SellOnLLM.</p>
    <ul>
        <li>Read Google Analytics 4 reports (read-only)</li>
        <li>Read Search Console queries &amp; pages (read-only)</li>
        <li>No write, edit, or admin access</li>
    </ul>
    <form method="POST" action="${safe(continueUrl)}">
        <div class="btns">
            <a class="btn ghost" href="/chat-with-google-analytics.html">Cancel</a>
            <button class="btn primary" type="submit">Allow</button>
        </div>
    </form>
    <div class="muted">You can revoke access any time at <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener">myaccount.google.com/permissions</a>.</div>
</div>
</body></html>`;
}

function renderError(res, code, description) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(`<!DOCTYPE html><html><body style="font-family:system-ui;padding:40px;max-width:640px;margin:0 auto;color:#0f172a">
<h2 style="margin-bottom:12px">Authorisation error</h2>
<p><strong>${code}</strong></p>
<p>${description || ''}</p>
<p style="margin-top:20px"><a href="/chat-with-google-analytics.html">Back to SellOnLLM</a></p>
</body></html>`);
}
