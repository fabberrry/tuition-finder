import { z } from 'zod'
import * as discoveryController from '@/controllers/discovery.controller'
import * as ownerController from '@/controllers/owner.controller'
import * as studentController from '@/controllers/student.controller'
import { login, logout, me, register, requireRole } from './auth'
import { one, rows, transaction } from './db'
import { ApiError, body, fail, ok } from './http'

const id = z.uuid()
const text = z.string().trim().min(1)
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
    if (route==='owner/centers' && method==='GET') return ownerController.listCenters(request)
    if (route==='owner/centers' && method==='POST') return ownerController.createCenter(request)
    if (path[0]==='owner' && path[1]==='centers' && path.length===3 && method==='GET') return ownerController.getCenter(request,path[2])
    if (path[0]==='owner' && path[1]==='centers' && path.length===3 && method==='PUT') return ownerController.updateCenter(request,path[2])
    if (route==='owner/teachers' && method==='GET') return ownerController.listTeachers(request)
    if (route==='owner/teachers' && method==='POST') return ownerController.createTeacher(request)
    if (path[0]==='owner' && path[1]==='teachers' && path.length===3 && method==='GET') return ownerController.getTeacher(request,path[2])
    if (path[0]==='owner' && path[1]==='teachers' && path.length===3 && method==='PUT') return ownerController.updateTeacher(request,path[2])
    if (route==='owner/batches' && method==='GET') return ownerController.listBatches(request)
    if (route==='owner/batches' && method==='POST') return ownerController.createBatch(request)
    if (path[0]==='owner' && path[1]==='batches' && path.length===4 && path[3]==='vacancy' && method==='PUT') return ownerController.updateVacancy(request,path[2])
    if (path[0]==='owner' && path[1]==='batches' && path.length===4 && path[3]==='history' && method==='GET') return ownerController.getBatchHistory(request,path[2])
    if (path[0]==='owner' && path[1]==='batches' && path.length===3 && method==='GET') return ownerController.getBatch(request,path[2])
    if (path[0]==='owner' && path[1]==='batches' && path.length===3 && method==='PUT') return ownerController.updateBatch(request,path[2])
    if (route==='owner/demo-videos' && method==='GET') return ownerController.listVideos(request)
    if (route==='owner/demo-videos' && method==='POST') return ownerController.createVideo(request)
    if (path[0]==='owner' && path[1]==='demo-videos' && path.length===3 && method==='GET') return ownerController.getVideo(request,path[2])
    if (path[0]==='owner' && path[1]==='demo-videos' && path.length===3 && method==='PUT') return ownerController.updateVideo(request,path[2])
    if (route==='owner/leads' && method==='GET') return ownerController.listLeads(request)
    if (path[0]==='owner' && path[1]==='leads' && path.length===3 && method==='GET') return ownerController.getLead(request,path[2])
    if (path[0]==='owner' && path[1]==='leads' && path.length===3 && method==='PATCH') return ownerController.updateLead(request,path[2])
    if (route==='owner/demo-bookings' && method==='GET') return ownerController.listBookings(request)
    if (path[0]==='owner' && path[1]==='demo-bookings' && path.length===3 && method==='GET') return ownerController.getBooking(request,path[2])
    if (route==='owner/analytics' && method==='GET') return ownerController.getAnalytics(request)
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
