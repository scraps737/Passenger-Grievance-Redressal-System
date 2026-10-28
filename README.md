# GrievanceAI — AI-Enhanced Passenger Grievance Redressal System

A full-stack MERN application for passenger grievance redressal across rail, metro and multimodal
transit networks. Passengers lodge grievances, an AI triage service categorises and routes them
against a statutory SLA, officers investigate and resolve them, and administrators govern users,
departments, SLA policy and the audit ledger.

The user interface is built directly from the supplied **Google Stitch** design system
(`design/stitch/`) — 18 screens, the navy/blue/teal palette, Plus Jakarta Sans + Inter typography
and the Material Symbols icon set are all preserved.

---

## 1. Stack

| Layer     | Technology                                                        |
| --------- | ----------------------------------------------------------------- |
| Frontend  | React 18, Vite 6, React Router 7, Tailwind CSS 3 (Stitch tokens)   |
| Backend   | Node.js, Express 4, Mongoose 8, Zod 4                              |
| Database  | MongoDB                                                            |
| Auth      | JWT bearer tokens + bcrypt password hashing (cost factor 12)       |
| AI triage | Pluggable provider (OpenAI / Anthropic / Gemini) with a labelled rule-based fallback |

---

## 2. Prerequisites

- Node.js **18+** (developed and tested on Node 26)
- MongoDB installed locally (`mongod` on your `PATH`, or at `/opt/homebrew/bin/mongod` /
  `/usr/local/bin/mongod`)

You do **not** need to start MongoDB yourself — the preflight step does it for you if it is not
already running, and reports the pid it used. To use a remote or already-running instance instead,
set `MONGODB_URI` in `server/.env`.

To run MongoDB manually instead:

```bash
# macOS (Homebrew)
brew services start mongodb-community
# or run it directly
mongod --dbpath /opt/homebrew/var/mongodb --bind_ip 127.0.0.1
```

---

## 3. Installation

```bash
cd "PGRS VF"
npm install
```

That is the only setup step. The **preflight** script (`scripts/preflight.mjs`) handles the rest
automatically the first time you start the app:

- verifies the Node version and that dependencies are installed
- creates `server/.env` from `.env.example` with a freshly generated 96-character `JWT_SECRET`
  (written with `0600` permissions)
- checks that MongoDB is reachable and, if it is not, starts `mongod` for you
- seeds the demo dataset when the database is empty

So a fresh clone only needs `npm install` followed by `npm run dev`.

The preflight is also available on its own and accepts flags:

```bash
npm run preflight                       # set up .env + MongoDB + seed, then exit
node scripts/preflight.mjs --no-seed    # skip seeding
node scripts/preflight.mjs --force-seed # re-seed even if data exists
node scripts/preflight.mjs --no-db-start # never start mongod; fail instead if it is down
node scripts/preflight.mjs --quiet      # suppress output
```

If you would rather use your own MongoDB instance, edit `server/.env` after the first run and set
`MONGODB_URI` (and `PORT` if 5050 is taken).

---

## 4. Running

**One command — starts the API and the web app together:**

```bash
npm run dev
```

It runs the preflight, then starts both servers side by side:

```
[api] GrievanceAI listening on http://localhost:5050
[web] ➜  Local:   http://localhost:5173/
```

- **Web app:** <http://localhost:5173>
- **API health:** <http://localhost:5050/api/health>

**Production (single origin, one command):**

```bash
npm start          # preflight → build the client → serve everything from :5050
```

Other useful scripts:

```bash
npm run preflight  # environment setup only
npm run seed       # re-seed the demo data
npm test           # integration test suite
npm run lint       # client lint
npm run build      # build the client only
```

To run the two halves separately (for example when debugging one of them):

```bash
npm run dev:server    # Express with --watch
npm run dev:client    # Vite dev server (proxies /api → :5050)
```

---

## 5. Demo credentials

Created by `npm run seed`:

| Role      | Email                          | Password        |
| --------- | ------------------------------ | --------------- |
| Admin     | `admin@grievanceai.gov`        | `Admin@12345`   |
| Officer   | `r.murthy@grievanceai.gov`     | `Officer@12345` |
| Passenger | `priya.sharma@example.com`     | `Passenger@123` |

Additional officers (all `Officer@12345`): `d.sharma@`, `v.rao@`, `s.bhatt@`, `m.nair@`,
`a.verma@`, `r.sen@grievanceai.gov`.
Additional passengers (all `Passenger@123`): `arjun.mehta@`, `fatima.khan@`, `rakesh.iyer@example.com`.

---

## 6. Screens (18, all wired to real navigation)

| # | Stitch screen | Route | Role |
| - | ------------- | ----- | ---- |
| 1 | `grievanceai_home` | `/` | public |
| 2 | `grievanceai_citizen_officer_authentication` | `/login`, `/register` | public |
| 3 | `grievanceai_passenger_redressal_dashboard` | `/passenger` | passenger |
| 4 | `grievanceai_submit_grievance_ai_triage` | `/passenger/submit` | passenger |
| 5 | `grievanceai_my_complaints_redressal_history` | `/passenger/grievances` | passenger |
| 6 | `grievanceai_complaint_communication_passenger_clarification` | `/passenger/grievances/:id` | passenger |
| 7 | `grievanceai_notifications_dispatch_alerts` | `/notifications` | all |
| 8 | `grievanceai_passenger_profile_settings` | `/passenger/profile` | passenger |
| 9 | `grievanceai_officer_operations_dashboard` | `/officer` | officer/admin |
| 10 | `grievanceai_officer_complaint_queue_dispatch_ledger` | `/officer/queue` | officer/admin |
| 11 | `grievanceai_complaint_investigation_incident_workspace` | `/officer/cases/:id` | officer/admin |
| 12 | `grievanceai_escalation_assignment_console` | `/officer/escalations` | officer/admin |
| 13 | `grievanceai_admin_executive_analytics_dashboard` | `/admin` | admin |
| 14 | `grievanceai_ai_insights_complaint_analytics` | `/admin/ai-insights` | admin |
| 15 | `grievanceai_department_operational_wing_management` | `/admin/departments` | admin |
| 16 | `grievanceai_user_role_management_console` | `/admin/users` | admin |
| 17 | `grievanceai_reports_exports_console` | `/admin/reports` | admin |
| 18 | `grievanceai_system_settings_audit_logs_console` | `/admin/settings` | admin |

---

## 7. Roles & permissions (enforced in the API, not just the UI)

| Capability | Passenger | Officer | Admin |
| ---------- | :-------: | :-----: | :---: |
| Register / sign in (JWT) | ✅ | ✅ (issued) | ✅ (issued) |
| Lodge a grievance, upload evidence | ✅ | — | — |
| Read a grievance | own only | assigned to them, or owned by their wing | all |
| Track a grievance by reference (public) | ✅ | ✅ | ✅ |
| Reply on the case thread | own cases | in-scope cases | all |
| Request clarification | ✖ | ✅ | ✅ |
| Assign / reassign, change status, escalate | ✖ | in-scope | ✅ |
| Override the AI triage recommendation | ✖ | in-scope | ✅ |
| Resolve (with passenger one-time code) | ✖ | in-scope | ✅ |
| Rate a resolution | own cases | ✖ | ✖ |
| Manage users, roles, departments, SLA rules | ✖ | ✖ | ✅ |
| Read the audit ledger | ✖ | ✖ | ✅ |

Self-registration **only** ever creates a passenger account — a `role` supplied by the client is
stripped. Passengers can never read another passenger's grievance or attachments; this is covered
by automated tests.

---

## 8. AI triage

`server/src/services/aiTriage.js` produces a schema-validated recommendation:

`category` · `subCategory` · `severity` (1–4) · `priority` (tier1–3) · `departmentCode` ·
`slaHours` · `summary` · `nextSteps[]` · `sentiment` · `confidence` · duplicate candidates.

Behaviour, stated plainly:

- **Provider configured** (`AI_PROVIDER=openai|anthropic|gemini` plus the matching API key):
  the request is sent to the real provider, the JSON response is parsed and validated with Zod,
  and the result is tagged with the actual provider and model name.
- **Provider fails**: the case degrades to the rule-based engine and the failure reason is stored
  in the triage `notes` and surfaced in the UI.
- **No provider configured** (the default): the deterministic keyword/heuristic engine runs and is
  labelled `rule-based-fallback` everywhere it appears — in the submit wizard, the case workspace,
  the AI insights console, `GET /api/grievances/ai-engine` and `GET /api/health`.

Duplicate detection is computed from real stored grievances (token-overlap plus category/PNR/train
boosts) — it is never invented. Authorised officers can override any recommendation; the original
is preserved on the record and both the override and its reason are written to the audit log.

---

## 9. Database models

`User` · `Department` · `Grievance` (with embedded attachments, `aiTriage` and `sla` sub-documents) ·
`Message` · `TimelineEvent` · `Notification` · `AuditLog` · `Feedback` · `Setting`

Analytics in the admin console are computed with MongoDB aggregation pipelines over these
collections — an empty database correctly reports zeros, never placeholder figures.

---

## 10. API reference (abridged)

```
GET    /api/health                          service + database + AI engine status (public)
GET    /api/stats                           public aggregate statistics (public)

POST   /api/auth/register                   create a passenger account
POST   /api/auth/login                      sign in, returns a JWT
GET    /api/auth/me                         current account
PATCH  /api/auth/me                         update profile / preferences
POST   /api/auth/change-password            change password

GET    /api/grievances                      list (role-scoped, filters, search, pagination, sort)
POST   /api/grievances                      create (+ evidence via multipart)
GET    /api/grievances/track/:referenceId   public, PII-free status lookup
GET    /api/grievances/:id                  full case file (timeline, thread, feedback)
GET    /api/grievances/export/csv           CSV export of visible records
GET    /api/grievances/ai-engine            triage engine metadata
POST   /api/grievances/:id/attachments      add evidence
GET    /api/grievances/:id/attachments/:aid authorised attachment download
GET    /api/grievances/:id/messages         case thread
POST   /api/grievances/:id/messages         post a message / clarification
PATCH  /api/grievances/:id/status           change status            (officer/admin)
POST   /api/grievances/:id/assign           assign / reassign        (officer/admin)
POST   /api/grievances/:id/escalate         escalate                 (officer/admin)
POST   /api/grievances/:id/triage/override  override the AI triage   (officer/admin)
POST   /api/grievances/:id/resolution-otp   issue a closure code     (officer/admin)
POST   /api/grievances/:id/resolve          record the resolution    (officer/admin)
POST   /api/grievances/:id/feedback         rate a resolution        (own case)

GET    /api/notifications                   notification stream
POST   /api/notifications/:id/read          mark one read
POST   /api/notifications/read-all          mark all read

GET    /api/users/officers                  officer directory        (officer/admin)
GET    /api/users                           user directory           (admin)
POST   /api/users                           create officer/admin     (admin)
PATCH  /api/users/:id                       update role/status/etc.  (admin)
DELETE /api/users/:id                       delete (guarded)         (admin)

GET    /api/departments                     wings with derived metrics
POST   /api/departments                     commission a wing        (admin)
PATCH  /api/departments/:id                 update a wing            (admin)
DELETE /api/departments/:id                 deactivate a wing        (admin)

GET    /api/analytics/me                    passenger dashboard KPIs
GET    /api/analytics/officer               officer dashboard KPIs + queue
GET    /api/analytics/overview              executive analytics      (admin)
GET    /api/analytics/ai-insights           engine + pattern insights (admin)
GET    /api/analytics/reports               statutory rollups        (admin)

GET    /api/settings                        SLA rules, AI config, taxonomy (admin)
PATCH  /api/settings                        update settings          (admin)
GET    /api/settings/audit-logs             audit ledger             (admin)
```

---

## 11. Tests

```bash
npm test
```

Runs `node --test` with supertest against a **real MongoDB** using the isolated
`grievanceai_test` database (override with `TEST_MONGODB_URI`). No database or AI mocking is used.

Coverage includes: health/engine transparency, registration validation and role-escalation
prevention, multipart submission with evidence, attachment authorisation, cross-passenger
isolation, officer wing scoping, assignment, clarification round-trip, escalation, triage
override, OTP-gated resolution with a wrong-code rejection, feedback duplicate rejection,
analytics, settings persistence and CSV export.

---

## 12. Project layout

```
PGRS VF/
├── scripts/preflight.mjs    one-command setup: .env, MongoDB, seeding
├── server/                  Express API
│   ├── src/
│   │   ├── config/          env, database, domain constants (category taxonomy, SLA defaults)
│   │   ├── models/          Mongoose schemas
│   │   ├── middleware/      auth/RBAC, validation, uploads, error handling
│   │   ├── routes/          REST route definitions
│   │   ├── controllers/     request handlers
│   │   ├── services/        AI triage, notifications, audit, timeline, settings
│   │   ├── utils/           ApiError, SLA maths, reference IDs, similarity
│   │   └── validators/      Zod schemas
│   └── tests/               integration tests
├── client/                  React + Vite SPA
│   └── src/
│       ├── components/      app shell, UI kit, charts, case thread/timeline, list
│       ├── context/         auth context
│       ├── lib/             API client and formatting helpers
│       └── pages/           the 18 screens
└── design/stitch/           the original Stitch export (HTML + screenshots), preserved
```

---

## 13. Known limitations

- **No SMS/email gateway.** Notification codes and alerts are delivered to the in-app
  notification stream only, and the UI says so. No SMS is pretended to have been sent.
- **RIB/PDF exports are not implemented.** CSV export of grievance records works; the reports
  console states that PDF/XLSX rendering is out of scope for this build.
- **No real-time transport.** Dashboards poll (30 s for notifications, 15 s for the officer
  queue); there is no WebSocket/SSE channel, so the Stitch "live telemetry" indicators are
  polling-driven rather than streaming.
- **Attachment storage is local disk** (`server/uploads`), with authorisation checked on every
  download. Object storage is not configured.
- **No password-reset or email-verification flow** — accounts are created by an administrator or
  by self-registration.
- **Client-side route guards are UX only.** Every permission is independently enforced by the API,
  which is the real boundary and is covered by tests.
- The seeded dataset is synthetic demonstration data, not real passenger records.
