# Career Code — Project Handoff & Context

Everything needed to continue this project on another computer (or in a new
Claude session) without redoing past work. Keep this file updated as work
progresses. **No secrets belong in this file.**

_Last updated: 2026-11-02_

---

## 1. What the product is

**Career Code by Prep Titans** — a career-guidance platform for Pakistani students.
Students ask questions ("queries"/tickets) in a category (CS/IT, MDCAT, CA/ACCA, …);
counselors answer in a WhatsApp-style chat. Also: articles, a Google Drive resource
library, reviews/ratings, "coffee treat" tips for counselors, notifications.

Roles:

| Role | Can do |
|---|---|
| `student` | Ask queries, chat, rate answers, bookmark answers, read articles, browse Drive |
| `normal_admin` ("Admin"/counselor) | Answer tickets assigned to them + unassigned tickets in their categories, write articles |
| `expert_admin` | Everything above + see all tickets, manage normal admins/students/categories, reassign |
| `super_admin` | Everything + manage any admin, change roles, coffee treats list |

`formatRoleName()` shows both `expert_admin` and `super_admin` as "Expert Admin" (existing branding, left as is).

---

## 2. History (what was done and why)

1. **Original state** (commits `f1d91b4`, `8cf0d8e`): an AI Studio app on Firebase.
   React frontend talked to Firestore directly; Express `server.ts` had login/admin
   endpoints that trusted the caller's identity from the request body.
2. **Code review** found critical issues: `firestore.rules` in the repo was
   `allow read, write: if true`; login "session" was a profile JSON in localStorage
   (editable → instant admin); server admin endpoints trusted `callerUid`/`creatorRole`;
   21 admin passwords in plaintext in `scripts/seed-*.ts`; weak PBKDF2 (1000 iters)
   hashes; stored XSS via article HTML; public pages streamed every ticket/user;
   many logic bugs (Reactivate wrote "deactivated", non-atomic reassignment, rating
   wiped on resolve, duplicate notifications, chat list snapping back, etc.).
   - Correction learned later: the **deployed** Firestore rules are stricter than the
     repo file (unauthenticated REST reads return 403).
3. **Decision (by the owner):** remove Firebase and Google AI Studio, move to SQL,
   but **keep the Google Drive feature** (via the official Drive API).
   Choices made: **PostgreSQL**, **WebSockets (Socket.IO)** for live updates,
   **migrate existing Firestore data**, **Google Drive API v3 with an API key**.
4. Work on branch **`feat/postgres-migration`**:
   - `0678ac0` — PostgreSQL backend: Drizzle schema + migrations, cookie sessions,
     scrypt passwords, server-side role checks, REST API, Socket.IO, uploads, Drive API.
   - `2a6261b` — frontend moved to the API (all 25 Firestore files rewritten),
     Firebase/Gemini/AI Studio removed, import + seed scripts, README.
   - `ffc86d6` — `DEPLOYMENT.md` (VPS guide); production requires `DATABASE_URL`.
   - Pushed to `origin` up to `2a6261b`; `ffc86d6` and later are local until pushed.
   - Not merged into `main` yet. No PR opened yet.

---

## 3. Architecture (current)

```
Browser (React 19 + Vite + Tailwind 4)
  ├─ REST  /api/*  (cookie session)          src/lib/api.ts
  └─ Socket.IO /socket.io (same cookie)      src/lib/socket.ts, src/lib/liveData.ts
Express server (server.ts → server/)
  ├─ server/routes/*      API routes (auth, users, categories, queries, notifications,
  │                       savedAnswers, articles, reviews)
  ├─ server/auth.ts       sessions, scrypt, legacy PBKDF2 upgrade, throttling, role guards
  ├─ server/access.ts     who can see which ticket
  ├─ server/realtime.ts   Socket.IO rooms: user:<id>, managers, category:<id>, query:<id>
  ├─ server/uploads.ts    multipart uploads → disk (UPLOAD_DIR), served at /api/files/:id
  ├─ server/drive.ts      Google Drive API v3 proxy, restricted to configured root folder
  ├─ server/notify.ts     server-side notifications (+ socket push)
  └─ server/db/           Drizzle schema, SQL migrations (auto-run on start)
PostgreSQL (DATABASE_URL) — or embedded PGlite in .data/pglite for development
```

Key design rules:
- The **server decides identity and permissions** from the session cookie. The client never sends caller id/role.
- Multi-step actions (new query, reply, reassign, rating, hide-for-me) are **one API call, one DB transaction**.
- Files are uploaded first (`POST /api/uploads`), then referenced by URL `/api/files/<uuid>`. Data URLs are rejected.
- Article HTML is **sanitized on the server** (`sanitizeArticleHtml` in `server/routes/articles.ts`).
- Ticket numbers come from a Postgres sequence (`PT-100001…`).
- `QueryTicket.expertId === 'unassigned'` is kept as the frontend sentinel for "no counselor".
- Timestamps are `timestamptz` in DB, millisecond numbers in the API (matches `src/types`).
- Admin-created accounts and admin password resets set `mustChangePassword` → forced change modal.
- Guest (logged-out) platform reviews are `pending` until approved (`PATCH /api/admin/platform-reviews/:id`; **no UI yet**).

Reference docs in the repo:
- `README.md` — local setup, env vars, import.
- `server/API.md` — every endpoint, who may call it, socket events.
- `DEPLOYMENT.md` — VPS (Ubuntu) deployment, Nginx, SSL, backups, updates.

---

## 4. How to run it on a new computer

Requirements: **Node.js 22**, Git. (No PostgreSQL install needed for development.)

```bash
git clone <repo-url>
cd Career-Code-by-Prep
git checkout feat/postgres-migration
npm install
cp .env.example .env            # optional for dev; add GOOGLE_DRIVE_API_KEY to test Drive
npm run create-admin -- --email you@example.com --name "Your Name"   # prints a temp password
npm run seed                    # 23 categories + 2 starter articles
npm run dev                     # http://localhost:3000
```

- Dev data lives in `.data/` (git-ignored). Delete `.data/` to reset.
- Only one process may use `.data/pglite` at a time (stop the dev server before running scripts that open the DB, or use `PGLITE_DIR=...`).
- Useful scripts: `npm run lint` (tsc), `npm run build`, `npm run db:generate` (after schema changes), `npm run import-firestore`, `npm run create-admin`, `npm run seed`.
- Local test accounts used during development were throwaway values in `.data/LOCAL_TEST_ACCOUNTS.md` (not committed). Recreate them with `create-admin` + the app's registration page.

---

## 5. Status

### Done and verified
- 60-check API smoke test (auth, authorization/attack cases, tickets, chat, rating, reassign, hide, deactivate, password reset, articles sanitization, uploads, reviews, Drive guards, audit log, socket events) — all passed on PGlite.
- Firestore import tested against synthetic data (legacy passwords log in and upgrade, duplicate profiles merged, base64 → files, ticket numbers continue, ratings recomputed).
- Browser walkthrough: registration, session persists via cookie, new query with attachment, live reply via socket, bookmark, read receipts, forced password change, super admin console, All Queries, Admin Management, audit log, Articles, Drive "not set up" state.
- Production mode tested locally (built site, SPA fallback, Secure+HttpOnly cookie).

### Not done / needs the owner
- [ ] **Import real Firestore data** — needs a Firebase service-account key (see README / DEPLOYMENT step 10).
- [ ] **Google Drive** with a real `GOOGLE_DRIVE_API_KEY` — untested against Google.
- [ ] **Real PostgreSQL** — only PGlite tested so far.
- [ ] **VPS deployment** — guide written, not yet run on a real server.
- [ ] **Reset all 21 admin passwords** after migration (old ones are in git history).
- [ ] Fill `COFFEE_*` env values (coffee treats show "not set up" until then).
- [ ] Push `ffc86d6`+, open PR, merge to `main`.

### Known gaps / follow-ups
- No UI to approve pending guest reviews (API exists).
- No password-reset email (no email service); users ask an admin. Admin resets force a change at next login.
- Uploaded files are served to anyone who has the unguessable `/api/files/<uuid>` link (needed for public avatars/covers); per-file access control could be added for chat attachments and payment screenshots.
- Frontend bundle is ~1.4 MB (one chunk) — could be code-split.
- `formatRoleName` labels super_admin as "Expert Admin".
- `dist/` and `.claude/` are local only (ignored / not committed).

---

## 6. Next planned work

1. **Security review + full QA of the product** with a written report → `docs/SECURITY_QA_REPORT.md` (in progress as of the date above).
2. Fix what the report finds.
3. Import real data, test Drive with a real key, deploy to VPS following `DEPLOYMENT.md`.

---

## 7. Working conventions (for Claude or any developer)

- Work on a branch; commit only when the owner asks; end commit messages with the co-author line used in history.
- Frontend data access only through `src/lib/api.ts` / `src/lib/liveData.ts` — never add direct DB/3rd-party calls in components.
- New server actions: validate input with zod, check permissions with helpers in `server/auth.ts` / `server/access.ts`, wrap multi-step writes in `db.transaction`, emit socket events after commit, write an audit log entry for admin actions.
- Never commit secrets: `.env`, service-account keys (`*service-account*.json`, `*-firebase-adminsdk-*.json`) are git-ignored.
- Keep `server/API.md` in sync when adding/changing endpoints.
