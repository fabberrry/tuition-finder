# TuitionLens

Tuition discovery marketplace with a Next.js API and PostgreSQL database. The backend follows the TuitionLens PRD and borrows Project Camp API's authenticated, role-based controller pattern.

## Setup

1. Use PostgreSQL 15 or later and create a `tuition_lens` database.
2. Copy `.env.example` to `.env.local`, set `DATABASE_URL`, and replace `JWT_SECRET` with a random secret of at least 32 characters.
3. Run `npm install`, `npm run db:migrate`, then `npm run dev`.

After building, run `npm run test:student` for the student API integration check. It creates and removes an isolated PostgreSQL schema and requires permission to create schemas.

To bootstrap the first admin, register an account through `/api/auth/register`, then promote that known account in the database using `UPDATE users SET role='admin' WHERE email='your-admin@example.com';`. Public registration cannot create an admin.

## API

JSON responses use `{ "success": true, "data": ... }` or `{ "success": false, "error": ... }`. Login and registration set an HttpOnly session cookie and also return a bearer token. For cookie-authenticated mutations, send a same-origin `Origin` header. Include `Authorization: Bearer <token>` for mobile or external API clients.

| Method | Route | Access |
| --- | --- | --- |
| GET | `/api/health`, `/api/subjects`, `/api/search/centers` | Public |
| GET | `/api/centers/:id`, `/api/teachers/:id` | Public, approved content only |
| GET | `/api/demo-videos/:id`, `/api/reviews?centerId=...` or `?teacherId=...` | Public, approved content only |
| POST | `/api/auth/register`, `/api/auth/login` | Public |
| GET / POST | `/api/auth/me`, `/api/auth/logout` | Signed in |
| GET / POST / DELETE | `/api/shortlists`, `/api/shortlists`, `/api/shortlists/:centerId` | Student or parent |
| GET / POST / PATCH | `/api/demo-bookings`, `/api/demo-bookings`, `/api/demo-bookings/:id` | Student or parent; owner can mark attendance |
| GET | `/api/demo-bookings/:id` | Student or parent who made the booking |
| POST | `/api/leads`, `/api/reviews`, `/api/reports` | Student or parent; reports also accept owner/teacher |
| GET | `/api/leads`, `/api/leads/:id`, `/api/reviews/me`, `/api/reports` | Signed-in actor's own records |
| GET / PUT | `/api/student/profile` | Student only |
| GET / POST / PUT | `/api/owner/centers`, `/api/owner/centers`, `/api/owner/centers/:id` | Owner |
| POST | `/api/owner/teachers`, `/api/owner/batches`, `/api/owner/demo-videos` | Owner |
| PUT | `/api/owner/batches/:id/vacancy` | Owner |
| GET | `/api/owner/leads`, `/api/owner/demo-bookings`, `/api/owner/analytics` | Owner |
| PATCH | `/api/owner/leads/:id` | Owner |
| GET | `/api/admin/moderation`, `/api/admin/reports` | Admin |
| POST | `/api/admin/subjects`, `/api/admin/approve-listing`, `/api/admin/reject-listing`, `/api/admin/moderate-teacher`, `/api/admin/approve-video`, `/api/admin/moderate-review`, `/api/admin/moderate-report` | Admin |

Create subjects as admin before creating teachers or batches. Owners create a center, add teachers and assign subject IDs, then add batches. Admin approval is required for centers, teachers, videos, and reviews. After approval, the owner activates the center with `PUT /api/owner/centers/:id` and `{ "listingStatus": "active" }`.

Search accepts `city`, `locality`, `subject`, `classLevel`, `board`, `exam`, `mode`, `timing`, `vacancy=true`, `minFee`, `maxFee`, `minRating`, `latitude`, `longitude`, `radiusKm`, `limit`, and `offset`. Results contain one matching batch per center; open the center profile for all its batches. Geographic filtering uses a great-circle calculation over stored coordinates. `radiusKm` requires both coordinates.

Student and parent accounts can submit inquiries, save centers, and book demos. A demo booking needs `centerId`, `batchId`, a future ISO `bookingTime`, and `contactPhone` if the account has no phone. `PATCH /api/demo-bookings/:id` with `{ "status": "booked", "bookingTime": "..." }` reschedules, or `{ "status": "cancelled" }` cancels. Only that center's owner can mark a past demo `attended` or `no_show`. A review requires the authenticated student's own attended booking and stays pending until admin approval. The optional review dimensions are `teachingClarityRating`, `doubtSolvingRating`, `environmentRating`, and `valueForMoneyRating`.

`GET` list routes accept `limit` (up to 50) and `offset`. Student and parent records are scoped to the authenticated user. `GET` and `PUT /api/student/profile` are reserved for student accounts and store class, board, exam goal, budget, preferred mode, and location. The API uses thin Next.js route handling, shared RBAC helpers, controllers, Zod validators, services, and PostgreSQL query helpers.

Moderation POST bodies use `{ "id": "...", "decision": "approved" }` or `"rejected"`; reports use `"resolved"` or `"dismissed"`. Listing moderation also accepts `featured`. Approved reviews require an attended demo booking. Vacancy changes are audited in `vacancy_audit`, and all admin decisions in `admin_audit`.

Demo videos are stored as URLs; media hosting and delivery are external to this API. Email and SMS notifications are not implemented yet, so the client should use the returned booking state for confirmation.
