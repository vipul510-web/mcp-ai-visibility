# Chat with Google Analytics — Setup Guide

This feature adds a logged-in page at `/chat-with-google-analytics.html` where users can:
- Sign in with Google
- One-click connect Google Analytics 4 and Search Console
- Save their own Anthropic (Claude) or OpenAI (ChatGPT) API key
- Ask questions about their SEO and get AI-generated recommendations grounded in real data

## 1. Google Cloud Console setup (one-time)

1. Go to https://console.cloud.google.com — create or pick a project.
2. **Enable APIs** (APIs & Services → Library):
   - **Google Analytics Admin API**
   - **Google Analytics Data API**
   - **Google Search Console API**
3. **OAuth consent screen** (APIs & Services → OAuth consent screen):
   - User type: **External**
   - App name: `SellOnLLM`
   - Support email + developer email: your email
   - Authorized domains: `sellonllm.com`
   - Scopes (click *Add or remove scopes*):
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `openid`
     - `.../auth/analytics.readonly`
     - `.../auth/webmasters.readonly`
   - Test users: add your Google account(s) while app is in **Testing** mode.
   - If you want unlimited users, submit for **Verification** (Google review, 2–6 weeks; required when using sensitive scopes like Analytics read-only).
4. **Create OAuth 2.0 Client ID** (APIs & Services → Credentials → *Create credentials* → *OAuth client ID*):
   - Application type: **Web application**
   - Name: `SellOnLLM Web`
   - Authorized JavaScript origins: `https://sellonllm.com`
   - Authorized redirect URIs:
     - `https://sellonllm.com/api/auth/google/callback`
     - (optional for local dev) `http://localhost:3000/api/auth/google/callback`
   - Copy the **Client ID** and **Client secret**.

## 2. Vercel environment variables

In Vercel → your project → **Settings → Environment Variables**, add:

| Key | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth client ID from step 1 |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret from step 1 |
| `GOOGLE_REDIRECT_URI` | `https://sellonllm.com/api/auth/google/callback` |
| `JWT_SECRET` | Any long random string, e.g. `openssl rand -hex 48` |
| `ENCRYPTION_KEY` | 32-byte key (hex): `openssl rand -hex 32` |
| `DATABASE_URL` | (already set) your Neon Postgres URL |

Apply them to Production + Preview + Development. Redeploy after saving.

### Generating secrets

```bash
# JWT_SECRET
openssl rand -hex 48

# ENCRYPTION_KEY (exactly 32 bytes / 64 hex chars)
openssl rand -hex 32
```

Keep both values safe — rotating `ENCRYPTION_KEY` will invalidate all stored refresh tokens and saved API keys.

## 3. Database

The API automatically creates the required tables on first request (`users`, `user_connections`, `user_secrets`). No migration step needed. Tables are created in the same Neon DB as the existing `feedback` table via `DATABASE_URL`.

If you prefer to create them manually:

```sql
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_sub VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    picture TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS user_connections (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(32) NOT NULL,
    encrypted_refresh_token TEXT NOT NULL,
    scope TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, provider)
);
CREATE TABLE IF NOT EXISTS user_secrets (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(32) NOT NULL,
    encrypted_key TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, provider)
);
```

## 4. Deploy and test

1. Commit + push — Vercel will deploy automatically.
2. Visit `https://sellonllm.com/chat-with-google-analytics.html`.
3. Click **Sign in with Google**. Grant Analytics + Search Console read-only access.
4. Select a GA4 property and a Search Console site.
5. Paste an Anthropic or OpenAI key and click **Save key**.
6. Click a preset prompt (or type your own) → **Send**.

## 5. How it works

1. User signs in with Google → we store their profile + encrypted refresh token in `user_connections`.
2. User saves a Claude/OpenAI key → stored encrypted (AES-256-GCM) in `user_secrets`.
3. On a chat request:
   - `api/chat.js` loads the user's refresh token, exchanges it for a fresh access token.
   - Pulls 28 days of GA4 (traffic, top pages, channels, countries) and GSC (top queries, pages, countries, devices).
   - Composes a system prompt with that data, sends to the user's LLM provider using **their** API key.
   - Returns the Markdown response for rendering.

The LLM provider only ever sees aggregated reporting data — no raw PII.

## 6. Endpoints

| Path | Method | Purpose |
|---|---|---|
| `/api/auth/google` | GET | Kick off Google OAuth |
| `/api/auth/google/callback` | GET | OAuth callback — sets session cookie |
| `/api/auth/me` | GET | Return current user info |
| `/api/auth/logout` | POST/GET | Clear session |
| `/api/user/api-key` | POST / DELETE | Save/remove encrypted LLM key |
| `/api/ga/properties` | GET | List user's GA4 properties |
| `/api/gsc/sites` | GET | List user's Search Console sites |
| `/api/chat` | POST | Run a chat turn |

## 7. Customising the preset prompts

Edit the `PRESET_PROMPTS` array in `chat-with-google-analytics.html`. Each prompt is `{ tag, text }`.

## 8. Troubleshooting

- **`redirect_uri_mismatch`** — the URI in your Google OAuth client must exactly match `GOOGLE_REDIRECT_URI` (and include `https://`).
- **403 from Analytics/Search Console** — the signed-in user must have access to that property/site in their own Google account.
- **"No LLM API key saved"** — the user hasn't saved their Anthropic/OpenAI key yet.
- **Google asks again for consent on every sign-in** — expected; we request `prompt=consent` to ensure a refresh token.
- **Local dev** — set `GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback` (add it to your OAuth client), run `vercel dev`.
