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
        const admin = google.analyticsadmin({ version: 'v1beta', auth });

        const accountsResp = await admin.accountSummaries.list({ pageSize: 200 });
        const summaries = accountsResp.data.accountSummaries || [];
        const properties = [];
        for (const s of summaries) {
            for (const p of (s.propertySummaries || [])) {
                properties.push({
                    account: s.displayName,
                    propertyId: p.property?.replace('properties/', ''),
                    property: p.property,
                    displayName: p.displayName,
                });
            }
        }
        return res.status(200).json({ properties });
    } catch (err) {
        console.error('ga properties error:', err?.response?.data || err);
        return res.status(500).json({ error: err.message });
    }
}
