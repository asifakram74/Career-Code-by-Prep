# Tests

## API scenario test

End-to-end checks of every API endpoint for every role (permissions, state
transitions, notifications, socket delivery). Runs against a separate test server and
database, so it never touches your dev data.

```bash
# 1. Fresh test database with a super admin (choose any password)
PGLITE_DIR=.data/qa-api ADMIN_PASSWORD='<test-password>' npx tsx server/scripts/create-admin.ts --email sa@qa.test --name "QA Super"
PGLITE_DIR=.data/qa-api npx tsx server/scripts/seed.ts

# 2. Start a test server (separate terminal)
PORT=3302 PGLITE_DIR=.data/qa-api UPLOAD_DIR=.data/qa-api-uploads npx tsx server.ts

# 3. Run the checks
SA_EMAIL=sa@qa.test SA_PASSWORD='<test-password>' node tests/api-scenario.mjs

# 4. Clean up
rm -rf .data/qa-api .data/qa-api-uploads
```

`QA_ORIGIN` overrides the server URL (default `http://localhost:3302`).
Results as of 2026-11-02: 653 checks, 630 passed — the 23 failures are the bugs listed
in `docs/SECURITY_QA_REPORT.md`; after those are fixed this should be all green.
