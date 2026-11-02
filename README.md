# Career Code by Prep Titans

Career guidance platform connecting students with counselors (React + Vite frontend,
Express + Socket.IO backend, PostgreSQL).

## Setup

```bash
npm install
cp .env.example .env        # fill in what you need (see below)
npm run create-admin -- --email you@example.com --name "Your Name"
npm run seed                # categories + starter articles (fresh installs only)
npm run dev                 # http://localhost:3000
```

Without `DATABASE_URL`, development uses an embedded PostgreSQL (PGlite) stored in
`.data/pglite` — nothing to install. Uploaded files are stored in `.data/uploads`.

`create-admin` prints a temporary password (or uses `ADMIN_PASSWORD`); the account
must choose its own password at first sign-in.

## Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (required in production) |
| `PORT` | Server port (default 3000) |
| `UPLOAD_DIR`, `MAX_UPLOAD_MB` | Where uploads are stored, per-file size limit |
| `GOOGLE_DRIVE_API_KEY` | Google Cloud API key with the Drive API enabled (for the Drive tab) |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | Default Drive folder until a super admin sets one in the app |
| `COFFEE_*` | Coffee treat amount and payment account shown to students |

The Drive folder must be shared as "Anyone with the link can view".

## Production

```bash
npm run build
NODE_ENV=production DATABASE_URL=postgres://… npm start
```

Database migrations run automatically on start. After changing
`server/db/schema.ts`, run `npm run db:generate` and commit the new migration.
Back up both the database and `UPLOAD_DIR`.

## Importing the old Firestore data

1. Firebase console → Project settings → Service accounts → **Generate new private key**.
2. Run a dry run, then the import (into an empty database):

   ```bash
   npm run import-firestore -- --service-account key.json --database <firestoreDatabaseId> --dry-run
   npm run import-firestore -- --service-account key.json --database <firestoreDatabaseId>
   ```

3. Delete the key file afterwards.

Existing passwords keep working (upgraded to a stronger hash on first sign-in).
Accounts with no stored password are reported; set one from Admin Management.

## Project layout

- `server/` — API (`routes/`), auth and sessions, Socket.IO (`realtime.ts`), uploads,
  Google Drive proxy, database schema and migrations (`db/`), CLI scripts (`scripts/`).
  Endpoint reference: [server/API.md](server/API.md).
- `src/` — React app. Data access goes through `src/lib/api.ts` and the live hooks in
  `src/lib/liveData.ts`.
