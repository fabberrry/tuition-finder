import { one } from '@/lib/server/db'
import { ApiError } from '@/lib/server/http'

export async function requireOwnedCenter(ownerId: string, centerId: string) {
  const center = await one('SELECT * FROM centers WHERE id=$1 AND owner_id=$2', [centerId,ownerId])
  if (!center) throw new ApiError(404, 'Center not found')
  return center
}
