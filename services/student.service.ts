import type { User } from '@/lib/server/auth'
import { one, rows, transaction } from '@/lib/server/db'
import { ApiError } from '@/lib/server/http'
import { publicBatch, publicCenter } from '@/lib/server/marketplace'
import type { BookingInput, BookingUpdateInput, InquiryInput, ProfileInput, ReportInput, ReviewInput } from '@/validators/student.validator'

const profileColumns: Record<keyof ProfileInput, string> = {
  classLevel: 'class_level', board: 'board', examGoal: 'exam_goal',
  preferredBudgetMin: 'preferred_budget_min', preferredBudgetMax: 'preferred_budget_max',
  preferredMode: 'preferred_mode', latitude: 'latitude', longitude: 'longitude',
}

export async function getStudentProfile(userId: string) {
  return one('SELECT * FROM student_profiles WHERE user_id=$1', [userId])
}

export async function saveStudentProfile(userId: string, input: ProfileInput) {
  const existing = await getStudentProfile(userId)
  const minimum = input.preferredBudgetMin === undefined ? existing?.preferred_budget_min : input.preferredBudgetMin
  const maximum = input.preferredBudgetMax === undefined ? existing?.preferred_budget_max : input.preferredBudgetMax
  const latitude = input.latitude === undefined ? existing?.latitude : input.latitude
  const longitude = input.longitude === undefined ? existing?.longitude : input.longitude
  if (minimum != null && maximum != null && minimum > maximum) throw new ApiError(422, 'Minimum budget exceeds maximum budget')
  if ((latitude == null) !== (longitude == null)) throw new ApiError(422, 'Latitude and longitude must be set together')
  const entries = Object.entries(input) as [keyof ProfileInput, unknown][]
  const columns = entries.map(([key]) => profileColumns[key])
  const values = entries.map(([, value]) => value)
  const placeholders = values.map((_, index) => `$${index + 2}`)
  const assignments = columns.map(column => `${column}=EXCLUDED.${column}`).join(', ')
  return one(`INSERT INTO student_profiles(user_id,${columns.join(',')}) VALUES($1,${placeholders.join(',')})
    ON CONFLICT (user_id) DO UPDATE SET ${assignments},updated_at=now() RETURNING *`, [userId, ...values])
}

export async function createDemoBooking(user: User, input: BookingInput) {
  if (new Date(input.bookingTime).getTime() <= Date.now()) throw new ApiError(422, 'Booking must be in the future')
  const batch = await publicBatch(input.centerId, input.batchId)
  if (batch.filled_seats >= batch.capacity) throw new ApiError(409, 'Batch is full')
  const contactPhone = input.contactPhone ?? user.phone
  if (!contactPhone) throw new ApiError(422, 'A contact phone is required for demo booking')
  return transaction(async client => {
    const booking = (await client.query(`INSERT INTO demo_bookings(student_id,center_id,batch_id,teacher_id,booking_time,contact_phone)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING *`, [user.id,input.centerId,input.batchId,batch.teacher_id,input.bookingTime,contactPhone])).rows[0]
    await client.query(`INSERT INTO leads(student_id,center_id,batch_id,source,status)
      VALUES($1,$2,$3,'demo','demo_scheduled')`, [user.id,input.centerId,input.batchId])
    return booking
  })
}

export async function listDemoBookings(userId: string, limit: number, offset: number) {
  return rows(`SELECT d.*,c.name AS center_name,b.batch_name,t.name AS teacher_name
    FROM demo_bookings d JOIN centers c ON c.id=d.center_id JOIN batches b ON b.id=d.batch_id
    JOIN teachers t ON t.id=d.teacher_id WHERE d.student_id=$1
    ORDER BY d.booking_time DESC,d.id LIMIT $2 OFFSET $3`, [userId,limit,offset])
}

export async function getDemoBooking(userId: string, bookingId: string) {
  const booking = await one(`SELECT d.*,c.name AS center_name,b.batch_name,t.name AS teacher_name
    FROM demo_bookings d JOIN centers c ON c.id=d.center_id JOIN batches b ON b.id=d.batch_id
    JOIN teachers t ON t.id=d.teacher_id WHERE d.id=$1 AND d.student_id=$2`, [bookingId,userId])
  if (!booking) throw new ApiError(404, 'Booking not found')
  return booking
}

export async function changeDemoBooking(user: User, bookingId: string, input: BookingUpdateInput) {
  return transaction(async client => {
    const booking = (await client.query(`SELECT d.*,c.owner_id FROM demo_bookings d JOIN centers c ON c.id=d.center_id
      WHERE d.id=$1 FOR UPDATE OF d`, [bookingId])).rows[0]
    if (!booking || (user.role === 'owner' ? booking.owner_id !== user.id : booking.student_id !== user.id)) {
      throw new ApiError(404, 'Booking not found')
    }
    if (booking.status !== 'booked') throw new ApiError(409, 'Booking is no longer active')
    if (user.role !== 'owner' && !['booked','cancelled'].includes(input.status)) throw new ApiError(403, 'Only owner can mark attendance')
    if (input.status === 'booked' && !input.bookingTime) throw new ApiError(422, 'A new booking time is required')
    if (input.bookingTime && (input.status !== 'booked' || new Date(input.bookingTime).getTime() <= Date.now())) throw new ApiError(422, 'Invalid reschedule time')
    if (['attended','no_show'].includes(input.status) && new Date(booking.booking_time).getTime() > Date.now()) throw new ApiError(422, 'Demo has not happened yet')
    if (input.status === 'booked') {
      const batch = await publicBatch(booking.center_id, booking.batch_id)
      if (batch.filled_seats >= batch.capacity) throw new ApiError(409, 'Batch is full')
    }
    return (await client.query(`UPDATE demo_bookings SET status=$2,booking_time=COALESCE($3,booking_time)
      WHERE id=$1 RETURNING *`, [bookingId,input.status,input.bookingTime ?? null])).rows[0]
  })
}

export async function createInquiry(userId: string, input: InquiryInput) {
  await publicCenter(input.centerId)
  if (input.batchId) await publicBatch(input.centerId,input.batchId)
  return one(`INSERT INTO leads(student_id,center_id,batch_id,student_message)
    VALUES($1,$2,$3,$4) RETURNING *`, [userId,input.centerId,input.batchId ?? null,input.message])
}

export async function listInquiries(userId: string, limit: number, offset: number) {
  return rows(`SELECT l.id,l.center_id,l.batch_id,l.source,l.status,l.student_message,l.created_at,l.updated_at,
    c.name AS center_name FROM leads l JOIN centers c ON c.id=l.center_id WHERE l.student_id=$1
    ORDER BY l.created_at DESC,l.id LIMIT $2 OFFSET $3`, [userId,limit,offset])
}

export async function getInquiry(userId: string, leadId: string) {
  const lead = await one(`SELECT l.id,l.center_id,l.batch_id,l.source,l.status,l.student_message,l.created_at,l.updated_at,
    c.name AS center_name FROM leads l JOIN centers c ON c.id=l.center_id WHERE l.id=$1 AND l.student_id=$2`, [leadId,userId])
  if (!lead) throw new ApiError(404, 'Inquiry not found')
  return lead
}

export async function createVerifiedReview(userId: string, input: ReviewInput) {
  const booking = await one(`SELECT * FROM demo_bookings WHERE id=$1 AND student_id=$2 AND status='attended'`, [input.bookingId,userId])
  if (!booking) throw new ApiError(422, 'An attended demo booking is required')
  if (input.teacherId && input.teacherId !== booking.teacher_id) throw new ApiError(422, 'Teacher does not match booking')
  return one(`INSERT INTO reviews(student_id,center_id,teacher_id,booking_id,rating,review_text,
    teaching_clarity_rating,doubt_solving_rating,environment_rating,value_for_money_rating)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [userId,booking.center_id,
    input.teacherId ?? booking.teacher_id,input.bookingId,input.rating,input.reviewText,
    input.teachingClarityRating ?? null,input.doubtSolvingRating ?? null,input.environmentRating ?? null,
    input.valueForMoneyRating ?? null])
}

export async function listMyReviews(userId: string, limit: number, offset: number) {
  return rows(`SELECT r.*,c.name AS center_name FROM reviews r JOIN centers c ON c.id=r.center_id
    WHERE r.student_id=$1 ORDER BY r.created_at DESC,r.id LIMIT $2 OFFSET $3`, [userId,limit,offset])
}

export async function saveShortlist(userId: string, centerId: string) {
  await publicCenter(centerId)
  const added = await one(`INSERT INTO shortlists(student_id,center_id) VALUES($1,$2)
    ON CONFLICT DO NOTHING RETURNING *`, [userId,centerId])
  return { ...(added ?? { student_id: userId, center_id: centerId }), created: Boolean(added) }
}

export async function listShortlists(userId: string, limit: number, offset: number) {
  return rows(`SELECT c.*,s.created_at AS saved_at FROM shortlists s JOIN centers c ON c.id=s.center_id
    WHERE s.student_id=$1 AND c.verification_status='approved' AND c.listing_status='active'
    ORDER BY s.created_at DESC,c.id LIMIT $2 OFFSET $3`, [userId,limit,offset])
}

export async function removeShortlist(userId: string, centerId: string) {
  const deleted = await one('DELETE FROM shortlists WHERE student_id=$1 AND center_id=$2 RETURNING center_id', [userId,centerId])
  return { removed: Boolean(deleted) }
}

export async function createReport(userId: string, input: ReportInput) {
  await publicCenter(input.centerId)
  return one(`INSERT INTO reports(reporter_id,center_id,issue_type,details)
    VALUES($1,$2,$3,$4) RETURNING *`, [userId,input.centerId,input.issueType,input.details])
}

export async function listMyReports(userId: string, limit: number, offset: number) {
  return rows(`SELECT id,center_id,issue_type,details,status,created_at FROM reports
    WHERE reporter_id=$1 ORDER BY created_at DESC,id LIMIT $2 OFFSET $3`, [userId,limit,offset])
}
