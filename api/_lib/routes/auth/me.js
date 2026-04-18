import { getSessionFromReq } from '../../auth.js';
import { getSql, ensureSchema } from '../../db.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const session = getSessionFromReq(req);
    if (!session || !session.uid) {
        return res.status(200).json({ authenticated: false });
    }
    try {
        await ensureSchema();
        const sql = getSql();
        const rows = await sql`
            SELECT u.id, u.email, u.name, u.picture,
                   (SELECT 1 FROM user_connections c WHERE c.user_id = u.id AND c.provider = 'google') AS google_connected,
                   (SELECT provider FROM user_secrets s WHERE s.user_id = u.id LIMIT 1) AS llm_provider
            FROM users u WHERE u.id = ${session.uid}
        `;
        if (!rows.length) {
            return res.status(200).json({ authenticated: false });
        }
        const u = rows[0];
        return res.status(200).json({
            authenticated: true,
            user: {
                id: u.id,
                email: u.email,
                name: u.name,
                picture: u.picture,
                googleConnected: !!u.google_connected,
                llmProvider: u.llm_provider || null,
            },
        });
    } catch (err) {
        console.error('me error:', err);
        return res.status(500).json({ error: err.message });
    }
}
