import { ok, uuid } from '@/lib/server/http'
import * as discovery from '@/services/discovery.service'
import { reviewsQuerySchema, searchSchema } from '@/validators/discovery.validator'

export async function searchCenters(request: Request) {
  const query = searchSchema.parse(Object.fromEntries(new URL(request.url).searchParams))
  return ok(await discovery.searchCenters(query))
}

export async function getCenter(centerId: string) {
  return ok(await discovery.getCenterProfile(uuid(centerId)))
}

export async function getTeacher(teacherId: string) {
  return ok(await discovery.getTeacherProfile(uuid(teacherId)))
}

export async function getVideo(videoId: string) {
  return ok(await discovery.getApprovedVideo(uuid(videoId)))
}

export async function listReviews(request: Request) {
  const query = reviewsQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams))
  return ok(await discovery.listApprovedReviews(query))
}
