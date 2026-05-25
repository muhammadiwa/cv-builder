# Story 1.4: User Registration & Authentication

**Status:** ready-for-dev
**Epic:** 1 — Foundation, Auth & Infrastructure
**Created:** 2026-05-25

---

## User Story

As a job seeker,
I want to sign up and log in using my preferred method,
So that I can access Lolos and start building my CV.

---

## Acceptance Criteria

**AC-1:** Given a new user on the sign-up screen, When they choose WhatsApp OTP, Then a 6-digit OTP is sent to their phone number within 10 seconds.

**AC-2:** Given a user with a Google account, When they click "Sign in with Google", Then they are authenticated via OAuth and redirected to the dashboard.

**AC-3:** Given a user with a LinkedIn account, When they click "Sign in with LinkedIn", Then they are authenticated via OAuth.

**AC-4:** And JWT access token (15min, memory-only) and httpOnly refresh token (7 days, rotation) are issued.

**AC-5:** And max 5 concurrent sessions per user; exceeding invalidates oldest.

**AC-6:** And failed login rate limit: 5 attempts per 5 minutes per IP.

**AC-7:** And users can log out, which invalidates all refresh tokens.

---

## Developer Context

### Architecture

**Auth flow:** WhatsApp OTP, Google OAuth, LinkedIn OAuth, email magic link. JWT access token (15min, stored in memory only — never localStorage). httpOnly refresh token (7 days, rotation on use — old token invalidated). Max 5 concurrent sessions. Rate limiting: 5 attempts/5min/IP.

**NestJS module structure:** `apps/api/src/auth/` — `auth.module.ts`, `auth.controller.ts`, `auth.service.ts`, `auth.guard.ts`, `strategies/`.

### Technical Requirements

- NestJS `@nestjs/jwt` for JWT issuance and verification
- NestJS `@nestjs/passport` + `passport-google-oauth20` + `passport-linkedin-oauth2`
- `@nestjs/throttler` for rate limiting
- WhatsApp OTP via WhatsApp Business API (Twilio or WATI) — mock/stub for now, real integration in later story
- Refresh tokens stored in Redis with TTL (7 days)
- Refresh token rotation: issue new refresh token on each use, invalidate old
- Session tracking: store up to 5 active refresh tokens per user in Redis set
- Password hashing: bcrypt (cost factor 12) for email/password users
- Google OAuth scopes: `profile`, `email` only
- LinkedIn OAuth scopes: `openid`, `profile`, `email`

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/auth/register` | Email+password registration |
| POST | `/api/v1/auth/login` | Email+password login |
| POST | `/api/v1/auth/whatsapp/send` | Send WhatsApp OTP |
| POST | `/api/v1/auth/whatsapp/verify` | Verify WhatsApp OTP |
| GET | `/api/v1/auth/google` | Google OAuth redirect |
| GET | `/api/v1/auth/google/callback` | Google OAuth callback |
| GET | `/api/v1/auth/linkedin` | LinkedIn OAuth redirect |
| GET | `/api/v1/auth/linkedin/callback` | LinkedIn OAuth callback |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Invalidate refresh tokens |
| GET | `/api/v1/auth/me` | Get current user |

### Testing Requirements

- All auth endpoints return correct HTTP status codes
- JWT tokens contain correct user ID and are verifiable
- Refresh token rotation: old token rejected after use
- Rate limiting blocks after 5 failed attempts within 5 minutes
- Session limit enforced: 6th session invalidates oldest
- WhatsApp OTP: mock service returns predictable codes in test mode

### Dev Notes

- Stories 1.1-1.3 complete (monorepo, design system, DB schema)
- Database schema has `users` table ready for this story
- `packages/database` exports Prisma client — use it from `apps/api`
- WhatsApp OTP: use stub/mock for now — real Twilio/WATI integration is a separate story
- Store JWKS or secret in environment variables (not hardcoded)
- `.env.example` should document: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `WHATSAPP_API_KEY`
