import { requireOwner } from '@/lib/server/auth'
import { body, ok, uuid } from '@/lib/server/http'
import * as centers from '@/services/owner/center.service'
import * as crm from '@/services/owner/crm.service'
import * as teaching from '@/services/owner/teaching.service'
import * as videos from '@/services/owner/video.service'
import { analyticsQuerySchema, batchCreateSchema, batchUpdateSchema, centerCreateSchema, centerUpdateSchema,
  leadListQuerySchema, leadUpdateSchema, ownerListQuerySchema, teacherCreateSchema, teacherUpdateSchema,
  vacancySchema, videoCreateSchema, videoUpdateSchema } from '@/validators/owner.validator'

function query(request: Request) {
  return Object.fromEntries(new URL(request.url).searchParams)
}

export async function listCenters(request: Request) {
  const owner = await requireOwner(request)
  const { limit, offset } = ownerListQuerySchema.omit({ centerId: true }).parse(query(request))
  return ok(await centers.listCenters(owner.id,limit,offset))
}

export async function getCenter(request: Request, centerId: string) {
  const owner = await requireOwner(request)
  return ok(await centers.getCenter(owner.id,uuid(centerId)))
}

export async function createCenter(request: Request) {
  const owner = await requireOwner(request)
  return ok(await centers.createCenter(owner.id,centerCreateSchema.parse(await body(request))),201)
}

export async function updateCenter(request: Request, centerId: string) {
  const owner = await requireOwner(request)
  return ok(await centers.updateCenter(owner.id,uuid(centerId),centerUpdateSchema.parse(await body(request))))
}

export async function listTeachers(request: Request) {
  const owner = await requireOwner(request)
  return ok(await teaching.listTeachers(owner.id,ownerListQuerySchema.parse(query(request))))
}

export async function getTeacher(request: Request, teacherId: string) {
  const owner = await requireOwner(request)
  return ok(await teaching.getTeacher(owner.id,uuid(teacherId)))
}

export async function createTeacher(request: Request) {
  const owner = await requireOwner(request)
  return ok(await teaching.createTeacher(owner.id,teacherCreateSchema.parse(await body(request))),201)
}

export async function updateTeacher(request: Request, teacherId: string) {
  const owner = await requireOwner(request)
  return ok(await teaching.updateTeacher(owner.id,uuid(teacherId),teacherUpdateSchema.parse(await body(request))))
}

export async function listBatches(request: Request) {
  const owner = await requireOwner(request)
  return ok(await teaching.listBatches(owner.id,ownerListQuerySchema.parse(query(request))))
}

export async function getBatch(request: Request, batchId: string) {
  const owner = await requireOwner(request)
  return ok(await teaching.getBatch(owner.id,uuid(batchId)))
}

export async function createBatch(request: Request) {
  const owner = await requireOwner(request)
  return ok(await teaching.createBatch(owner.id,batchCreateSchema.parse(await body(request))),201)
}

export async function updateBatch(request: Request, batchId: string) {
  const owner = await requireOwner(request)
  return ok(await teaching.updateBatch(owner.id,uuid(batchId),batchUpdateSchema.parse(await body(request))))
}

export async function updateVacancy(request: Request, batchId: string) {
  const owner = await requireOwner(request)
  const { filledSeats } = vacancySchema.parse(await body(request))
  return ok(await teaching.updateVacancy(owner.id,uuid(batchId),filledSeats))
}

export async function getBatchHistory(request: Request, batchId: string) {
  const owner = await requireOwner(request)
  return ok(await teaching.getBatchHistory(owner.id,uuid(batchId)))
}

export async function listVideos(request: Request) {
  const owner = await requireOwner(request)
  return ok(await videos.listVideos(owner.id,ownerListQuerySchema.parse(query(request))))
}

export async function getVideo(request: Request, videoId: string) {
  const owner = await requireOwner(request)
  return ok(await videos.getVideo(owner.id,uuid(videoId)))
}

export async function createVideo(request: Request) {
  const owner = await requireOwner(request)
  return ok(await videos.createVideo(owner.id,videoCreateSchema.parse(await body(request))),201)
}

export async function updateVideo(request: Request, videoId: string) {
  const owner = await requireOwner(request)
  return ok(await videos.updateVideo(owner.id,uuid(videoId),videoUpdateSchema.parse(await body(request))))
}

export async function listLeads(request: Request) {
  const owner = await requireOwner(request)
  return ok(await crm.listLeads(owner.id,leadListQuerySchema.parse(query(request))))
}

export async function getLead(request: Request, leadId: string) {
  const owner = await requireOwner(request)
  return ok(await crm.getLead(owner.id,uuid(leadId)))
}

export async function updateLead(request: Request, leadId: string) {
  const owner = await requireOwner(request)
  const { status } = leadUpdateSchema.parse(await body(request))
  return ok(await crm.updateLead(owner.id,uuid(leadId),status))
}

export async function listBookings(request: Request) {
  const owner = await requireOwner(request)
  return ok(await crm.listBookings(owner.id,ownerListQuerySchema.parse(query(request))))
}

export async function getBooking(request: Request, bookingId: string) {
  const owner = await requireOwner(request)
  return ok(await crm.getBooking(owner.id,uuid(bookingId)))
}

export async function getAnalytics(request: Request) {
  const owner = await requireOwner(request)
  const { centerId } = analyticsQuerySchema.parse(query(request))
  return ok(await crm.getAnalytics(owner.id,centerId))
}
