import { clearSessionCookie } from '../_lib/auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    clearSessionCookie(res);
    if (req.method === 'GET') {
        res.writeHead(302, { Location: '/chat-with-google-analytics.html' });
        return res.end();
    }
    return res.status(200).json({ ok: true });
}
