# Career Code — Security & QA Report

**Branch:** `feat/postgres-migration` (commit `ffc86d6` + uncommitted docs)
**Date:** 2026-11-02
**Scope:** whole product after the Firebase → PostgreSQL migration — server (Express,
Socket.IO, PostgreSQL), frontend (React), dependencies, git history.

---

## 1. Summary

| | Result |
|---|---|
| Overall | **Not ready for production yet.** No critical issues; **3 high** must be fixed first (1 security, 2 data/logic). Core security model (sessions, permissions, data isolation) holds up well. |
| Automated API QA | **653 checks, 630 passed, 23 failed** → 17 real bugs (all listed below) |
| Attack testing | Account takeover, role escalation, cross-student/cross-admin access, socket eavesdropping, SQL injection, CSRF, upload tricks — **all blocked** |
| Production dependencies | **0 known vulnerabilities** (`npm audit --omit=dev`) |
| Dev-only dependencies | 4 moderate (old `esbuild` inside `drizzle-kit`; never runs in production) |
| Frontend type check / build | Clean |

### Findings by severity (after merging duplicates)

| Severity | Security | Functional | Total |
|---|---|---|---|
| Critical | 0 | 0 | 0 |
| High | 1 | 2 | **3** |
| Medium | 5 | 9 | **14** |
| Low | 7 | 16 | **23** |

---

## 2. How it was tested

1. **Server security audit** — every server file read; an isolated server instance
   was attacked with real requests per role (student ×3, normal/expert/super admin).
2. **Frontend security & correctness review** — every file in `src/` checked against
   the server routes and socket events; XSS candidates executed through the real
   sanitizer.
3. **API QA suite** — one scripted scenario covering every endpoint × every role,
   state transitions, notifications and socket delivery/non-delivery (653 assertions).
   Re-runnable: see §7.
4. **Browser QA** — registration, sign-in persistence, new query with attachment,
   live replies, bookmarks, read receipts, forced password change, admin consoles,
   audit log, articles, Drive "not configured" state, mobile dashboard; plus a
   cross-role unassigned-ticket flow.
5. **Dependency audit** and **git history secret scan**.

Each finding is marked **Confirmed** (reproduced) or **Suspected** (code reading).

---

## 3. High — fix before going live

| ID | Area | Finding | Evidence / impact | Fix |
|---|---|---|---|---|
| **H1** | Security | **Stored XSS in articles.** The server sanitizes article HTML correctly, but the reader then rewrites links with a regex (`src/lib/linkUtils.ts:20,25`, used in `ArticleReaderModal.tsx:53`). A crafted `title='… target='x' onmouseover=…'` attribute is turned back into a live event handler. | **Confirmed** (reproduced twice through the real sanitizer + client code). Any admin, including a normal counselor, can publish an article that runs script in a **super admin's** session → create admins, change roles, read all data. | Stop rewriting sanitized HTML with regex: drop `processArticleHtmlLinks` in the reader (server already adds safe link attributes) or use `DOMParser`. Also add a Content-Security-Policy (L-S1). |
| **H2** | Data | **Deactivating an admin with an invalid replacement half-completes.** Status is set to deactivated and sessions killed *before* the replacement is validated (`server/routes/users.ts:264-269`, `73-76`). | **Confirmed.** Request returns 400, but the admin is already deactivated and their open tickets are stranded with an inactive counselor. | Validate the replacement first; do status change + hand-over in one transaction. |
| **H3** | Data | **New question can be invisible to the counselor.** If the counselor hid ("deleted for me") the chat, a student's next question to them merges into that hidden chat (`server/routes/queries.ts:241-244`). | **Confirmed.** Counselor never sees the new question; student waits forever. | When merging, clear the counselor's hide entry (or don't merge into chats hidden by either side). |

---

## 4. Medium

| ID | Area | Finding | Evidence / impact | Fix |
|---|---|---|---|---|
| M1 | Security | **`mustChangePassword` only enforced in the UI.** Admin-created / admin-reset accounts can use the whole API with the temporary password. (`server/auth.ts`, `AuthContext.tsx:157`) | **Confirmed** (normal admin with flag created an article: 201). The admin who set the password could keep using that account. | Server rejects everything except `/auth/*` while the flag is set. |
| M2 | Security | **Rate limits keyed on spoofable IP** (`app.set('trust proxy', 1)` + `req.ip`). Login throttle, review limit, view counter bypassed by rotating `X-Forwarded-For` when hitting the app directly. | **Confirmed** on direct access. **Mitigated** by the documented Nginx setup (overwrites the header) + firewall blocking port 3000. | Also throttle per account; bind the app to `127.0.0.1` in production (I-S2). |
| M3 | Security | **Private chat messages still reach an admin who lost access.** A category admin who opened an unassigned chat keeps receiving its live messages after another admin claims it (`server/realtime.ts:68-81`). | **Confirmed.** `GET` returns 404 for them, but socket `message:new` still arrives. | On claim/reassign, remove sockets that lost access from the `query:<id>` room. |
| M4 | Security | **Unassigned-ticket notifications go to every admin**, including counselors in unrelated categories (`server/routes/queries.ts:331,413,494`). | **Confirmed.** Leaks ticket title/preview; their click leads to a 404. | Notify only that category's admins + managers. |
| M5 | Security | **Previous user's open chat survives sign-out** on a shared device (`src/App.tsx:37,192-197`). | **Confirmed** (code). Next person signing in on the same browser sees the last ticket incl. student phone/email in the profile drawer. | Reset open ticket and tab whenever the signed-in user changes. |
| M6 | Data | **Deleting an admin makes their closed tickets look "unassigned"** (FK sets `expert_id` to NULL). They appear in claimable lists and a category admin can reply to (re-open) a closed ticket. (`schema.ts:157`, `access.ts:27,53`) | **Confirmed** (reply returned 201). | Treat "unassigned" by `assignment_status`, not `expert_id IS NULL`. |
| M7 | Bug | **Manager's "My Chats" fills with everyone's tickets** when any ticket changes (`NormalAdminDashboard.tsx:28` has no filter). | **Confirmed** (code). Super/expert admins' personal inbox (mobile Chats tab) becomes wrong. | Filter live updates to `expertId === me` for managers. |
| M8 | Bug | **Live connection never comes back after the server drops it** (role change, etc.) (`src/lib/socket.ts`). | **Confirmed** (code + socket.io semantics). User keeps the old role's UI and gets no live updates until a manual reload. | On server-initiated disconnect, refetch `/auth/me` and reconnect. |
| M9 | Bug | **Claimed tickets stay "claimable" for other category admins**; their reply then fails with 403 (`queries.ts:~409`). | **Confirmed.** | Push `query:removed` to the category room when a ticket is claimed. |
| M10 | Bug | **Platform reviews show a "View Full Conversation" button** that opens an empty, broken chat (`ReviewsAnalyticsDashboard.tsx:946`). | **Confirmed** (code). | Show it only for `source === 'query'` tickets the viewer can open. |
| M11 | UX | **Guest reviews can never be approved** — they're `pending`, but there's no approval screen. Super admins get "awaiting approval" notifications they can't act on. | **Confirmed.** Before the migration guest reviews went live instantly. | Add a small moderation list (API already exists). |
| M12 | Bug | **Editing one article field wipes others** via the API: `PATCH /articles/:id {title}` resets description/category/tags (`server/routes/articles.ts:55-58,144`). | **Confirmed.** Current UI sends full bodies, so only other API clients are hit today. | Separate update schema without defaults. |
| M13 | Data | **Race on real PostgreSQL:** reopen isn't in a transaction (`queries.ts:552-571`); two simultaneous reopens could subtract a rating twice. Saved-answer dedupe has no unique constraint. | **Suspected** (PGlite serializes transactions, so not reproducible locally). | Wrap reopen in a transaction with row lock; add unique index on (student, message). |
| M14 | Bug | **Admin notification click goes to an invalid tab** (`Navbar.tsx:128`, `'assigned'`), notifications page ignores the ticket. | **Confirmed** (code; pre-existing). | Open the ticket via the existing `app:open-query-notification` event. |

---

## 5. Low

### Security / hardening

| ID | Finding | Fix |
|---|---|---|
| L-S1 | No Content-Security-Policy or HSTS headers (`server.ts:16-21`). | Add CSP (blocks inline handlers like H1) and HSTS in production. |
| L-S2 | User enumeration: registration says "already exists"; login is slower for existing emails. | Run a dummy hash on unknown emails; generic messages. |
| L-S3 | Signed-in students' platform reviews auto-publish with **any name** they type (`reviews.ts:102-106`). | Use the account's real name. |
| L-S4 | No per-user upload quota / cleanup; files are public by unguessable link and permanent. | Per-user quota, orphan cleanup; optional per-file access checks for chat attachments & payment screenshots. |
| L-S5 | Drive proxy uses the server API key to look up any file ID a user sends before the root check (`drive.ts:127-151`). Suspected. | Short-circuit with cache/known subtree; cap lookups. |
| L-S6 | Drive file stream served inline with Google's content type — an HTML/SVG file placed in the Drive root would render on our domain. | `Content-Disposition: attachment` except audio. |
| L-S7 | Changing your password ends other sessions but not their open live connections. | Also disconnect their sockets. |

### Functional

| ID | Finding | Location |
|---|---|---|
| L-F1 | Malformed JSON body → 500 instead of 400 | `server/http.ts` |
| L-F2 | Upload with >10 files or wrong field name → 500 | `server/uploads.ts:78-81` |
| L-F3 | Non-English file names stored garbled ("résumé" → "rÃ©sumÃ©") | `server/uploads.ts` |
| L-F4 | Invalid review submissions count toward the 3/day limit | `reviews.ts:88-99` |
| L-F5 | Article links lose `target`/`rel` (sanitizer strips what it just added) | `articles.ts:21-44` |
| L-F6 | Create-admin response echoes category ids that were dropped | `users.ts:333` |
| L-F7 | Tickets returned to the queue keep the old counselor's title/avatar | `users.ts:92-99` |
| L-F8 | Header/system messages from merge & reassign don't appear live in an open chat | `queries.ts` |
| L-F9 | Reassign into an older chat leaves stale "reassigned to" fields | `queries.ts:770-784` |
| L-F10 | Reassigning to yourself notifies yourself | `queries.ts:832` |
| L-F11 | "Hide for me" deletes saved answers/notifications without updating other open views | `queries.ts:~695` |
| L-F12 | Category edits don't refresh affected admins' assignments/claimable lists live | `categories.ts:70-74` |
| L-F13 | "Oversight mode" banner wrong for managers / unassigned tickets | `AllQueriesDirectory.tsx:464`, `ConversationView.tsx:435` |
| L-F14 | File pickers allow types the server rejects (HEIC, SVG, BMP…) — error only after upload | `ConversationView.tsx`, `CoffeeTreatModal.tsx` |
| L-F15 | Dead features: follow-up form and in-chat reopen never shown; nothing asks for notification permission (OS notifications never appear) — pre-existing | `ConversationView.tsx`, `NotificationContext` |
| L-F16 | "Founder" badge given to any admin whose name contains "huzaifa" | `users.ts:468` |

### Informational

| ID | Finding |
|---|---|
| I-S1 | **21 admin passwords are in git history** (`scripts/seed-accounts.ts`, removed in `2a6261b`). Not in the current code. → **Rotate all admin passwords after migration**; optionally purge history. |
| I-S2 | App listens on all interfaces (`0.0.0.0`); production relies on the firewall. → bind to `127.0.0.1` behind Nginx. |
| I-S3 | Dev-only `drizzle-kit` pulls an old `esbuild` with a dev-server advisory — not used at runtime. |

---

## 6. Verified secure (passed attack testing)

- **Student ↔ student isolation:** another student's ticket, messages, replies → 404.
- **Admin isolation:** counselors can't read/reply/reassign/change tickets outside their assignment/category (404).
- **Role escalation blocked:** self-role change, `/users/me` extra fields, expert creating/managing super admins → 403; last-super-admin protected.
- **Sessions:** 256-bit random tokens, stored hashed, new token each login, httpOnly + SameSite=Lax + Secure (production); logout, deactivation and password change revoke sessions.
- **Live connections:** rejected without a valid session; can't join chats you can't see.
- **SQL injection:** all queries parameterized; inputs validated.
- **Prototype pollution / mass assignment:** unknown fields stripped.
- **CSRF:** SameSite cookies + JSON; uploads require the cookie; no GET changes data.
- **Uploads:** HTML/SVG rejected; disguised files served with their declared image type + `nosniff`; filenames can't inject headers; no path traversal.
- **Request size limits** enforced (413).
- **Data scoping:** notifications, saved answers, coffee treats, bookmarks limited to the owner.
- **No secrets** in the current code; `.env`, keys and local data are git-ignored.
- **Frontend:** every API call and socket event matches the server; no localStorage use; no hardcoded personal data; links/URLs restricted to http(s).

---

## 7. Recommended fix order

1. **H1** (XSS) + **L-S1** (CSP) — same change set, highest risk.
2. **H2, H3** — data integrity.
3. **M1** (forced password change on server), **M3, M4, M5** — privacy.
4. **M6–M12** — correctness/UX.
5. **M13** before real traffic on PostgreSQL.
6. Low items as a cleanup pass.
7. Before launch: rotate admin passwords (I-S1), bind to localhost (I-S2), follow `DEPLOYMENT.md` security checklist.

Estimated effort: High + Medium ≈ 1–2 days; Low ≈ 1 day.

### Re-running the tests
- API QA suite (653 checks): `tests/api-scenario.mjs` — instructions in `tests/README.md`. After the fixes it should be all green.
