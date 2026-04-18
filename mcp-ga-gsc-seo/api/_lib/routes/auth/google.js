import crypto from 'crypto';
import { serialize as serializeCookie } from 'cookie';
import { getOAuthClient, GOOGLE_SCOPES } from '../../google.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    try {
        const client = getOAuthClient();
        const state = crypto.randomBytes(16).toString('hex');

        const cookies = [serializeCookie('sol_oauth_state', state, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 600,
        })];

        const returnTo = (req.query && req.query.return_to) ? String(req.query.return_to) : '';
        if (returnTo && returnTo.startsWith('/')) {
            cookies.push(serializeCookie('sol_return_to', returnTo, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 600,
            }));
        }
        res.setHeader('Set-Cookie', cookies);

        const url = client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: GOOGLE_SCOPES,
            state,
            include_granted_scopes: true,
        });
        res.writeHead(302, { Location: url });
        res.end();
    } catch (err) {
        console.error('google auth init error:', err);
        res.status(500).json({ error: err.message });
    }
}
