import { z } from 'zod'

const id = z.uuid()
const text = z.string().trim().min(1)
const url = z.url().refine(value => ['https:', 'http:'].includes(new URL(value).protocol))
const nonemptyUpdate = <T extends Record<string, unknown>>(value: T) => Object.keys(value).length > 0

const centerFields = z.object({
  name: text.max(255),
  description: z.string().trim().max(5000).nullable().optional(),
  address: text.max(1000), city: text.max(100), locality: text.max(100),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  contactPhone: z.string().trim().max(20).nullable().optional(),
  photos: z.array(url).max(20).default([]),
  facilities: z.array(z.string().trim().max(100)).max(30).default([]),
})
export const centerCreateSchema = centerFields.strict()
  .refine(value => (value.latitude == null) === (value.longitude == null), 'Latitude and longitude must be set together')
export const centerUpdateSchema = centerFields.partial().extend({
  photos: z.array(url).max(20).optional(),
  facilities: z.array(z.string().trim().max(100)).max(30).optional(),
  listingStatus: z.enum(['draft', 'active', 'paused']).optional(),
}).strict().refine(nonemptyUpdate, 'At least one field is required')

export const teacherCreateSchema = z.object({
  centerId: id, name: text.max(150), qualification: z.string().trim().max(255).nullable().optional(),
  experienceYears: z.number().int().min(0).max(80).nullable().optional(),
  bio: z.string().trim().max(5000).nullable().optional(),
  subjectIds: z.array(id).max(30).default([]),
}).strict()
export const teacherUpdateSchema = teacherCreateSchema.omit({ centerId: true }).partial().extend({
  subjectIds: z.array(id).max(30).optional(),
  active: z.boolean().optional(),
}).strict().refine(nonemptyUpdate, 'At least one field is required')

const batchFields = z.object({
  teacherId: id, subjectId: id, batchName: text.max(150),
  classLevel: z.string().trim().max(20).nullable().optional(),
  board: z.string().trim().max(50).nullable().optional(),
  examType: z.string().trim().max(100).nullable().optional(),
  startTime: z.iso.time(), endTime: z.iso.time(),
  daysOfWeek: z.array(z.enum(['mon','tue','wed','thu','fri','sat','sun'])).min(1),
  mode: z.enum(['online','offline','hybrid']),
  capacity: z.number().int().positive(),
  filledSeats: z.number().int().min(0).default(0),
  monthlyFee: z.number().int().min(0).nullable().optional(),
})
export const batchCreateSchema = batchFields.extend({ centerId: id }).strict()
  .refine(value => value.filledSeats <= value.capacity && value.startTime < value.endTime, 'Invalid capacity or time range')
export const batchUpdateSchema = batchFields.omit({ filledSeats: true }).partial().extend({
  status: z.enum(['active','paused']).optional(),
}).strict().refine(nonemptyUpdate, 'At least one field is required')
export const vacancySchema = z.object({ filledSeats: z.number().int().min(0) }).strict()

export const videoCreateSchema = z.object({
  centerId: id, teacherId: id, subjectId: id, title: text.max(255),
  topic: z.string().trim().max(255).nullable().optional(), videoUrl: url,
  durationSeconds: z.number().int().positive().nullable().optional(),
  language: z.string().trim().max(50).nullable().optional(),
}).strict()
export const videoUpdateSchema = videoCreateSchema.omit({ centerId: true }).partial().strict()
  .refine(nonemptyUpdate, 'At least one field is required')

export const leadUpdateSchema = z.object({
  status: z.enum(['new','contacted','demo_scheduled','converted','closed']),
}).strict()

export const ownerListQuerySchema = z.object({
  centerId: id.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
}).strict()
export const leadListQuerySchema = ownerListQuerySchema.extend({
  status: leadUpdateSchema.shape.status.optional(),
}).strict()
export const analyticsQuerySchema = z.object({ centerId: id.optional() }).strict()

export type CenterCreateInput = z.infer<typeof centerCreateSchema>
export type CenterUpdateInput = z.infer<typeof centerUpdateSchema>
export type TeacherCreateInput = z.infer<typeof teacherCreateSchema>
export type TeacherUpdateInput = z.infer<typeof teacherUpdateSchema>
export type BatchCreateInput = z.infer<typeof batchCreateSchema>
export type BatchUpdateInput = z.infer<typeof batchUpdateSchema>
export type VideoCreateInput = z.infer<typeof videoCreateSchema>
export type VideoUpdateInput = z.infer<typeof videoUpdateSchema>
export type OwnerListQuery = z.infer<typeof ownerListQuerySchema>
export type LeadListQuery = z.infer<typeof leadListQuerySchema>
