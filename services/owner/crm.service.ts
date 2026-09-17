import { one, rows } from '@/lib/server/db'
import { ApiError } from '@/lib/server/http'
import type { LeadListQuery, OwnerListQuery } from '@/validators/owner.validator'
import { requireOwnedCenter } from './ownership'

export async function listLeads(ownerId: string, query: LeadListQuery) {
  if (query.centerId) await requireOwnedCenter(ownerId,query.centerId)
  return rows(`SELECT l.*,u.full_name AS student_name,u.email AS student_email,u.phone AS student_phone,
    c.name AS center_name FROM leads l JOIN centers c ON c.id=l.center_id JOIN users u ON u.id=l.student_id
    WHERE c.owner_id=$1 AND ($2::uuid IS NULL OR l.center_id=$2) AND ($3::text IS NULL OR l.status=$3)
    ORDER BY l.created_at DESC,l.id LIMIT $4 OFFSET $5`,
  [ownerId,query.centerId ?? null,query.status ?? null,query.limit,query.offset])
}

export async function getLead(ownerId: string, leadId: string) {
  const lead = await one(`SELECT l.*,u.full_name AS student_name,u.email AS student_email,u.phone AS student_phone,
    c.name AS center_name FROM leads l JOIN centers c ON c.id=l.center_id JOIN users u ON u.id=l.student_id
    WHERE l.id=$1 AND c.owner_id=$2`, [leadId,ownerId])
  if (!lead) throw new ApiError(404,'Lead not found')
  return lead
}

export async function updateLead(ownerId: string, leadId: string, status: string) {
  const lead = await one(`UPDATE leads l SET status=$3,updated_at=now() FROM centers c
    WHERE l.id=$1 AND l.center_id=c.id AND c.owner_id=$2 RETURNING l.*`, [leadId,ownerId,status])
  if (!lead) throw new ApiError(404,'Lead not found')
  return lead
}

export async function listBookings(ownerId: string, query: OwnerListQuery) {
  if (query.centerId) await requireOwnedCenter(ownerId,query.centerId)
  return rows(`SELECT d.*,u.full_name AS student_name,u.email AS student_email,
    COALESCE(d.contact_phone,u.phone) AS student_phone,c.name AS center_name,b.batch_name
    FROM demo_bookings d JOIN centers c ON c.id=d.center_id JOIN users u ON u.id=d.student_id
    JOIN batches b ON b.id=d.batch_id WHERE c.owner_id=$1 AND ($2::uuid IS NULL OR d.center_id=$2)
    ORDER BY d.booking_time DESC,d.id LIMIT $3 OFFSET $4`,
  [ownerId,query.centerId ?? null,query.limit,query.offset])
}

export async function getBooking(ownerId: string, bookingId: string) {
  const booking = await one(`SELECT d.*,u.full_name AS student_name,u.email AS student_email,
    COALESCE(d.contact_phone,u.phone) AS student_phone,c.name AS center_name,b.batch_name
    FROM demo_bookings d JOIN centers c ON c.id=d.center_id JOIN users u ON u.id=d.student_id
    JOIN batches b ON b.id=d.batch_id WHERE d.id=$1 AND c.owner_id=$2`, [bookingId,ownerId])
  if (!booking) throw new ApiError(404,'Booking not found')
  return booking
}

export async function getAnalytics(ownerId: string, centerId?: string) {
  if (centerId) await requireOwnedCenter(ownerId,centerId)
  const [centers,batches,leads,bookings] = await Promise.all([
    one(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER (WHERE verification_status='approved')::int AS approved,
      COUNT(*) FILTER (WHERE listing_status='active')::int AS active FROM centers
      WHERE owner_id=$1 AND ($2::uuid IS NULL OR id=$2)`, [ownerId,centerId ?? null]),
    one(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER (WHERE b.status='active')::int AS active,
      COALESCE(SUM(b.capacity-b.filled_seats),0)::int AS vacant_seats
      FROM batches b JOIN centers c ON c.id=b.center_id
      WHERE c.owner_id=$1 AND ($2::uuid IS NULL OR b.center_id=$2)`, [ownerId,centerId ?? null]),
    one(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER (WHERE l.status='new')::int AS new,
      COUNT(*) FILTER (WHERE l.status='contacted')::int AS contacted,
      COUNT(*) FILTER (WHERE l.status='demo_scheduled')::int AS demo_scheduled,
      COUNT(*) FILTER (WHERE l.status='converted')::int AS converted
      FROM leads l JOIN centers c ON c.id=l.center_id
      WHERE c.owner_id=$1 AND ($2::uuid IS NULL OR l.center_id=$2)`, [ownerId,centerId ?? null]),
    one(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER (WHERE d.status='booked')::int AS booked,
      COUNT(*) FILTER (WHERE d.status='attended')::int AS attended,
      COUNT(*) FILTER (WHERE d.status='no_show')::int AS no_show
      FROM demo_bookings d JOIN centers c ON c.id=d.center_id
      WHERE c.owner_id=$1 AND ($2::uuid IS NULL OR d.center_id=$2)`, [ownerId,centerId ?? null]),
  ])
  return { centers,batches,leads,bookings }
}
