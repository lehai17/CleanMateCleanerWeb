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
- Report a booking problem in Support, track its state and read the latest staff response.

Existing backend checks enforce ownership, non-overlapping accepted schedules and
one job in progress. Declared cash totals are not a wallet or a platform payout.
There is no chat, automatic matching, GPS tracking or online collection in this version.
Support includes scheduling, quality and direct cash issues. Only booking parties
can report; each user sees their own reports. Retries of unchanged form data use
the same request ID. Attachments and message threads are not implemented.

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

Support → Xem trao đổi opens your private conversation with staff. You can send
follow-up messages and load older history; sending to a resolved report reopens
it. Message replies do not change the job or its cash receipt. See
../backend/SUPPORT_CONVERSATIONS.md for limits, privacy and refresh behavior.

Login/signup errors include the backend's retry time when throttled. The proxy
preserves Retry-After and replaces browser-provided forwarding headers with the
socket peer IP. New passwords are capped at 72 UTF-8 bytes by the backend.
See ../backend/AUTH_RATE_LIMITS.md for quotas and proxy deployment settings.

Verified 16 October 2026: 13 Node tests and 32 Playwright desktop/mobile cases
passed with no skipped/flaky cases. The generated SQL database was cleaned up.
Security → Đổi mật khẩu requires the current password and a matching new password.
Success invalidates old JWT sessions and returns to login. Google-only accounts
cannot create a separate password through this flow. See ../backend/PROJECT_STATUS.md.
Security also offers confirmed logout from all CleanMate sessions without changing
the password, including Google-only accounts. Cancellation and reauthentication
are covered by the system tests.

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

## Email recovery and verification

The login screen offers password recovery with a single-use email code. Security
settings can request and confirm email verification. Reset revokes old sessions;
verification does not grant a cleaner approval. Automated tests use a fake mailbox,
not external email. A real SMTP relay must be configured and tested for deployment.
See ../backend/ACCOUNT_RECOVERY.md for API, limits and restart/delivery caveats.
