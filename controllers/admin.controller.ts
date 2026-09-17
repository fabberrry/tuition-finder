import { requireAdmin } from '@/lib/server/auth'
import { body, ok, uuid, ApiError } from '@/lib/server/http'
import * as admin from '@/services/admin.service'
import { featureSchema, listSchema, listingStatusSchema, moderationSchema, reportDecisionSchema,
  reportListSchema, subjectSchema, userStatusSchema } from '@/validators/admin.validator'

function query(request: Request) { return Object.fromEntries(new URL(request.url).searchParams) }

export async function queue(request: Request) {
  await requireAdmin(request)
  return ok(await admin.queue())
}

export async function duplicates(request: Request) {
  await requireAdmin(request)
  const { limit, offset } = listSchema.parse(query(request))
  return ok(await admin.duplicateCandidates(limit,offset))
}

export async function reports(request: Request) {
  await requireAdmin(request)
  const { limit, offset, status } = reportListSchema.parse(query(request))
  return ok(await admin.listReports(limit,offset,status))
}

export async function audit(request: Request) {
  await requireAdmin(request)
  const { limit, offset } = listSchema.parse(query(request))
  return ok(await admin.listAudit(limit,offset))
}

export async function subject(request: Request) {
  await requireAdmin(request)
  return ok(await admin.createSubject(subjectSchema.parse(await body(request))),201)
}

export async function moderate(request: Request, kind: 'listing' | 'teacher' | 'video' | 'review', fixedDecision?: 'approved' | 'rejected') {
  const actor = await requireAdmin(request)
  const input = moderationSchema.parse(await body(request))
  if (fixedDecision && input.decision !== fixedDecision) throw new ApiError(422, `Decision must be ${fixedDecision}`)
  return ok(await admin.moderate(actor.id,kind,input))
}

export async function moderateReport(request: Request) {
  const actor = await requireAdmin(request)
  return ok(await admin.moderateReport(actor.id,reportDecisionSchema.parse(await body(request))))
}

export async function featured(request: Request, centerId: string) {
  const actor = await requireAdmin(request)
  const input = featureSchema.parse(await body(request))
  return ok(await admin.setFeatured(actor.id,uuid(centerId),input.featured,input.notes))
}

export async function listingStatus(request: Request, centerId: string) {
  const actor = await requireAdmin(request)
  const input = listingStatusSchema.parse(await body(request))
  return ok(await admin.setListingStatus(actor.id,uuid(centerId),input.status,input.notes))
}

export async function userStatus(request: Request, userId: string) {
  const actor = await requireAdmin(request)
  const input = userStatusSchema.parse(await body(request))
  return ok(await admin.setUserStatus(actor.id,uuid(userId),input.status,input.notes))
}
