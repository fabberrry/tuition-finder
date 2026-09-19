# TuitionLens

Tuition discovery marketplace with a Next.js API and PostgreSQL database. The backend follows the TuitionLens PRD and borrows Project Camp API's authenticated, role-based controller pattern.

## Run the frontend

From the project directory:

```powershell
npm install
npm run dev
```

Open http://localhost:3000. The homepage renders without a database. Search, authentication, saved centers, and demo bookings use the existing API and require the database setup below. An empty database shows an empty search state; the frontend does not invent listings.

Student-facing pages: `/`, `/search`, `/centers/:id`, `/login`, `/register`, and `/my-learning`. Search filters are stored in the URL. Student and parent accounts can save centers and book or cancel demos. This frontend does not yet include owner or admin dashboards; their existing APIs are unchanged.

For a production build:

```powershell
npm run build
npm start
```

Design decisions, palette, and validation notes are in [DESIGN_REVIEW.md](DESIGN_REVIEW.md).

## Frontend checks

```powershell
npm run lint
npx playwright install chromium
npm run test:frontend
```

The browser tests start a development server on port 3000, or reuse one already running. They mock API responses to verify UI behavior without modifying the database. On Windows with Microsoft Edge installed, you can use it without downloading Chromium:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run test:frontend
```

## Setup

1. Use PostgreSQL 15 or later and create a `tuition_lens` database.
2. Copy `.env.example` to `.env.local`, set `DATABASE_URL`, and replace `JWT_SECRET` with a random secret of at least 32 characters.
3. Run `npm install`, `npm run db:migrate`, then `npm run dev`.

After building, run `npm run test:student`, `npm run test:owner`, and `npm run test:admin` for API integration checks. Each test creates and removes an isolated PostgreSQL schema and requires permission to create schemas.

To bootstrap the first admin, register an account through `/api/auth/register`, then promote that known account in the database using `UPDATE users SET role='admin' WHERE email='your-admin@example.com';`. Public registration cannot create an admin.

## API

JSON responses use `{ "success": true, "data": ... }` or `{ "success": false, "error": ... }`. Login and registration set an HttpOnly session cookie and also return a bearer token. For cookie-authenticated mutations, send a same-origin `Origin` header. Include `Authorization: Bearer <token>` for mobile or external API clients.

| Method              | Route                                                                                                                                                                                                   | Access                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| GET                 | `/api/health`, `/api/subjects`, `/api/search/centers`                                                                                                                                                   | Public                                               |
| GET                 | `/api/centers/:id`, `/api/teachers/:id`                                                                                                                                                                 | Public, approved content only                        |
| GET                 | `/api/demo-videos/:id`, `/api/reviews?centerId=...` or `?teacherId=...`                                                                                                                                 | Public, approved content only                        |
| POST                | `/api/auth/register`, `/api/auth/login`                                                                                                                                                                 | Public                                               |
| GET / POST          | `/api/auth/me`, `/api/auth/logout`                                                                                                                                                                      | Signed in                                            |
| GET / POST / DELETE | `/api/shortlists`, `/api/shortlists`, `/api/shortlists/:centerId`                                                                                                                                       | Student or parent                                    |
| GET / POST / PATCH  | `/api/demo-bookings`, `/api/demo-bookings`, `/api/demo-bookings/:id`                                                                                                                                    | Student or parent; owner can mark attendance         |
| GET                 | `/api/demo-bookings/:id`                                                                                                                                                                                | Student or parent who made the booking               |
| POST                | `/api/leads`, `/api/reviews`, `/api/reports`                                                                                                                                                            | Student or parent; reports also accept owner/teacher |
| GET                 | `/api/leads`, `/api/leads/:id`, `/api/reviews/me`, `/api/reports`                                                                                                                                       | Signed-in actor's own records                        |
| GET / PUT           | `/api/student/profile`                                                                                                                                                                                  | Student only                                         |
| GET / POST          | `/api/owner/centers`, `/api/owner/teachers`, `/api/owner/batches`, `/api/owner/demo-videos`                                                                                                             | Owner                                                |
| GET / PUT           | `/api/owner/centers/:id`, `/api/owner/teachers/:id`, `/api/owner/batches/:id`, `/api/owner/demo-videos/:id`                                                                                             | Owning center only                                   |
| PUT / GET           | `/api/owner/batches/:id/vacancy`, `/api/owner/batches/:id/history`                                                                                                                                      | Owning center only                                   |
| GET                 | `/api/owner/leads`, `/api/owner/leads/:id`, `/api/owner/demo-bookings`, `/api/owner/demo-bookings/:id`, `/api/owner/analytics`                                                                          | Owner, scoped to owned centers                       |
| PATCH               | `/api/owner/leads/:id`                                                                                                                                                                                  | Owning center only                                   |
| GET                 | `/api/admin/moderation`, `/api/admin/reports`, `/api/admin/duplicates`, `/api/admin/audit`                                                                                                              | Admin                                                |
| POST                | `/api/admin/subjects`, `/api/admin/approve-listing`, `/api/admin/reject-listing`, `/api/admin/moderate-teacher`, `/api/admin/approve-video`, `/api/admin/moderate-review`, `/api/admin/moderate-report` | Admin                                                |
| PUT                 | `/api/admin/centers/:id/featured`, `/api/admin/centers/:id/status`, `/api/admin/users/:id/status`                                                                                                       | Admin                                                |

Create subjects as admin before creating teachers or batches. Owners create a center, add teachers and assign subject IDs, then add batches. Admin approval is required for centers, teachers, videos, and reviews. After approval, the owner activates the center with `PUT /api/owner/centers/:id` and `{ "listingStatus": "active" }`.

Owner list routes accept `limit` (up to 100) and `offset`; teacher, batch, video, lead, and booking lists also accept `centerId`. Leads accept a `status` filter. `GET /api/owner/analytics` accepts an optional `centerId` and returns center, batch, lead, and demo counts. All owner records are checked against the authenticated owner's center IDs; another owner receives 404 for individual records.

Center content edits return the listing to draft and pending verification. Teacher detail or subject edits return the teacher and its videos to moderation. Video edits return the video to moderation. Owners can deactivate teachers with `{ "active": false }` and pause batches with `{ "status": "paused" }`; inactive teachers and paused batches disappear from public discovery. Batch seat changes use `PUT /api/owner/batches/:id/vacancy` with `{ "filledSeats": 4 }`. Capacity and fee changes use `PUT /api/owner/batches/:id`; the history endpoint exposes their audit records. A batch with booked demos cannot be reassigned to another teacher or subject until those bookings are resolved.

Search accepts `city`, `locality`, `subject`, `classLevel`, `board`, `exam`, `mode`, `timing`, `vacancy=true`, `minFee`, `maxFee`, `minRating`, `latitude`, `longitude`, `radiusKm`, `limit`, and `offset`. Results contain one matching batch per center; open the center profile for all its batches. Geographic filtering uses a great-circle calculation over stored coordinates. `radiusKm` requires both coordinates.

Student and parent accounts can submit inquiries, save centers, and book demos. A demo booking needs `centerId`, `batchId`, a future ISO `bookingTime`, and `contactPhone` if the account has no phone. `PATCH /api/demo-bookings/:id` with `{ "status": "booked", "bookingTime": "..." }` reschedules, or `{ "status": "cancelled" }` cancels. Only that center's owner can mark a past demo `attended` or `no_show`. A review requires the authenticated student's own attended booking and stays pending until admin approval. The optional review dimensions are `teachingClarityRating`, `doubtSolvingRating`, `environmentRating`, and `valueForMoneyRating`.

`GET` list routes accept `limit` (up to 50) and `offset`. Student and parent records are scoped to the authenticated user. `GET` and `PUT /api/student/profile` are reserved for student accounts and store class, board, exam goal, budget, preferred mode, and location. The API uses thin Next.js route handling, shared RBAC helpers, controllers, Zod validators, services, and PostgreSQL query helpers.

Moderation POST bodies use `{ "id": "...", "decision": "approved" }` or `"rejected"`; reports use `"resolved"` or `"dismissed"`. `/api/admin/approve-listing` requires `approved`, and `/api/admin/reject-listing` requires `rejected`. Items must be pending; a repeated decision returns 409. Centers must be approved before their teachers, and teachers before their videos. Approved reviews require a matching attended demo booking. Notes are optional on moderation decisions.

The moderation queue returns up to 100 pending records per type plus up to 50 duplicate listing candidates. Duplicate candidates match centers in the same city by phone or normalized name and address; review them manually. `GET /api/admin/duplicates`, `/api/admin/reports`, and `/api/admin/audit` accept `limit` (up to 100) and `offset`; reports also accept `status=pending|resolved|dismissed`.

Set a featured listing with `PUT /api/admin/centers/:id/featured` and `{ "featured": true }`. Featuring requires an approved, active listing. Suspend a listing with `PUT /api/admin/centers/:id/status` and `{ "status": "suspended", "notes": "reason" }`; restore it to draft with `status: "draft"`. An owner cannot edit or reactivate a suspended listing. Suspend or restore a non-admin account with `PUT /api/admin/users/:id/status` and `{ "status": "suspended" | "active", "notes": "reason" }`. Suspended accounts lose API access immediately. All these actions are recorded in `admin_audit`; an admin cannot change their own status through this endpoint.

Vacancy changes are audited in `vacancy_audit`.

Demo videos are stored as URLs; media hosting and delivery are external to this API. Email and SMS notifications are not implemented yet, so the client should use the returned booking state for confirmation.
