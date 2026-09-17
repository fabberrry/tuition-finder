import { one, rows, transaction } from '@/lib/server/db'
import { ApiError } from '@/lib/server/http'
import type { CenterCreateInput, CenterUpdateInput } from '@/validators/owner.validator'
import { requireOwnedCenter } from './ownership'

const editableColumns: Record<Exclude<keyof CenterUpdateInput, 'listingStatus'>, string> = {
  name: 'name', description: 'description', address: 'address', city: 'city', locality: 'locality',
  latitude: 'latitude', longitude: 'longitude', contactPhone: 'contact_phone',
  photos: 'photos', facilities: 'facilities',
}

export async function listCenters(ownerId: string, limit: number, offset: number) {
  return rows('SELECT * FROM centers WHERE owner_id=$1 ORDER BY created_at DESC,id LIMIT $2 OFFSET $3', [ownerId,limit,offset])
}

export async function getCenter(ownerId: string, centerId: string) {
  const center = await requireOwnedCenter(ownerId,centerId)
  const [teachers,batches,videos] = await Promise.all([
    rows('SELECT * FROM teachers WHERE center_id=$1 ORDER BY created_at DESC', [centerId]),
    rows(`SELECT b.*,b.capacity-b.filled_seats AS vacant_seats,s.name AS subject
      FROM batches b JOIN subjects s ON s.id=b.subject_id WHERE b.center_id=$1 ORDER BY b.created_at DESC`, [centerId]),
    rows('SELECT * FROM demo_videos WHERE center_id=$1 ORDER BY uploaded_at DESC', [centerId]),
  ])
  return { ...center,teachers,batches,videos }
}

export async function createCenter(ownerId: string, input: CenterCreateInput) {
  return one(`INSERT INTO centers(owner_id,name,description,address,city,locality,latitude,longitude,contact_phone,photos,facilities)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [ownerId,input.name,
    input.description ?? null,input.address,input.city,input.locality,input.latitude ?? null,
    input.longitude ?? null,input.contactPhone ?? null,input.photos,input.facilities])
}

export async function updateCenter(ownerId: string, centerId: string, input: CenterUpdateInput) {
  return transaction(async client => {
    const center = (await client.query('SELECT * FROM centers WHERE id=$1 AND owner_id=$2 FOR UPDATE', [centerId,ownerId])).rows[0]
    if (!center) throw new ApiError(404, 'Center not found')
    if (center.listing_status === 'suspended') throw new ApiError(409, 'Center is suspended by an admin')
    const latitude = input.latitude === undefined ? center.latitude : input.latitude
    const longitude = input.longitude === undefined ? center.longitude : input.longitude
    if ((latitude == null) !== (longitude == null)) throw new ApiError(422, 'Latitude and longitude must be set together')
    const content = Object.entries(input).filter(([key,value]) => key !== 'listingStatus' && value !== undefined)
    if (input.listingStatus === 'active' && (content.length || center.verification_status !== 'approved')) {
      throw new ApiError(409, 'Center must be approved before activation')
    }
    const values: unknown[] = [centerId]
    const assignments = content.map(([key,value]) => {
      values.push(value)
      return `${editableColumns[key as keyof typeof editableColumns]}=$${values.length}`
    })
    if (content.length) {
      assignments.push("verification_status='pending'", "listing_status='draft'")
    } else if (input.listingStatus) {
      values.push(input.listingStatus)
      assignments.push(`listing_status=$${values.length}`)
    }
    assignments.push('updated_at=now()')
    return (await client.query(`UPDATE centers SET ${assignments.join(',')} WHERE id=$1 RETURNING *`, values)).rows[0]
  })
}
