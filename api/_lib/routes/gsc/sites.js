import { requireUser } from '../../auth.js';
import { getUserOAuthClient } from '../../google.js';
import { google } from 'googleapis';

export default async function handler(req, res) {
    const session = requireUser(req, res);
    if (!session) return;
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    try {
        const auth = await getUserOAuthClient(session.uid);
        const wm = google.webmasters({ version: 'v3', auth });
        const resp = await wm.sites.list({});
        const sites = (resp.data.siteEntry || []).map(s => ({
            siteUrl: s.siteUrl,
            permissionLevel: s.permissionLevel,
        }));
        return res.status(200).json({ sites });
    } catch (err) {
        console.error('gsc sites error:', err?.response?.data || err);
        return res.status(500).json({ error: err.message });
    }
}
