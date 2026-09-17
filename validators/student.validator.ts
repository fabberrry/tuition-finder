import { z } from 'zod'

const id = z.uuid()
const phone = z.string().trim().regex(/^\+?[0-9][0-9\s-]{6,19}$/, 'Invalid contact phone')
const rating = z.number().int().min(1).max(5)

export const profileSchema = z.object({
  classLevel: z.string().trim().max(20).nullable().optional(),
  board: z.string().trim().max(50).nullable().optional(),
  examGoal: z.string().trim().max(100).nullable().optional(),
  preferredBudgetMin: z.number().int().min(0).nullable().optional(),
  preferredBudgetMax: z.number().int().min(0).nullable().optional(),
  preferredMode: z.enum(['online', 'offline', 'hybrid']).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'At least one field is required')

export const bookingSchema = z.object({
  centerId: id,
  batchId: id,
  bookingTime: z.iso.datetime({ offset: true }),
  contactPhone: phone.optional(),
}).strict()

export const bookingUpdateSchema = z.object({
  status: z.enum(['booked', 'cancelled', 'attended', 'no_show']),
  bookingTime: z.iso.datetime({ offset: true }).optional(),
}).strict()

export const inquirySchema = z.object({
  centerId: id,
  batchId: id.optional(),
  message: z.string().trim().min(1).max(2000),
}).strict()

export const reviewSchema = z.object({
  bookingId: id,
  teacherId: id.optional(),
  rating,
  reviewText: z.string().trim().min(1).max(3000),
  teachingClarityRating: rating.optional(),
  doubtSolvingRating: rating.optional(),
  environmentRating: rating.optional(),
  valueForMoneyRating: rating.optional(),
}).strict()

export const shortlistSchema = z.object({ centerId: id }).strict()

export const reportSchema = z.object({
  centerId: id,
  issueType: z.enum(['vacancy_mismatch', 'duplicate_listing', 'misleading_content', 'other']),
  details: z.string().trim().min(1).max(3000),
}).strict()

export type ProfileInput = z.infer<typeof profileSchema>
export type BookingInput = z.infer<typeof bookingSchema>
export type BookingUpdateInput = z.infer<typeof bookingUpdateSchema>
export type InquiryInput = z.infer<typeof inquirySchema>
export type ReviewInput = z.infer<typeof reviewSchema>
export type ShortlistInput = z.infer<typeof shortlistSchema>
export type ReportInput = z.infer<typeof reportSchema>
