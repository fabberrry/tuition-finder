import { z } from 'zod'
import * as discoveryController from '@/controllers/discovery.controller'
import * as studentController from '@/controllers/student.controller'
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

async function ownerLeads(request: Request) {
  const user=await requireRole(request,['owner'])
  return ok(await rows('SELECT l.*,u.full_name AS student_name,u.email AS student_email,u.phone AS student_phone,c.name AS center_name FROM leads l JOIN centers c ON c.id=l.center_id JOIN users u ON u.id=l.student_id WHERE c.owner_id=$1 ORDER BY l.created_at DESC LIMIT 100',[user.id]))
}
async function ownerBookings(request: Request) {
  const user=await requireRole(request,['owner'])
  return ok(await rows('SELECT d.*,u.full_name AS student_name,u.email AS student_email,COALESCE(d.contact_phone,u.phone) AS student_phone FROM demo_bookings d JOIN centers c ON c.id=d.center_id JOIN users u ON u.id=d.student_id WHERE c.owner_id=$1 ORDER BY d.booking_time DESC LIMIT 100',[user.id]))
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
    if (route==='search/centers' && method==='GET') return discoveryController.searchCenters(request)
    if (route==='centers' && method==='GET') return discoveryController.searchCenters(request)
    if (path[0]==='centers' && path.length===2 && method==='GET') return discoveryController.getCenter(path[1])
    if (path[0]==='teachers' && path.length===2 && method==='GET') return discoveryController.getTeacher(path[1])
    if (path[0]==='demo-videos' && path.length===2 && method==='GET') return discoveryController.getVideo(path[1])
    if (route==='reviews' && method==='GET') return discoveryController.listReviews(request)
    if (route==='student/profile' && method==='GET') return studentController.getProfile(request)
    if (route==='student/profile' && method==='PUT') return studentController.putProfile(request)
    if (route==='demo-bookings' && method==='POST') return studentController.bookDemo(request)
    if (route==='demo-bookings' && method==='GET') return studentController.listBookings(request)
    if (path[0]==='demo-bookings' && path.length===2 && method==='GET') return studentController.getBooking(request,path[1])
    if (path[0]==='demo-bookings' && path.length===2 && method==='PATCH') return studentController.updateBooking(request,path[1])
    if (route==='reviews' && method==='POST') return studentController.submitReview(request)
    if (route==='reviews/me' && method==='GET') return studentController.listMyReviews(request)
    if (route==='shortlists' && method==='POST') return studentController.addShortlist(request)
    if (route==='shortlists' && method==='GET') return studentController.listShortlists(request)
    if (path[0]==='shortlists' && path.length===2 && method==='DELETE') return studentController.deleteShortlist(request,path[1])
    if (route==='leads' && method==='POST') return studentController.sendInquiry(request)
    if (route==='leads' && method==='GET') return studentController.listInquiries(request)
    if (path[0]==='leads' && path.length===2 && method==='GET') return studentController.getInquiry(request,path[1])
    if (route==='reports' && method==='POST') return studentController.sendReport(request)
    if (route==='reports' && method==='GET') return studentController.listReports(request)
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
