import { z } from 'zod'
import { login, logout, me, register, requireRole, type User } from './auth'
import { one, rows, transaction } from './db'
import { ApiError, body, fail, ok, uuid } from './http'

const id = z.uuid()
const text = z.string().trim().min(1)
const url = z.url().refine(v => ['https:','http:'].includes(new URL(v).protocol))
const centerInput = z.object({ name: text.max(255), description: z.string().max(5000).optional(), address: text.max(1000), city: text.max(100), locality: text.max(100), latitude: z.number().min(-90).max(90).nullable().optional(), longitude: z.number().min(-180).max(180).nullable().optional(), contactPhone: z.string().max(20).optional(), photos: z.array(url).max(20).default([]), facilities: z.array(z.string().max(100)).max(30).default([]) }).strict()
const teacherInput = z.object({ centerId: id, name: text.max(150), qualification: z.string().max(255).optional(), experienceYears: z.number().int().min(0).max(80).optional(), bio: z.string().max(5000).optional(), subjectIds: z.array(id).max(30).default([]) }).strict()
const batchInput = z.object({ centerId: id, teacherId: id, subjectId: id, batchName: text.max(150), classLevel: z.string().max(20).optional(), board: z.string().max(50).optional(), examType: z.string().max(100).optional(), startTime: z.iso.time(), endTime: z.iso.time(), daysOfWeek: z.array(z.enum(['mon','tue','wed','thu','fri','sat','sun'])).min(1), mode: z.enum(['online','offline','hybrid']), capacity: z.number().int().positive(), filledSeats: z.number().int().min(0).default(0), monthlyFee: z.number().int().min(0).optional() }).refine(v => v.filledSeats <= v.capacity && v.startTime < v.endTime, 'Invalid capacity or time range')
const videoInput = z.object({ centerId: id, teacherId: id, subjectId: id, title: text.max(255), topic: z.string().max(255).optional(), videoUrl: url, durationSeconds: z.number().int().positive().optional(), language: z.string().max(50).optional() }).strict()

async function ownedCenter(user: User, centerId: string) {
  const center = await one('SELECT id FROM centers WHERE id=$1 AND owner_id=$2', [centerId,user.id])
  if (!center) throw new ApiError(404, 'Center not found')
}
async function publicCenter(centerId: string) {
  const center = await one('SELECT c.*, (SELECT ROUND(AVG(r.rating)::numeric,2) FROM reviews r WHERE r.center_id=c.id AND r.moderation_status=\'approved\') AS average_rating, (SELECT COUNT(*)::int FROM reviews r WHERE r.center_id=c.id AND r.moderation_status=\'approved\') AS total_reviews FROM centers c WHERE c.id=$1 AND c.verification_status=\'approved\' AND c.listing_status=\'active\'', [centerId])
  if (!center) throw new ApiError(404, 'Center not found')
  return center
}
async function validBatch(centerId: string, batchId: string) {
  const batch = await one('SELECT b.* FROM batches b JOIN centers c ON c.id=b.center_id JOIN teachers t ON t.id=b.teacher_id WHERE b.id=$1 AND b.center_id=$2 AND b.status=\'active\' AND t.verification_status=\'approved\' AND c.verification_status=\'approved\' AND c.listing_status=\'active\'', [batchId,centerId])
  if (!batch) throw new ApiError(404, 'Batch not found')
  return batch
}

async function search(request: Request) {
  const p = new URL(request.url).searchParams
  const q = z.object({ city: z.string().max(100).optional(), locality: z.string().max(100).optional(), subject: z.string().max(100).optional(), classLevel: z.string().max(20).optional(), board: z.string().max(50).optional(), exam: z.string().max(100).optional(), mode: z.enum(['online','offline','hybrid']).optional(), timing: z.enum(['morning','afternoon','evening']).optional(), vacancy: z.enum(['true','false']).optional(), maxFee: z.coerce.number().int().min(0).optional(), minRating: z.coerce.number().min(0).max(5).optional(), latitude: z.coerce.number().min(-90).max(90).optional(), longitude: z.coerce.number().min(-180).max(180).optional(), radiusKm: z.coerce.number().positive().max(100).optional(), limit: z.coerce.number().int().min(1).max(50).default(20), offset: z.coerce.number().int().min(0).default(0) }).parse(Object.fromEntries(p))
  if ((q.latitude === undefined) !== (q.longitude === undefined) || (q.radiusKm !== undefined && q.latitude === undefined)) throw new ApiError(422, 'Latitude and longitude are required together')
  const values: unknown[] = []
  const add = (value: unknown) => { values.push(value); return `$${values.length}` }
  const where = ["c.verification_status='approved'", "c.listing_status='active'"]
  if (q.city) where.push(`c.city ILIKE ${add(q.city)}`)
  if (q.locality) where.push(`c.locality ILIKE ${add(q.locality)}`)
  if (q.subject) where.push(`s.name ILIKE ${add(q.subject)}`)
  if (q.classLevel) where.push(`b.class_level=${add(q.classLevel)}`)
  if (q.board) where.push(`b.board ILIKE ${add(q.board)}`)
  if (q.exam) where.push(`b.exam_type ILIKE ${add(q.exam)}`)
  if (q.mode) where.push(`b.mode=${add(q.mode)}`)
  if (q.maxFee !== undefined) where.push(`b.monthly_fee<=${add(q.maxFee)}`)
  if (q.vacancy === 'true') where.push('b.filled_seats<b.capacity')
  if (q.timing) where.push(`b.start_time ${q.timing === 'morning' ? '<' : q.timing === 'afternoon' ? '>=' : '>='} '${q.timing === 'morning' ? '12:00' : q.timing === 'afternoon' ? '12:00' : '17:00'}'`)
  if (q.timing === 'afternoon') where.push("b.start_time < '17:00'")
  const distance = q.latitude !== undefined ? `(6371 * acos(least(1,greatest(-1,cos(radians(${add(q.latitude)}))*cos(radians(c.latitude))*cos(radians(c.longitude)-radians(${add(q.longitude)}))+sin(radians(${add(q.latitude)}))*sin(radians(c.latitude))))))` : 'NULL::double precision'
  if (q.radiusKm) where.push(`c.latitude IS NOT NULL AND c.longitude IS NOT NULL AND ${distance}<=${add(q.radiusKm)}`)
  const sql = `WITH matches AS (SELECT c.id,c.name,c.address,c.city,c.locality,c.latitude,c.longitude,c.photos,c.featured,b.id AS batch_id,b.batch_name,b.class_level,b.board,b.start_time,b.end_time,b.mode,b.monthly_fee,b.capacity-b.filled_seats AS vacant_seats,b.vacancy_last_updated_at,s.name AS subject,${distance} AS distance_km FROM centers c JOIN batches b ON b.center_id=c.id AND b.status='active' JOIN teachers t ON t.id=b.teacher_id AND t.verification_status='approved' JOIN subjects s ON s.id=b.subject_id WHERE ${where.join(' AND ')}), ratings AS (SELECT center_id,ROUND(AVG(rating)::numeric,2) AS average_rating,COUNT(*)::int AS total_reviews FROM reviews WHERE moderation_status='approved' GROUP BY center_id) SELECT m.*,COALESCE(r.average_rating,0) AS average_rating,COALESCE(r.total_reviews,0) AS total_reviews FROM matches m LEFT JOIN ratings r ON r.center_id=m.id WHERE COALESCE(r.average_rating,0)>=${add(q.minRating ?? 0)} ORDER BY m.featured DESC,COALESCE(r.average_rating,0) DESC, m.distance_km ASC NULLS LAST,m.vacant_seats DESC,m.id,m.batch_id LIMIT ${add(q.limit)} OFFSET ${add(q.offset)}`
  return ok(await rows(sql,values))
}

async function getCenter(centerId: string) {
  const center = await publicCenter(centerId)
  const [teachers,batches,videos,reviews] = await Promise.all([
    rows('SELECT t.id,t.name,t.qualification,t.experience_years,t.bio,t.verification_status,COALESCE(json_agg(DISTINCT s.name) FILTER (WHERE s.id IS NOT NULL),\'[]\') AS subjects FROM teachers t LEFT JOIN teacher_subjects ts ON ts.teacher_id=t.id LEFT JOIN subjects s ON s.id=ts.subject_id WHERE t.center_id=$1 AND t.verification_status=\'approved\' GROUP BY t.id', [centerId]),
    rows('SELECT b.*,b.capacity-b.filled_seats AS vacant_seats,s.name AS subject,t.name AS teacher_name FROM batches b JOIN subjects s ON s.id=b.subject_id JOIN teachers t ON t.id=b.teacher_id WHERE b.center_id=$1 AND b.status=\'active\' AND t.verification_status=\'approved\' ORDER BY b.start_time', [centerId]),
    rows('SELECT id,teacher_id,subject_id,title,topic,video_url,duration_seconds,language FROM demo_videos WHERE center_id=$1 AND approval_status=\'approved\'', [centerId]),
    rows('SELECT r.id,r.rating,r.review_text,r.created_at,u.full_name AS reviewer FROM reviews r JOIN users u ON u.id=r.student_id WHERE r.center_id=$1 AND r.moderation_status=\'approved\' ORDER BY r.created_at DESC LIMIT 50', [centerId]),
  ])
  return ok({ ...center,teachers,batches,videos,reviews })
}

async function getTeacher(teacherId: string) {
  const teacher = await one('SELECT t.id,t.center_id,t.name,t.qualification,t.experience_years,t.bio,t.verification_status FROM teachers t JOIN centers c ON c.id=t.center_id WHERE t.id=$1 AND t.verification_status=\'approved\' AND c.verification_status=\'approved\' AND c.listing_status=\'active\'', [teacherId])
  if (!teacher) throw new ApiError(404, 'Teacher not found')
  return ok({ ...teacher, subjects: await rows('SELECT s.* FROM subjects s JOIN teacher_subjects ts ON ts.subject_id=s.id WHERE ts.teacher_id=$1', [teacherId]), videos: await rows('SELECT id,title,topic,video_url,duration_seconds FROM demo_videos WHERE teacher_id=$1 AND approval_status=\'approved\'', [teacherId]), reviews: await rows('SELECT rating,review_text,created_at FROM reviews WHERE teacher_id=$1 AND moderation_status=\'approved\' ORDER BY created_at DESC LIMIT 30', [teacherId]) })
}

async function createCenter(request: Request) {
  const user = await requireRole(request,['owner'])
  const v = centerInput.parse(await body(request))
  return ok(await one('INSERT INTO centers(owner_id,name,description,address,city,locality,latitude,longitude,contact_phone,photos,facilities) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *', [user.id,v.name,v.description ?? null,v.address,v.city,v.locality,v.latitude ?? null,v.longitude ?? null,v.contactPhone ?? null,v.photos,v.facilities]),201)
}
async function updateCenter(request: Request, centerId: string) {
  const user = await requireRole(request,['owner']); await ownedCenter(user,centerId)
  const v = centerInput.partial().extend({ listingStatus: z.enum(['draft','active','paused']).optional() }).parse(await body(request))
  if (v.listingStatus === 'active') {
    const center = await one('SELECT verification_status FROM centers WHERE id=$1',[centerId])
    if (center?.verification_status !== 'approved') throw new ApiError(409,'Center must be approved before activation')
  }
  const fields: Record<string,unknown> = { name:v.name,description:v.description,address:v.address,city:v.city,locality:v.locality,latitude:v.latitude,longitude:v.longitude,contact_phone:v.contactPhone,photos:v.photos,facilities:v.facilities,listing_status:v.listingStatus }
  const entries = Object.entries(fields).filter(([,value]) => value !== undefined)
  if (!entries.length) throw new ApiError(422,'No fields to update')
  const assignments = entries.map(([key],i) => `${key}=$${i+2}`).join(',')
  return ok(await one(`UPDATE centers SET ${assignments},updated_at=now() WHERE id=$1 RETURNING *`,[centerId,...entries.map(([,value])=>value)]))
}
async function createTeacher(request: Request) {
  const user = await requireRole(request,['owner']); const v=teacherInput.parse(await body(request)); await ownedCenter(user,v.centerId)
  return ok(await transaction(async client => {
    const t=(await client.query('INSERT INTO teachers(center_id,name,qualification,experience_years,bio) VALUES($1,$2,$3,$4,$5) RETURNING *',[v.centerId,v.name,v.qualification ?? null,v.experienceYears ?? null,v.bio ?? null])).rows[0]
    for (const subjectId of v.subjectIds) await client.query('INSERT INTO teacher_subjects(teacher_id,subject_id) VALUES($1,$2)',[t.id,subjectId])
    return t
  }),201)
}
async function createBatch(request: Request) {
  const user=await requireRole(request,['owner']); const v=batchInput.parse(await body(request)); await ownedCenter(user,v.centerId)
  const teacher=await one('SELECT id FROM teachers WHERE id=$1 AND center_id=$2',[v.teacherId,v.centerId]); if (!teacher) throw new ApiError(422,'Teacher does not belong to center')
  const subject=await one('SELECT 1 FROM teacher_subjects WHERE teacher_id=$1 AND subject_id=$2',[v.teacherId,v.subjectId]); if (!subject) throw new ApiError(422,'Teacher does not teach this subject')
  return ok(await one('INSERT INTO batches(center_id,teacher_id,subject_id,batch_name,class_level,board,exam_type,start_time,end_time,days_of_week,mode,capacity,filled_seats,monthly_fee) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *',[v.centerId,v.teacherId,v.subjectId,v.batchName,v.classLevel ?? null,v.board ?? null,v.examType ?? null,v.startTime,v.endTime,v.daysOfWeek,v.mode,v.capacity,v.filledSeats,v.monthlyFee ?? null]),201)
}
async function updateVacancy(request: Request, batchId: string) {
  const user=await requireRole(request,['owner']); const v=z.object({ filledSeats:z.number().int().min(0) }).strict().parse(await body(request))
  return ok(await transaction(async client => {
    const result=await client.query('SELECT b.* FROM batches b JOIN centers c ON c.id=b.center_id WHERE b.id=$1 AND c.owner_id=$2 FOR UPDATE OF b',[batchId,user.id]); const batch=result.rows[0]
    if (!batch) throw new ApiError(404,'Batch not found')
    if (v.filledSeats>batch.capacity) throw new ApiError(422,'Filled seats exceed capacity')
    const updated=(await client.query('UPDATE batches SET filled_seats=$2,vacancy_last_updated_at=now() WHERE id=$1 RETURNING *,capacity-filled_seats AS vacant_seats',[batchId,v.filledSeats])).rows[0]
    await client.query('INSERT INTO vacancy_audit(batch_id,actor_id,old_filled,new_filled) VALUES($1,$2,$3,$4)',[batchId,user.id,batch.filled_seats,v.filledSeats])
    return updated
  }))
}
async function createVideo(request: Request) {
  const user=await requireRole(request,['owner']); const v=videoInput.parse(await body(request)); await ownedCenter(user,v.centerId)
  if (!await one('SELECT 1 FROM teachers WHERE id=$1 AND center_id=$2',[v.teacherId,v.centerId])) throw new ApiError(422,'Teacher does not belong to center')
  if (!await one('SELECT 1 FROM teacher_subjects WHERE teacher_id=$1 AND subject_id=$2',[v.teacherId,v.subjectId])) throw new ApiError(422,'Teacher does not teach this subject')
  return ok(await one('INSERT INTO demo_videos(center_id,teacher_id,subject_id,title,topic,video_url,duration_seconds,language) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[v.centerId,v.teacherId,v.subjectId,v.title,v.topic ?? null,v.videoUrl,v.durationSeconds ?? null,v.language ?? null]),201)
}

async function bookDemo(request: Request) {
  const user=await requireRole(request,['student','parent'])
  const v=z.object({ centerId:id,batchId:id,bookingTime:z.iso.datetime({ offset:true }) }).strict().parse(await body(request))
  if (new Date(v.bookingTime).getTime()<=Date.now()) throw new ApiError(422,'Booking must be in the future')
  const batch=await validBatch(v.centerId,v.batchId)
  if (batch.filled_seats>=batch.capacity) throw new ApiError(409,'Batch is full')
  return ok(await transaction(async client => {
    const booking=(await client.query('INSERT INTO demo_bookings(student_id,center_id,batch_id,teacher_id,booking_time) VALUES($1,$2,$3,$4,$5) RETURNING *',[user.id,v.centerId,v.batchId,batch.teacher_id,v.bookingTime])).rows[0]
    await client.query('INSERT INTO leads(student_id,center_id,batch_id,source,status) VALUES($1,$2,$3,\'demo\',\'demo_scheduled\')',[user.id,v.centerId,v.batchId])
    return booking
  }),201)
}
async function updateBooking(request: Request, bookingId: string) {
  const user=await requireRole(request,['student','parent','owner'])
  const v=z.object({ status:z.enum(['booked','cancelled','attended','no_show']), bookingTime:z.iso.datetime({ offset:true }).optional() }).strict().parse(await body(request))
  const booking=await one('SELECT d.*,c.owner_id FROM demo_bookings d JOIN centers c ON c.id=d.center_id WHERE d.id=$1',[bookingId])
  if (!booking) throw new ApiError(404,'Booking not found')
  if (user.role==='owner' ? booking.owner_id!==user.id : booking.student_id!==user.id) throw new ApiError(403,'Insufficient permissions')
  if (user.role!=='owner' && !['booked','cancelled'].includes(v.status)) throw new ApiError(403,'Only owner can mark attendance')
  if (booking.status!=='booked') throw new ApiError(409,'Booking is no longer active')
  if (v.status==='booked' && !v.bookingTime) throw new ApiError(422,'A new booking time is required')
  if (v.bookingTime && (v.status!=='booked' || new Date(v.bookingTime).getTime()<=Date.now())) throw new ApiError(422,'Invalid reschedule time')
  if (['attended','no_show'].includes(v.status) && new Date(booking.booking_time).getTime()>Date.now()) throw new ApiError(422,'Demo has not happened yet')
  return ok(await one('UPDATE demo_bookings SET status=$2,booking_time=COALESCE($3,booking_time) WHERE id=$1 RETURNING *',[bookingId,v.status,v.bookingTime ?? null]))
}
async function inquiry(request: Request) {
  const user=await requireRole(request,['student','parent'])
  const v=z.object({ centerId:id,batchId:id.optional(), message:text.max(2000) }).strict().parse(await body(request))
  await publicCenter(v.centerId)
  if (v.batchId) await validBatch(v.centerId,v.batchId)
  return ok(await one('INSERT INTO leads(student_id,center_id,batch_id,student_message) VALUES($1,$2,$3,$4) RETURNING *',[user.id,v.centerId,v.batchId ?? null,v.message]),201)
}
async function review(request: Request) {
  const user=await requireRole(request,['student','parent'])
  const v=z.object({ bookingId:id, rating:z.number().int().min(1).max(5), reviewText:text.max(3000), teacherId:id.optional() }).strict().parse(await body(request))
  const booking=await one('SELECT * FROM demo_bookings WHERE id=$1 AND student_id=$2 AND status=\'attended\'',[v.bookingId,user.id])
  if (!booking) throw new ApiError(422,'An attended demo booking is required')
  if (v.teacherId && v.teacherId!==booking.teacher_id) throw new ApiError(422,'Teacher does not match booking')
  return ok(await one('INSERT INTO reviews(student_id,center_id,teacher_id,booking_id,rating,review_text) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[user.id,booking.center_id,v.teacherId ?? booking.teacher_id,v.bookingId,v.rating,v.reviewText]),201)
}
async function shortlist(request: Request) {
  const user=await requireRole(request,['student','parent']); const v=z.object({ centerId:id }).strict().parse(await body(request)); await publicCenter(v.centerId)
  return ok(await one('INSERT INTO shortlists(student_id,center_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING *',[user.id,v.centerId]) ?? { student_id:user.id,center_id:v.centerId },201)
}
async function report(request: Request) {
  const user=await requireRole(request,['student','parent','owner','teacher'])
  const v=z.object({ centerId:id, issueType:z.enum(['vacancy_mismatch','duplicate_listing','misleading_content','other']), details:text.max(3000) }).strict().parse(await body(request))
  await publicCenter(v.centerId)
  return ok(await one('INSERT INTO reports(reporter_id,center_id,issue_type,details) VALUES($1,$2,$3,$4) RETURNING *',[user.id,v.centerId,v.issueType,v.details]),201)
}
async function ownerLeads(request: Request) {
  const user=await requireRole(request,['owner'])
  return ok(await rows('SELECT l.*,u.full_name AS student_name,u.email AS student_email,u.phone AS student_phone,c.name AS center_name FROM leads l JOIN centers c ON c.id=l.center_id JOIN users u ON u.id=l.student_id WHERE c.owner_id=$1 ORDER BY l.created_at DESC LIMIT 100',[user.id]))
}
async function ownerBookings(request: Request) {
  const user=await requireRole(request,['owner'])
  return ok(await rows('SELECT d.*,u.full_name AS student_name,u.email AS student_email,u.phone AS student_phone FROM demo_bookings d JOIN centers c ON c.id=d.center_id JOIN users u ON u.id=d.student_id WHERE c.owner_id=$1 ORDER BY d.booking_time DESC LIMIT 100',[user.id]))
}
async function ownerAnalytics(request: Request) {
  const user=await requireRole(request,['owner'])
  return ok(await one(`SELECT (SELECT COUNT(*)::int FROM centers WHERE owner_id=$1) AS centers,
    (SELECT COUNT(*)::int FROM batches b JOIN centers c ON c.id=b.center_id WHERE c.owner_id=$1) AS batches,
    (SELECT COUNT(*)::int FROM leads l JOIN centers c ON c.id=l.center_id WHERE c.owner_id=$1) AS leads,
    (SELECT COUNT(*)::int FROM demo_bookings d JOIN centers c ON c.id=d.center_id WHERE c.owner_id=$1 AND d.status='attended') AS attended_demos`,[user.id]))
}
async function updateLead(request: Request, leadId: string) {
  const user=await requireRole(request,['owner'])
  const v=z.object({ status:z.enum(['new','contacted','demo_scheduled','converted','closed']) }).strict().parse(await body(request))
  const lead=await one('UPDATE leads l SET status=$3,updated_at=now() FROM centers c WHERE l.id=$1 AND l.center_id=c.id AND c.owner_id=$2 RETURNING l.*',[leadId,user.id,v.status])
  if (!lead) throw new ApiError(404,'Lead not found')
  return ok(lead)
}
async function adminQueue(request: Request) {
  await requireRole(request,['admin'])
  const [centers,teachers,videos,reviews,reports]=await Promise.all([
    rows("SELECT * FROM centers WHERE verification_status='pending' ORDER BY created_at"),
    rows("SELECT * FROM teachers WHERE verification_status='pending' ORDER BY created_at"),
    rows("SELECT * FROM demo_videos WHERE approval_status='pending' ORDER BY uploaded_at"),
    rows("SELECT * FROM reviews WHERE moderation_status='pending' ORDER BY created_at"),
    rows("SELECT * FROM reports WHERE status='pending' ORDER BY created_at"),
  ])
  return ok({ centers,teachers,videos,reviews,reports })
}
async function moderate(request: Request, kind: 'listing'|'teacher'|'video'|'review'|'report') {
  const user=await requireRole(request,['admin'])
  const v=z.object({ id, decision:z.enum(['approved','rejected','resolved','dismissed']), notes:z.string().max(3000).optional(), featured:z.boolean().optional() }).strict().parse(await body(request))
  const table={ listing:'centers',teacher:'teachers',video:'demo_videos',review:'reviews',report:'reports' }[kind]
  const field={ listing:'verification_status',teacher:'verification_status',video:'approval_status',review:'moderation_status',report:'status' }[kind]
  const allowed=kind==='report' ? ['resolved','dismissed'] : ['approved','rejected']
  if (!allowed.includes(v.decision)) throw new ApiError(422,'Invalid decision')
  return ok(await transaction(async client => {
    const item=(await client.query(`UPDATE ${table} SET ${field}=$2${kind==='listing' ? ',featured=COALESCE($3,featured)' : ''} WHERE id=$1 RETURNING *`,kind==='listing' ? [v.id,v.decision,v.featured ?? null] : [v.id,v.decision])).rows[0]
    if (!item) throw new ApiError(404,'Moderation item not found')
    await client.query('INSERT INTO admin_audit(admin_id,action,entity_id,notes) VALUES($1,$2,$3,$4)',[user.id,`${kind}_${v.decision}`,v.id,v.notes ?? null])
    return item
  }))
}

async function dispatch(request: Request, path: string[]) {
    const method=request.method, route=path.join('/')
    if (route==='health' && method==='GET') return ok({ status:'ok' })
    if (route==='auth/register' && method==='POST') return register(request)
    if (route==='auth/login' && method==='POST') return login(request)
    if (route==='auth/logout' && method==='POST') { await requireRole(request,['student','parent','owner','teacher','admin']); return logout() }
    if (route==='auth/me' && method==='GET') return me(request)
    if (route==='subjects' && method==='GET') return ok(await rows('SELECT * FROM subjects ORDER BY name,class_level'))
    if (route==='admin/subjects' && method==='POST') { await requireRole(request,['admin']); const v=z.object({ name:text.max(100),classLevel:z.string().max(20).optional(),board:z.string().max(50).optional(),examType:z.string().max(100).optional() }).strict().parse(await body(request)); return ok(await one('INSERT INTO subjects(name,class_level,board,exam_type) VALUES($1,$2,$3,$4) ON CONFLICT (name,class_level,board,exam_type) DO UPDATE SET name=EXCLUDED.name RETURNING *',[v.name,v.classLevel ?? null,v.board ?? null,v.examType ?? null]),201) }
    if (route==='search/centers' && method==='GET') return search(request)
    if (route==='centers' && method==='GET') return search(request)
    if (path[0]==='centers' && path.length===2 && method==='GET') return getCenter(uuid(path[1]))
    if (path[0]==='teachers' && path.length===2 && method==='GET') return getTeacher(uuid(path[1]))
    if (route==='demo-bookings' && method==='POST') return bookDemo(request)
    if (route==='demo-bookings' && method==='GET') { const u=await requireRole(request,['student','parent']); return ok(await rows('SELECT d.*,c.name AS center_name,b.batch_name FROM demo_bookings d JOIN centers c ON c.id=d.center_id JOIN batches b ON b.id=d.batch_id WHERE d.student_id=$1 ORDER BY d.booking_time DESC LIMIT 100',[u.id])) }
    if (path[0]==='demo-bookings' && path.length===2 && method==='PATCH') return updateBooking(request,uuid(path[1]))
    if (route==='reviews' && method==='POST') return review(request)
    if (route==='shortlists' && method==='POST') return shortlist(request)
    if (route==='shortlists' && method==='GET') { const u=await requireRole(request,['student','parent']); return ok(await rows('SELECT c.* FROM shortlists s JOIN centers c ON c.id=s.center_id WHERE s.student_id=$1 AND c.verification_status=\'approved\' AND c.listing_status=\'active\' ORDER BY s.created_at DESC',[u.id])) }
    if (path[0]==='shortlists' && path.length===2 && method==='DELETE') { const u=await requireRole(request,['student','parent']); await one('DELETE FROM shortlists WHERE student_id=$1 AND center_id=$2 RETURNING *',[u.id,uuid(path[1])]); return ok({ removed:true }) }
    if (route==='leads' && method==='POST') return inquiry(request)
    if (route==='reports' && method==='POST') return report(request)
    if (route==='owner/centers' && method==='GET') { const u=await requireRole(request,['owner']); return ok(await rows('SELECT * FROM centers WHERE owner_id=$1 ORDER BY created_at DESC',[u.id])) }
    if (route==='owner/centers' && method==='POST') return createCenter(request)
    if (path[0]==='owner' && path[1]==='centers' && path.length===3 && method==='PUT') return updateCenter(request,uuid(path[2]))
    if (route==='owner/teachers' && method==='POST') return createTeacher(request)
    if (route==='owner/batches' && method==='POST') return createBatch(request)
    if (path[0]==='owner' && path[1]==='batches' && path[3]==='vacancy' && path.length===4 && method==='PUT') return updateVacancy(request,uuid(path[2]))
    if (route==='owner/demo-videos' && method==='POST') return createVideo(request)
    if (route==='owner/leads' && method==='GET') return ownerLeads(request)
    if (path[0]==='owner' && path[1]==='leads' && path.length===3 && method==='PATCH') return updateLead(request,uuid(path[2]))
    if (route==='owner/demo-bookings' && method==='GET') return ownerBookings(request)
    if (route==='owner/analytics' && method==='GET') return ownerAnalytics(request)
    if (route==='admin/moderation' && method==='GET') return adminQueue(request)
    if (route==='admin/reports' && method==='GET') { await requireRole(request,['admin']); return ok(await rows('SELECT * FROM reports ORDER BY created_at DESC LIMIT 100')) }
    if (route==='admin/approve-listing' && method==='POST') return moderate(request,'listing')
    if (route==='admin/reject-listing' && method==='POST') return moderate(request,'listing')
    if (route==='admin/moderate-teacher' && method==='POST') return moderate(request,'teacher')
    if (route==='admin/approve-video' && method==='POST') return moderate(request,'video')
    if (route==='admin/moderate-review' && method==='POST') return moderate(request,'review')
    if (route==='admin/moderate-report' && method==='POST') return moderate(request,'report')
    throw new ApiError(404,'Endpoint not found')
}

export async function handle(request: Request, path: string[]) {
  try { return await dispatch(request,path) }
  catch(error) { return fail(error) }
}
