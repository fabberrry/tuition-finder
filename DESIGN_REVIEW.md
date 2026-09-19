# TuitionLens design review

Date: 2026-09-19

Built using the [make-it-look-good consultation playbook](https://github.com/jdeworks/make-it-look-good/blob/dev/CONSULT.md), the supplied bundle, and this repository's PRD. Consultation depth: quick start, as requested by proceeding directly to implementation.

## Direction

Playful, optimistic, and readable for students in Classes 8–12 and their parents. Yellow is the primary color; cream surfaces and navy text keep longer browsing sessions comfortable. Teal, lavender, and peach distinguish learning subjects without competing with the search action. Light mode only.

The toolkit's `landing/playful.html` supplied the asymmetric hero, playful geometry, responsive navigation, and alternating content structure. The implementation adapts that structure into Next.js components and a tuition-discovery flow instead of copying the toolkit's sample product.

## Audit and changes

- Replaced the Next.js starter homepage with TuitionLens content, subject discovery, tuition search, learning-mode shortcuts, and a booking explanation.
- Reworked the existing login draft into API-backed login and registration. Removed password logging, an unsupported remember-me control, and links to nonexistent password-reset pages.
- Added search results and URL-based filters, center details with teachers/batches/reviews/video links, saved centers, demo booking, and booking cancellation.
- Preserved existing API contracts and backend authorization. Registration in the student interface offers student and parent roles.
- Added meaningful loading, empty, error, retry, submission, and success states. No invented reviews, center listings, or platform metrics.
- Added a shared header/footer, mobile navigation, page metadata, a brand icon, and a custom not-found page.

## Tokens

| Role                         | Value     |
| ---------------------------- | --------- |
| Primary yellow               | `#FFD43B` |
| Page background              | `#FFFDF7` |
| Cream accent                 | `#FFF5CF` |
| Primary text / strong action | `#17243B` |
| Secondary text               | `#566070` |
| Teal / focus ring            | `#167D8D` |
| Lavender accent              | `#E9E2FA` |
| Mint accent                  | `#DCEFE5` |
| Peach accent                 | `#FCE2D4` |
| Border                       | `#DEDED5` |

Typography: Geist for headings, body, and controls; Georgia italic for occasional editorial accents. The revised illustration contains no text. Main body size 16px with 1.6 line height; lead copy 17px; secondary metadata 12–14px. Headings scale down on mobile. Text measures are constrained; desktop container maximum is 1200px.

Spacing follows a predominantly 4px scale. Cards use 16px radii, large callouts 24px, and controls 8–10px. The revised artwork is a minimal open-book SVG in navy, cream, and yellow. Motion is limited to short hover transitions and respects reduced-motion preferences.

## Minimal artwork and scrolling revision

- Replaced 31 nested decorative elements, rotated layers, gradients, and shadows with one image using a 1,466-byte local SVG. The SVG has no filters, scripts, animation, or embedded fonts. Explicit dimensions reserve its aspect ratio, and it scales naturally without negative margins or breakpoint transforms. Both the homepage and auth pages use it.
- Disabled viewport prefetching on homepage discovery links and footer links. Clicking still uses Next.js navigation; scrolling no longer downloads every subject and mode destination in advance.
- Separated the interactive header from the static footer and brand, reducing the client component boundary. Removed the unused Geist Mono font and global smooth scrolling.
- Compared production builds with headless Edge at 1440×900, 4× CPU throttling, and the same 180-frame programmatic down/up scroll. Route requests during scrolling fell from 19 to 0; measured main-thread task time fell from about 463ms to 217ms. Document elements fell from 259 to 228. These are local single-run measurements, not a guaranteed speedup on every device.
- Neither run reproduced frames longer than 25ms. This identifies and removes unnecessary scroll-time work, but does not establish the cause of all lag on the user's device. Use `npm run build` followed by `npm start` when assessing production performance; the development server includes additional tooling.
- Production build, lint, and all six browser tests pass after the revision. The replacement artwork was visually checked at desktop and mobile widths.

## Behavior defaults

- Search submits explicitly; filters and pagination remain bookmarkable in the URL. Each page requests 12 centers and displays the matching batch returned by the API.
- Native select controls preserve keyboard behavior. The FAQ uses native single-open details elements. Mobile navigation expands inline.
- Auth uses the backend's HttpOnly cookie, never browser token storage. Login accepts only same-origin relative return paths.
- Booking requires a batch with seats, a future local date/time, and a contact phone; the submitted date is converted to ISO format. Confirmation appears only after API success.
- Cancellation requires an explicit browser confirmation. Saved center removal is immediate after API success.
- My learning shows up to 50 recent bookings and 50 saved centers, matching the API's maximum page size. Full account pagination is future work.

## Validation

Computed token contrast: navy/yellow 10.90:1; navy/cream-white 15.27:1; secondary text/cream-white 6.25:1; white/navy 15.53:1; green/mint 5.91:1. These are token calculations, not a claim of a complete accessibility audit.

- Production compilation and TypeScript check pass.
- ESLint passes.
- Browser tests cover mobile navigation, native FAQ behavior, search/filter payloads, error recovery, booking payloads, saved-center removal, and login errors/redirects.
- Homepage overflow checked at 320, 375, 768, 1024, and 1440px. Decorative overflow was corrected during review.
- Desktop and mobile screenshots were visually reviewed.
- Live public search was checked: the local database returned an empty result set.
- Booking/auth mutation tests use controlled API responses; no real users or bookings were created during frontend testing.

## Remaining product scope

Owner/admin dashboards, private-tutor discovery, tuition payments, password recovery, and side-by-side center comparison are not part of this student frontend. The supplied backend does not yet provide a password-recovery flow. Listings need approved centers, teachers, and active batches to appear in public search; use the existing owner/admin APIs described in README.

## Toolkit references

`CONSULT.md`, `workflows/quick-reference.md`, `heuristics/llm-design-gotchas.md`, `layout/visual-hierarchy.md`, `typography/type-scale.md`, `components/buttons.md`, `color/color-psychology.md`, `workflows/component-decision-points.md`, `docs/presets/index.json`, and `docs/presets/landing/playful.html`.
