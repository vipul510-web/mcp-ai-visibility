import { requireUser } from '../_lib/auth.js';
import { getSql, ensureSchema } from '../_lib/db.js';
import { encrypt } from '../_lib/crypto.js';

export default async function handler(req, res) {
    const session = requireUser(req, res);
    if (!session) return;

    if (req.method === 'POST') {
        const { provider, apiKey } = req.body || {};
        if (!provider || !apiKey) {
            return res.status(400).json({ error: 'provider and apiKey are required' });
        }
        if (!['anthropic', 'openai'].includes(provider)) {
            return res.status(400).json({ error: 'provider must be "anthropic" or "openai"' });
        }
        const trimmed = String(apiKey).trim();
        if (trimmed.length < 15) {
            return res.status(400).json({ error: 'API key looks invalid' });
        }
        try {
            await ensureSchema();
            const sql = getSql();
            const enc = encrypt(trimmed);
            await sql`
                INSERT INTO user_secrets (user_id, provider, encrypted_key)
                VALUES (${session.uid}, ${provider}, ${enc})
                ON CONFLICT (user_id, provider) DO UPDATE
                SET encrypted_key = EXCLUDED.encrypted_key,
                    updated_at = NOW()
            `;
            // Only keep one provider at a time; delete the other
            const other = provider === 'anthropic' ? 'openai' : 'anthropic';
            await sql`DELETE FROM user_secrets WHERE user_id = ${session.uid} AND provider = ${other}`;
            return res.status(200).json({ ok: true, provider });
        } catch (err) {
            console.error('save api key error:', err);
            return res.status(500).json({ error: err.message });
        }
    }

    if (req.method === 'DELETE') {
        try {
            await ensureSchema();
            const sql = getSql();
            await sql`DELETE FROM user_secrets WHERE user_id = ${session.uid}`;
            return res.status(200).json({ ok: true });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
