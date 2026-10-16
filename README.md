# CleanMate Cleaner Web

Standalone website for cleaner applicants and approved cleaners, using the shared
CleanMate backend. This folder has an independent local Git repository on `main`.
No commit, remote or GitHub repository has been created automatically.

## Features

- Register/sign in, submit an application, see review reasons and resubmit.
- Pending applications cannot access jobs; only server-approved cleaners can work.
- Dashboard uses actual assigned jobs, completed jobs and self-declared cash totals.
- Find available work, accept a booking, start and complete the assigned job.
- Review personal job history and upcoming/active work in chronological order.
- Confirm receipt only after receiving the full cash amount directly from the customer.
- Edit actual profile details; read/paginate notifications and persist read state.
- Refresh data after successful or conflicting actions; prevent duplicate UI submissions.
- Search booking codes, customer/contact information and addresses (Vietnamese with or without accents).
- Filter work by status and Vietnam calendar day; filters survive data refresh.
- Open the exact assigned job from a notification, including completed work.
- Call the customer for an assigned job or open its address in Maps.

Existing backend checks enforce ownership, non-overlapping accepted schedules and
one job in progress. Declared cash totals are not a wallet or a platform payout.
There is no chat, automatic matching, GPS tracking or online collection in this version.

## Local startup

Requires Node.js 22+, the shared backend with management migrations applied, and
a database configured for that backend. Cleaner reviews are done through `../admin`.

```powershell
cd E:\cleanmate\cleaner-web
npm ci
$env:CLEANMATE_API_URL = 'http://localhost:5238'
npm start
```

Open http://127.0.0.1:3002. Register here or sign in with an existing customer/cleaner
account. New applicants remain customers until staff approves their application.
Admin and Staff accounts use the management portal instead.

`PORT` changes the web port. `.env.example` is a template, not loaded automatically.
To use a `.env` file, copy/edit it and run `node --env-file=.env server.mjs`.
The same-origin Node proxy forwards only the cleaner/auth/profile/notification API
routes; it does not expose management endpoints, source configuration or Git files.
For deployment run this server behind HTTPS with the correct private API origin.

## Build and tests

Verified 16 October 2026: 8 Node tests and 14 Playwright desktop/mobile cases
passed with no skipped/flaky cases. The generated SQL database was cleaned up.

```powershell
npm test
npm run build
```

The build produces `dist/`. Set `CLEANMATE_CLEANER_ROOT` to its absolute path to
serve the built assets, then run `npm start`.

System tests require sibling `backend/`, .NET SDK 8/9, Chromium and a local SQL
Server account permitted to create/drop test databases:

```powershell
dotnet build ../backend/CleanMate.sln --no-restore
npx playwright install chromium
npm run build
npm run test:e2e
```

Playwright covers the real API/database on desktop and Pixel 7 browser emulation.
It uses a generated `CleanMateSystemTests_<guid>` database and deletes it after
the run. It does not use application data or real admin credentials. Do not run
at the same time as the customer/admin system suites: their host ports overlap.
Reports and cleanup confirmation are in `test-results/` (ignored by Git).

## Separate Git

Suggested GitHub repository: `CleanMateCleanerWeb`. Create an empty repository,
then add its URL as this folder's `origin`. Commit text:

```text
Add cleaner job filters, contact shortcuts, and notification job navigation
```

If your Windows user encounters sandbox ownership detection, trust only this repo:
`git config --global --add safe.directory E:/cleanmate/cleaner-web`.
