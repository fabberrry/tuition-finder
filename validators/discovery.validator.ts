import { z } from 'zod'

const pagination = {
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
}

export const searchSchema = z.object({
  city: z.string().trim().max(100).optional(),
  locality: z.string().trim().max(100).optional(),
  subject: z.string().trim().max(100).optional(),
  classLevel: z.string().trim().max(20).optional(),
  board: z.string().trim().max(50).optional(),
  exam: z.string().trim().max(100).optional(),
  mode: z.enum(['online','offline','hybrid']).optional(),
  timing: z.enum(['morning','afternoon','evening']).optional(),
  vacancy: z.enum(['true','false']).optional(),
  minFee: z.coerce.number().int().min(0).optional(),
  maxFee: z.coerce.number().int().min(0).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(100).optional(),
  ...pagination,
}).strict()

export const reviewsQuerySchema = z.object({
  centerId: z.uuid().optional(),
  teacherId: z.uuid().optional(),
  ...pagination,
}).strict().refine(value => Boolean(value.centerId) !== Boolean(value.teacherId), 'Provide either centerId or teacherId')

export type SearchInput = z.infer<typeof searchSchema>
export type ReviewsQuery = z.infer<typeof reviewsQuerySchema>
