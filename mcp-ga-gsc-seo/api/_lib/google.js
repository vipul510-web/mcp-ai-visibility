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
    const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
    const redirectUri =
        process.env.GOOGLE_REDIRECT_URI
        || (base ? `${base}/api/auth/google/callback` : null);
    if (!redirectUri) {
        throw new Error('Set GOOGLE_REDIRECT_URI or PUBLIC_BASE_URL (callback will be {PUBLIC_BASE_URL}/api/auth/google/callback)');
    }
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

/** OAuth scope string last stored for this user (space-separated). */
export async function getGoogleStoredScope(userId) {
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`
        SELECT scope FROM user_connections
        WHERE user_id = ${userId} AND provider = 'google'
        LIMIT 1
    `;
    return rows[0]?.scope || '';
}

/**
 * Ensures the saved Google consent includes Search Console read access.
 * Without it, Search Console APIs return errors or empty lists and Claude looks “disconnected”.
 */
export async function assertWebmastersReadonlyScope(userId) {
    const scope = await getGoogleStoredScope(userId);
    if (!scope) {
        throw new Error(
            'No Google OAuth scopes on file. Finish the MCP flow by signing in with Google and granting Analytics + Search Console.',
        );
    }
    if (!scope.includes('webmasters')) {
        throw new Error(
            'Search Console access is missing on this Google connection (stored scopes do not include webmasters.readonly). Fix: remove this app at https://myaccount.google.com/permissions, disconnect the MCP connector in Claude, connect again, and on the Google consent screen accept both Analytics and Search Console. Workspace users may need an admin to allow the Search Console scope.',
        );
    }
}
