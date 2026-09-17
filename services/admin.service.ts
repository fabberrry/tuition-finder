import type { PoolClient } from 'pg'
import { one, rows, transaction } from '@/lib/server/db'
import { ApiError } from '@/lib/server/http'
import type { ModerationInput, ReportDecisionInput } from '@/validators/admin.validator'

type Kind = 'listing' | 'teacher' | 'video' | 'review'
const targets: Record<Kind, { table: string; field: string }> = {
  listing: { table: 'centers', field: 'verification_status' },
  teacher: { table: 'teachers', field: 'verification_status' },
  video: { table: 'demo_videos', field: 'approval_status' },
  review: { table: 'reviews', field: 'moderation_status' },
}

async function audit(client: PoolClient, adminId: string, action: string, entityId: string, notes?: string) {
  await client.query('INSERT INTO admin_audit(admin_id,action,entity_id,notes) VALUES($1,$2,$3,$4)', [adminId,action,entityId,notes ?? null])
}

export async function queue() {
  const [centers, teachers, videos, reviews, reports, duplicates] = await Promise.all([
    rows("SELECT * FROM centers WHERE verification_status='pending' ORDER BY created_at LIMIT 100"),
    rows("SELECT * FROM teachers WHERE verification_status='pending' ORDER BY created_at LIMIT 100"),
    rows("SELECT * FROM demo_videos WHERE approval_status='pending' ORDER BY uploaded_at LIMIT 100"),
    rows("SELECT * FROM reviews WHERE moderation_status='pending' ORDER BY created_at LIMIT 100"),
    rows("SELECT * FROM reports WHERE status='pending' ORDER BY created_at LIMIT 100"),
    duplicateCandidates(50,0),
  ])
  return { centers, teachers, videos, reviews, reports, duplicates }
}

export function duplicateCandidates(limit: number, offset: number) {
  return rows(`SELECT a.id AS center_id,b.id AS matching_center_id,a.name AS center_name,b.name AS matching_name,
      CASE WHEN a.contact_phone IS NOT NULL AND a.contact_phone=b.contact_phone THEN 'phone' ELSE 'address' END AS reason
    FROM centers a JOIN centers b ON a.id < b.id AND a.city=b.city AND (
      (a.contact_phone IS NOT NULL AND a.contact_phone=b.contact_phone) OR
      (lower(trim(a.address))=lower(trim(b.address)) AND lower(trim(a.name))=lower(trim(b.name)))
    ) ORDER BY a.created_at DESC,a.id,b.id LIMIT $1 OFFSET $2`, [limit,offset])
}

export async function moderate(adminId: string, kind: Kind, input: ModerationInput) {
  if (kind !== 'listing' && input.featured !== undefined) throw new ApiError(422, 'Featured only applies to listings')
  return transaction(async client => {
    const { table, field } = targets[kind]
    const item = (await client.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`, [input.id])).rows[0]
    if (!item) throw new ApiError(404, 'Moderation item not found')
    if (item[field] !== 'pending') throw new ApiError(409, 'Item is no longer pending moderation')
    if (input.decision === 'approved') {
      if (kind === 'teacher' || kind === 'video') {
        const centerId = item.center_id
        const center = (await client.query('SELECT verification_status FROM centers WHERE id=$1', [centerId])).rows[0]
        if (center?.verification_status !== 'approved') throw new ApiError(409, 'Approve the center first')
      }
      if (kind === 'video') {
        const teacher = (await client.query('SELECT center_id,verification_status,active FROM teachers WHERE id=$1', [item.teacher_id])).rows[0]
        if (!teacher || teacher.center_id !== item.center_id || teacher.verification_status !== 'approved' || !teacher.active) {
          throw new ApiError(409, 'Approve an active teacher first')
        }
      }
      if (kind === 'review') {
        const booking = (await client.query('SELECT student_id,center_id,teacher_id,status FROM demo_bookings WHERE id=$1', [item.booking_id])).rows[0]
        if (!booking || booking.status !== 'attended' || booking.student_id !== item.student_id ||
            booking.center_id !== item.center_id || (item.teacher_id && item.teacher_id !== booking.teacher_id)) {
          throw new ApiError(409, 'Review has no matching attended booking')
        }
      }
    }
    if (kind === 'listing' && input.featured && input.decision !== 'approved') throw new ApiError(422, 'Only approved listings can be featured')
    const result = (await client.query(`UPDATE ${table} SET ${field}=$2${kind === 'listing' ? ',featured=$3' : ''} WHERE id=$1 RETURNING *`,
      kind === 'listing' ? [input.id,input.decision,input.decision === 'approved' && (input.featured ?? false)] : [input.id,input.decision])).rows[0]
    await audit(client,adminId,`${kind}_${input.decision}`,input.id,input.notes)
    return result
  })
}

export async function moderateReport(adminId: string, input: ReportDecisionInput) {
  return transaction(async client => {
    const item = (await client.query('UPDATE reports SET status=$2 WHERE id=$1 AND status=\'pending\' RETURNING *', [input.id,input.decision])).rows[0]
    if (!item) {
      const existing = (await client.query('SELECT id FROM reports WHERE id=$1', [input.id])).rows[0]
      throw new ApiError(existing ? 409 : 404, existing ? 'Report is no longer pending' : 'Report not found')
    }
    await audit(client,adminId,`report_${input.decision}`,input.id,input.notes)
    return item
  })
}

export function listReports(limit: number, offset: number, status?: string) {
  return rows('SELECT * FROM reports WHERE ($3::text IS NULL OR status=$3) ORDER BY created_at DESC,id LIMIT $1 OFFSET $2', [limit,offset,status ?? null])
}

export function listAudit(limit: number, offset: number) {
  return rows('SELECT * FROM admin_audit ORDER BY created_at DESC,id LIMIT $1 OFFSET $2', [limit,offset])
}

export async function createSubject(input: { name: string; classLevel?: string; board?: string; examType?: string }) {
  return one(`INSERT INTO subjects(name,class_level,board,exam_type) VALUES($1,$2,$3,$4)
    ON CONFLICT (name,class_level,board,exam_type) DO UPDATE SET name=EXCLUDED.name RETURNING *`,
    [input.name,input.classLevel ?? null,input.board ?? null,input.examType ?? null])
}

export async function setFeatured(adminId: string, centerId: string, featured: boolean, notes?: string) {
  return transaction(async client => {
    const center = (await client.query('SELECT * FROM centers WHERE id=$1 FOR UPDATE', [centerId])).rows[0]
    if (!center) throw new ApiError(404, 'Center not found')
    if (featured && (center.verification_status !== 'approved' || center.listing_status !== 'active')) {
      throw new ApiError(409, 'Only active approved listings can be featured')
    }
    const result = (await client.query('UPDATE centers SET featured=$2,updated_at=now() WHERE id=$1 RETURNING *', [centerId,featured])).rows[0]
    await audit(client,adminId,featured ? 'listing_featured' : 'listing_unfeatured',centerId,notes)
    return result
  })
}

export async function setListingStatus(adminId: string, centerId: string, status: 'suspended' | 'draft', notes: string) {
  return transaction(async client => {
    const center = (await client.query('SELECT * FROM centers WHERE id=$1 FOR UPDATE', [centerId])).rows[0]
    if (!center) throw new ApiError(404, 'Center not found')
    if (status === 'draft' && center.listing_status !== 'suspended') throw new ApiError(409, 'Listing is not suspended')
    if (status === center.listing_status) throw new ApiError(409, 'Listing already has this status')
    const result = (await client.query('UPDATE centers SET listing_status=$2,featured=false,updated_at=now() WHERE id=$1 RETURNING *', [centerId,status])).rows[0]
    await audit(client,adminId,status === 'suspended' ? 'listing_suspended' : 'listing_restored',centerId,notes)
    return result
  })
}

export async function setUserStatus(adminId: string, userId: string, status: 'active' | 'suspended', notes: string) {
  if (adminId === userId) throw new ApiError(409, 'Cannot change your own status')
  return transaction(async client => {
    const user = (await client.query('SELECT id,role,status FROM users WHERE id=$1 FOR UPDATE', [userId])).rows[0]
    if (!user) throw new ApiError(404, 'User not found')
    if (user.role === 'admin') throw new ApiError(403, 'Admin accounts cannot be changed here')
    if (user.status === status) throw new ApiError(409, 'User already has this status')
    const result = (await client.query('UPDATE users SET status=$2 WHERE id=$1 RETURNING id,full_name,email,phone,role,status', [userId,status])).rows[0]
    await audit(client,adminId,`user_${status}`,userId,notes)
    return result
  })
}
