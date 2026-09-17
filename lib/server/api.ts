import * as adminController from '@/controllers/admin.controller'
import * as discoveryController from '@/controllers/discovery.controller'
import * as ownerController from '@/controllers/owner.controller'
import * as studentController from '@/controllers/student.controller'
import { login, logout, me, register, requireRole } from './auth'
import { rows } from './db'
import { ApiError, fail, ok } from './http'

async function dispatch(request: Request, path: string[]) {
    const method=request.method, route=path.join('/')
    if (route==='health' && method==='GET') return ok({ status:'ok' })
    if (route==='auth/register' && method==='POST') return register(request)
    if (route==='auth/login' && method==='POST') return login(request)
    if (route==='auth/logout' && method==='POST') { await requireRole(request,['student','parent','owner','teacher','admin']); return logout() }
    if (route==='auth/me' && method==='GET') return me(request)
    if (route==='subjects' && method==='GET') return ok(await rows('SELECT * FROM subjects ORDER BY name,class_level'))
    if (route==='admin/subjects' && method==='POST') return adminController.subject(request)
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
    if (route==='admin/moderation' && method==='GET') return adminController.queue(request)
    if (route==='admin/duplicates' && method==='GET') return adminController.duplicates(request)
    if (route==='admin/reports' && method==='GET') return adminController.reports(request)
    if (route==='admin/audit' && method==='GET') return adminController.audit(request)
    if (route==='admin/approve-listing' && method==='POST') return adminController.moderate(request,'listing','approved')
    if (route==='admin/reject-listing' && method==='POST') return adminController.moderate(request,'listing','rejected')
    if (route==='admin/moderate-teacher' && method==='POST') return adminController.moderate(request,'teacher')
    if (route==='admin/approve-video' && method==='POST') return adminController.moderate(request,'video')
    if (route==='admin/moderate-review' && method==='POST') return adminController.moderate(request,'review')
    if (route==='admin/moderate-report' && method==='POST') return adminController.moderateReport(request)
    if (path[0]==='admin' && path[1]==='centers' && path.length===4 && path[3]==='featured' && method==='PUT') return adminController.featured(request,path[2])
    if (path[0]==='admin' && path[1]==='centers' && path.length===4 && path[3]==='status' && method==='PUT') return adminController.listingStatus(request,path[2])
    if (path[0]==='admin' && path[1]==='users' && path.length===4 && path[3]==='status' && method==='PUT') return adminController.userStatus(request,path[2])
    throw new ApiError(404,'Endpoint not found')
}

export async function handle(request: Request, path: string[]) {
  try { return await dispatch(request,path) }
  catch(error) { return fail(error) }
}
