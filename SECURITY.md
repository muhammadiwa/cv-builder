# Security Policy

## Supported versions

Only the latest minor release receives security updates. Older versions are not patched.

| Version | Supported          |
|---------|--------------------|
| `main`  | ✅ Active          |
| < 0.x   | ❌ No longer maintained |

## Reporting a vulnerability

**Please do not open a public issue.** Public disclosure gives attackers a head start before we can ship a fix.

Send a private report instead:

- **Email**: muhammadiwa@users.noreply.github.com (or use GitHub's [private vulnerability reporting](../../security/advisories/new))
- **GitHub Security Advisories**: preferred — enables private discussion and coordinated disclosure.

Include:

1. **Description** of the vulnerability.
2. **Reproduction steps** — concrete PoC if possible.
3. **Impact** — what an attacker gains.
4. **Environment** — affected version, OS, deployment context.

### What to expect

- **Acknowledgement** within 72 hours.
- **Status update** within 7 days (triage result, planned fix timeline).
- **Fix release** as soon as practical; we aim for <30 days from report to patch.
- **Credit** in the release notes (unless you prefer anonymity).

### What falls in scope

- Anything that compromises user data: CVs, cover letters, match results, profile data.
- Authentication bypass, authorization flaws, IDOR.
- SQL injection, SSRF, XSS (including stored XSS in rendered CV templates).
- API key or secrets exposure (e.g., unencrypted LLM keys at rest).
- Dependency vulnerabilities with a credible exploit path.
- Path traversal in file exports.
- Information disclosure via error messages.

### Out of scope

- Theoretical issues without a credible exploit path.
- Rate-limiting concerns on a self-hosted single-user instance.
- Vulnerabilities in third-party providers (OpenAI, Anthropic, etc.) — report upstream.
- "I don't like this design choice" — that's a feature request, not a security issue.

## Security design notes

For transparency, here are the threat model assumptions baked into the codebase:

- **Secrets at rest**: API keys encrypted with Fernet (`backend/app/core/security.py`). The `ENCRYPTION_KEY` is derived from `SECRET_KEY` via PBKDF2 — set `SECRET_KEY` to a strong random value in production.
- **Authentication**: JWT bearer tokens, 24h expiry by default. Refresh tokens are not yet implemented.
- **Database**: SQLite by default. For production deployments, use Postgres + TLS.
- **External requests**: `job_scraper` validates URLs against an allowlist (configurable) and times out aggressively. SSRF is mitigated but not eliminated — review your proxy config.
- **CV PDF export**: WeasyPrint is sandboxed per render. Output is deterministic for a given template + input.

## Disclosure timeline

We follow a **coordinated disclosure** model:

1. Private report received → acknowledged within 72h.
2. Maintainer investigates, drafts fix, adds regression test.
3. Fix released as a patch version.
4. Public advisory published **14 days after the fix release** (or sooner if actively exploited).
5. CVE filed via GitHub Security Advisories if applicable.

## Recognition

Security researchers who follow this policy and contribute a fix will be credited in:

- The release notes.
- A `SECURITY_ACKNOWLEDGEMENTS.md` file (added after the first report).

Thanks for keeping users safe. 🛡️