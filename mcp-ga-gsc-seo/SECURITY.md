# Security policy

## Never commit secrets

The following must **only** exist in your host’s environment (e.g. Vercel project settings), a password manager, or GitHub **Actions secrets** — never in source code, issues, or wiki:

- `GOOGLE_CLIENT_SECRET`
- `DATABASE_URL`
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- Any third-party API keys

If any of these were ever pushed to a public repository, treat them as **compromised**: rotate immediately and audit access.

## Supported versions

Use a maintained **Node.js LTS** (≥ 18) and keep `googleapis` / `@neondatabase/serverless` reasonably up to date for security patches.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for undisclosed security problems. Contact the repository maintainer through a private channel (e.g. GitHub Security Advisories for this repo, or the email listed on the maintainer’s profile / product site).

## OAuth and data

- This server requests **read-only** Google Analytics and Search Console scopes.
- Google refresh tokens are stored **encrypted** in the database; MCP access tokens are short-lived JWTs.
- Operators should use Google Cloud OAuth **Testing / Production** rules appropriate to their audience and complete Google’s verification for sensitive scopes before broad public launch.
