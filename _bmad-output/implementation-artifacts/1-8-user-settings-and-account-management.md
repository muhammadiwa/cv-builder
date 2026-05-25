# Story 1.8: User Settings & Account Management

**Status:** ready-for-dev
**Epic:** 1 — Foundation, Auth & Infrastructure
**Created:** 2026-05-25

---

## User Story

As a registered user,
I want to manage my profile, language preference, and account settings,
So that I can control my Lolos experience.

---

## Acceptance Criteria

**AC-1:** Given an authenticated user, When navigating to Settings, Then they can update name, photo, phone, and email.

**AC-2:** And toggle language between Bahasa Indonesia and English.

**AC-3:** And toggle dark/light mode.

**AC-4:** And view active sessions and revoke any session.

**AC-5:** And request account deletion (30-day soft delete grace period).

---

## Developer Context

### Technical Requirements

- Settings page at `apps/web/app/(dashboard)/settings/page.tsx`
- Profile update via tRPC or REST endpoint
- Language preference persisted to `user.languagePreference` in DB
- Dark mode toggle updates ThemeProvider + localStorage
- Active sessions from Redis: `SMEMBERS sessions:{userId}` → display with created time from ZSET scores
- Session revocation: call existing `authService.logout(userId, tokenId)`
- Account deletion: soft-delete (30-day grace period), anonymize PII, keep anonymized usage data

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| PATCH | `/api/v1/users/me` | Update profile |
| GET | `/api/v1/users/me/sessions` | List active sessions |
| DELETE | `/api/v1/users/me/sessions/:tokenId` | Revoke session |
| DELETE | `/api/v1/users/me` | Request account deletion |

### Dev Notes

- Story 1.1-1.7 complete
- Auth system from 1.4 provides session data via Redis
- Theme provider from 1.2 handles dark/light mode
- Settings page uses Shadcn/ui components (Card, Input, Button, Switch, Tabs)
- Account deletion: add `deletedAt` field to User model
