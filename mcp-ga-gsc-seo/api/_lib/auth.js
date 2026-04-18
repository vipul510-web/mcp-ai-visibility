import jwt from 'jsonwebtoken';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie';

const COOKIE_NAME = 'sol_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret() {
    const s = process.env.JWT_SECRET;
    if (!s) throw new Error('JWT_SECRET is not set');
    return s;
}

export function signSession(payload) {
    return jwt.sign(payload, getSecret(), { expiresIn: MAX_AGE_SECONDS });
}

export function verifySession(token) {
    try {
        return jwt.verify(token, getSecret());
    } catch {
        return null;
    }
}

export function setSessionCookie(res, token) {
    const serialized = serializeCookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: MAX_AGE_SECONDS,
    });
    res.setHeader('Set-Cookie', serialized);
}

export function clearSessionCookie(res) {
    const serialized = serializeCookie(COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
    });
    res.setHeader('Set-Cookie', serialized);
}

export function getSessionFromReq(req) {
    const header = req.headers.cookie || '';
    const parsed = parseCookie(header);
    const token = parsed[COOKIE_NAME];
    if (!token) return null;
    return verifySession(token);
}

export function requireUser(req, res) {
    const session = getSessionFromReq(req);
    if (!session || !session.uid) {
        res.status(401).json({ error: 'Not authenticated' });
        return null;
    }
    return session;
}

export const COOKIE = { NAME: COOKIE_NAME, MAX_AGE_SECONDS };
