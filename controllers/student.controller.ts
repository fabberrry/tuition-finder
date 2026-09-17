import { requireRole, requireStudentActor } from '@/lib/server/auth'
import { body, ok, uuid } from '@/lib/server/http'
import * as students from '@/services/student.service'
import { bookingSchema, bookingUpdateSchema, inquirySchema, profileSchema, reportSchema, reviewSchema, shortlistSchema } from '@/validators/student.validator'
import { z } from 'zod'

function page(request: Request) {
  return z.object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  }).parse(Object.fromEntries(new URL(request.url).searchParams))
}

export async function getProfile(request: Request) {
  const user = await requireRole(request, ['student'])
  return ok(await students.getStudentProfile(user.id))
}

export async function putProfile(request: Request) {
  const user = await requireRole(request, ['student'])
  return ok(await students.saveStudentProfile(user.id, profileSchema.parse(await body(request))))
}

export async function bookDemo(request: Request) {
  const user = await requireStudentActor(request)
  return ok(await students.createDemoBooking(user, bookingSchema.parse(await body(request))), 201)
}

export async function listBookings(request: Request) {
  const user = await requireStudentActor(request)
  const { limit, offset } = page(request)
  return ok(await students.listDemoBookings(user.id,limit,offset))
}

export async function getBooking(request: Request, bookingId: string) {
  const user = await requireStudentActor(request)
  return ok(await students.getDemoBooking(user.id,uuid(bookingId)))
}

export async function updateBooking(request: Request, bookingId: string) {
  const user = await requireRole(request, ['student','parent','owner'])
  return ok(await students.changeDemoBooking(user,uuid(bookingId),bookingUpdateSchema.parse(await body(request))))
}

export async function sendInquiry(request: Request) {
  const user = await requireStudentActor(request)
  return ok(await students.createInquiry(user.id,inquirySchema.parse(await body(request))),201)
}

export async function listInquiries(request: Request) {
  const user = await requireStudentActor(request)
  const { limit, offset } = page(request)
  return ok(await students.listInquiries(user.id,limit,offset))
}

export async function getInquiry(request: Request, leadId: string) {
  const user = await requireStudentActor(request)
  return ok(await students.getInquiry(user.id,uuid(leadId)))
}

export async function submitReview(request: Request) {
  const user = await requireStudentActor(request)
  return ok(await students.createVerifiedReview(user.id,reviewSchema.parse(await body(request))),201)
}

export async function listMyReviews(request: Request) {
  const user = await requireStudentActor(request)
  const { limit, offset } = page(request)
  return ok(await students.listMyReviews(user.id,limit,offset))
}

export async function addShortlist(request: Request) {
  const user = await requireStudentActor(request)
  const { centerId } = shortlistSchema.parse(await body(request))
  const saved = await students.saveShortlist(user.id,centerId)
  return ok(saved,saved.created ? 201 : 200)
}

export async function listShortlists(request: Request) {
  const user = await requireStudentActor(request)
  const { limit, offset } = page(request)
  return ok(await students.listShortlists(user.id,limit,offset))
}

export async function deleteShortlist(request: Request, centerId: string) {
  const user = await requireStudentActor(request)
  return ok(await students.removeShortlist(user.id,uuid(centerId)))
}

export async function sendReport(request: Request) {
  const user = await requireRole(request, ['student','parent','owner','teacher'])
  return ok(await students.createReport(user.id,reportSchema.parse(await body(request))),201)
}

export async function listReports(request: Request) {
  const user = await requireRole(request, ['student','parent','owner','teacher'])
  const { limit, offset } = page(request)
  return ok(await students.listMyReports(user.id,limit,offset))
}
