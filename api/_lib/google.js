import { google } from 'googleapis';
import { getSql, ensureSchema } from './db.js';
import { decrypt } from './crypto.js';

export const GOOGLE_SCOPES = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/analytics.readonly',
    'https://www.googleapis.com/auth/webmasters.readonly',
];

export function getOAuthClient() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI
        || 'https://sellonllm.com/api/auth/google/callback';
    if (!clientId || !clientSecret) {
        throw new Error('GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not set');
    }
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function getUserOAuthClient(userId) {
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`
        SELECT encrypted_refresh_token
        FROM user_connections
        WHERE user_id = ${userId} AND provider = 'google'
        LIMIT 1
    `;
    if (!rows.length) throw new Error('Google connection not found for user');
    const refreshToken = decrypt(rows[0].encrypted_refresh_token);
    const client = getOAuthClient();
    client.setCredentials({ refresh_token: refreshToken });
    return client;
}
