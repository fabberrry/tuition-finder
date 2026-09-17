# TuitionLens

Tuition discovery marketplace with a Next.js API and PostgreSQL database. The backend follows the TuitionLens PRD and borrows Project Camp API's authenticated, role-based controller pattern.

## Setup

1. Use PostgreSQL 15 or later and create a `tuition_lens` database.
2. Copy `.env.example` to `.env.local`, set `DATABASE_URL`, and replace `JWT_SECRET` with a random secret of at least 32 characters.
3. Run `npm install`, `npm run db:migrate`, then `npm run dev`.

To bootstrap the first admin, register an account through `/api/auth/register`, then promote that known account in the database using `UPDATE users SET role='admin' WHERE email='your-admin@example.com';`. Public registration cannot create an admin.

## API

JSON responses use `{ "success": true, "data": ... }` or `{ "success": false, "error": ... }`. Login and registration set an HttpOnly session cookie and also return a bearer token. For cookie-authenticated mutations, send a same-origin `Origin` header. Include `Authorization: Bearer <token>` for mobile or external API clients.

| Method | Route | Access |
| --- | --- | --- |
| GET | `/api/health`, `/api/subjects`, `/api/search/centers` | Public |
| GET | `/api/centers/:id`, `/api/teachers/:id` | Public, approved content only |
| POST | `/api/auth/register`, `/api/auth/login` | Public |
| GET / POST | `/api/auth/me`, `/api/auth/logout` | Signed in |
| GET / POST / DELETE | `/api/shortlists`, `/api/shortlists`, `/api/shortlists/:centerId` | Student or parent |
| GET / POST / PATCH | `/api/demo-bookings`, `/api/demo-bookings`, `/api/demo-bookings/:id` | Student or parent; owner can mark attendance |
| POST | `/api/leads`, `/api/reviews`, `/api/reports` | Student or parent; reports also accept owner/teacher |
| GET / POST / PUT | `/api/owner/centers`, `/api/owner/centers`, `/api/owner/centers/:id` | Owner |
| POST | `/api/owner/teachers`, `/api/owner/batches`, `/api/owner/demo-videos` | Owner |
| PUT | `/api/owner/batches/:id/vacancy` | Owner |
| GET | `/api/owner/leads`, `/api/owner/demo-bookings`, `/api/owner/analytics` | Owner |
| PATCH | `/api/owner/leads/:id` | Owner |
| GET | `/api/admin/moderation`, `/api/admin/reports` | Admin |
| POST | `/api/admin/subjects`, `/api/admin/approve-listing`, `/api/admin/reject-listing`, `/api/admin/moderate-teacher`, `/api/admin/approve-video`, `/api/admin/moderate-review`, `/api/admin/moderate-report` | Admin |

Create subjects as admin before creating teachers or batches. Owners create a center, add teachers and assign subject IDs, then add batches. Admin approval is required for centers, teachers, videos, and reviews. After approval, the owner activates the center with `PUT /api/owner/centers/:id` and `{ "listingStatus": "active" }`.

Search accepts `city`, `locality`, `subject`, `classLevel`, `board`, `exam`, `mode`, `timing`, `vacancy=true`, `maxFee`, `minRating`, `latitude`, `longitude`, `radiusKm`, `limit`, and `offset`. Geographic filtering uses a great-circle calculation over stored coordinates. `radiusKm` requires both coordinates.

Moderation POST bodies use `{ "id": "...", "decision": "approved" }` or `"rejected"`; reports use `"resolved"` or `"dismissed"`. Listing moderation also accepts `featured`. Approved reviews require an attended demo booking. Vacancy changes are audited in `vacancy_audit`, and all admin decisions in `admin_audit`.

Demo videos are stored as URLs; media hosting and delivery are external to this API. Email and SMS notifications are not implemented yet, so the client should use the returned booking state for confirmation.
