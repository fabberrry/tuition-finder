import { z } from 'zod'

const id = z.uuid()
const notes = z.string().trim().min(1).max(3000)
const decision = z.enum(['approved', 'rejected'])

export const subjectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  classLevel: z.string().trim().max(20).optional(),
  board: z.string().trim().max(50).optional(),
  examType: z.string().trim().max(100).optional(),
}).strict()

export const moderationSchema = z.object({ id, decision, notes: notes.optional(), featured: z.boolean().optional() }).strict()
export const reportDecisionSchema = z.object({ id, decision: z.enum(['resolved', 'dismissed']), notes: notes.optional() }).strict()
export const featureSchema = z.object({ featured: z.boolean(), notes: notes.optional() }).strict()
export const listingStatusSchema = z.object({ status: z.enum(['suspended', 'draft']), notes }).strict()
export const userStatusSchema = z.object({ status: z.enum(['active', 'suspended']), notes }).strict()
export const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
}).strict()
export const reportListSchema = listSchema.extend({ status: z.enum(['pending', 'resolved', 'dismissed']).optional() }).strict()

export type ModerationInput = z.infer<typeof moderationSchema>
export type ReportDecisionInput = z.infer<typeof reportDecisionSchema>
