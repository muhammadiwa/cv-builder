# Story 1.5: PII Stripping Gateway

**Status:** ready-for-dev
**Epic:** 1 — Foundation, Auth & Infrastructure
**Created:** 2026-05-25

---

## User Story

As a security architect,
I want a single global NestJS interceptor that strips PII before all LLM API calls,
So that no personal data ever leaves Indonesian jurisdiction.

---

## Acceptance Criteria

**AC-1:** Given any outbound LLM API request, When the PII stripping interceptor processes it, Then fields (name, email, phone, address, photo, NIK/KTP) are replaced with placeholders.

**AC-2:** And auto-fail if PII regex is detected in outbound payload (HTTP 500 logged).

**AC-3:** And audit log records every strip/inject operation with timestamp and user ID.

**AC-4:** And original PII values are available to PDF/DOCX rendering service only.

---

## Developer Context

### Architecture (Architectural Invariant)

This is the SINGLE enforcement point for UU PDP compliance. PII (name, email, phone, address, photo URL, NIK/KTP) must never leave Indonesian jurisdiction. The gateway strips PII from all outbound LLM API calls and replaces values with placeholders. Original values are injected back at the PDF/DOCX rendering stage only.

**Pattern:** Global NestJS interceptor — NOT per-service filtering. Every LLM API call passes through this interceptor regardless of which service made it.

### Technical Requirements

**PII fields to strip:**
- `fullName` → `[USER_NAME]`
- `email` → `[USER_EMAIL]`
- `phone` → `[USER_PHONE]`
- `address` / `location` → `[USER_ADDRESS]`
- `photoUrl` → `[USER_PHOTO]`
- `nik` / `ktp` → `[USER_NIK]`

**Interceptor location:** `apps/api/src/common/pii-stripping.interceptor.ts`

**Detection method:** Regex patterns for each PII type:
- Email: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Phone (Indonesia): `/^(\+62|62|0)8[1-9][0-9]{6,10}$/`
- NIK: `/^\d{16}$/`

**Audit log:** Each strip/inject operation logged to `ai_usage_logs` table with operation_type = `pii_strip` or `pii_inject`.

**Auto-fail:** If PII regex matches in the OUTBOUND payload (after stripping), the request is blocked with HTTP 500 and logged as a security incident.

### Testing Requirements

- Unit: interceptor strips known PII from JSON payloads
- Unit: interceptor blocks payloads with remaining PII (auto-fail)
- Unit: audit log entries created with correct user ID and timestamp
- Integration: PII stripping works end-to-end through the NestJS request pipeline
- Integration: original values available to PII injection service

### Dev Notes

- Stories 1.1-1.4 complete
- This is an architectural invariant — single enforcement point
- PII injection service (`pii-injection.service.ts`) needed for PDF/DOCX rendering
- Interceptor should be applied globally in `AppModule`
- Regex patterns should be loaded from config, not hardcoded
- Test with realistic Indonesian PII data (nama lengkap, nomor HP, alamat)
- PDF/DOCX rendering service will use PII injection in a later story (Epic 5)
