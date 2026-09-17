import { one } from './db'
import { ApiError } from './http'

export async function publicCenter(centerId: string) {
  const center = await one(`SELECT c.*, (SELECT ROUND(AVG(r.rating)::numeric,2) FROM reviews r WHERE r.center_id=c.id AND r.moderation_status='approved') AS average_rating,
    (SELECT COUNT(*)::int FROM reviews r WHERE r.center_id=c.id AND r.moderation_status='approved') AS total_reviews
    FROM centers c WHERE c.id=$1 AND c.verification_status='approved' AND c.listing_status='active'`, [centerId])
  if (!center) throw new ApiError(404, 'Center not found')
  return center
}

export async function publicBatch(centerId: string, batchId: string) {
  const batch = await one(`SELECT b.* FROM batches b JOIN centers c ON c.id=b.center_id
    JOIN teachers t ON t.id=b.teacher_id AND t.center_id=b.center_id WHERE b.id=$1 AND b.center_id=$2 AND b.status='active'
    AND t.verification_status='approved' AND c.verification_status='approved' AND c.listing_status='active'`, [batchId,centerId])
  if (!batch) throw new ApiError(404, 'Batch not found')
  return batch
}
