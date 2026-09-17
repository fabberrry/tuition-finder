import { one, rows, transaction } from '@/lib/server/db'
import { ApiError } from '@/lib/server/http'
import type { OwnerListQuery, VideoCreateInput, VideoUpdateInput } from '@/validators/owner.validator'
import { requireOwnedCenter } from './ownership'

async function requireVideoTeacherSubject(client: import('pg').PoolClient, centerId: string, teacherId: string, subjectId: string) {
  const result = await client.query(`SELECT 1 FROM teachers t JOIN teacher_subjects ts ON ts.teacher_id=t.id
    WHERE t.id=$1 AND t.center_id=$2 AND t.active=true AND ts.subject_id=$3`, [teacherId,centerId,subjectId])
  if (!result.rowCount) throw new ApiError(422,'Active teacher must belong to center and teach this subject')
}

export async function listVideos(ownerId: string, query: OwnerListQuery) {
  if (query.centerId) await requireOwnedCenter(ownerId,query.centerId)
  return rows(`SELECT v.*,t.name AS teacher_name,s.name AS subject FROM demo_videos v
    JOIN centers c ON c.id=v.center_id JOIN teachers t ON t.id=v.teacher_id
    JOIN subjects s ON s.id=v.subject_id WHERE c.owner_id=$1 AND ($2::uuid IS NULL OR v.center_id=$2)
    ORDER BY v.uploaded_at DESC,v.id LIMIT $3 OFFSET $4`,
  [ownerId,query.centerId ?? null,query.limit,query.offset])
}

export async function getVideo(ownerId: string, videoId: string) {
  const video = await one(`SELECT v.* FROM demo_videos v JOIN centers c ON c.id=v.center_id
    WHERE v.id=$1 AND c.owner_id=$2`, [videoId,ownerId])
  if (!video) throw new ApiError(404,'Demo video not found')
  return video
}

export async function createVideo(ownerId: string, input: VideoCreateInput) {
  await requireOwnedCenter(ownerId,input.centerId)
  return transaction(async client => {
    await requireVideoTeacherSubject(client,input.centerId,input.teacherId,input.subjectId)
    return (await client.query(`INSERT INTO demo_videos(center_id,teacher_id,subject_id,title,topic,video_url,duration_seconds,language)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [input.centerId,input.teacherId,input.subjectId,
      input.title,input.topic ?? null,input.videoUrl,input.durationSeconds ?? null,input.language ?? null])).rows[0]
  })
}

export async function updateVideo(ownerId: string, videoId: string, input: VideoUpdateInput) {
  return transaction(async client => {
    const video = (await client.query(`SELECT v.* FROM demo_videos v JOIN centers c ON c.id=v.center_id
      WHERE v.id=$1 AND c.owner_id=$2 FOR UPDATE OF v`, [videoId,ownerId])).rows[0]
    if (!video) throw new ApiError(404,'Demo video not found')
    await requireVideoTeacherSubject(client,video.center_id,input.teacherId ?? video.teacher_id,input.subjectId ?? video.subject_id)
    const columns: Record<keyof VideoUpdateInput,string> = {
      teacherId:'teacher_id',subjectId:'subject_id',title:'title',topic:'topic',videoUrl:'video_url',
      durationSeconds:'duration_seconds',language:'language',
    }
    const values: unknown[] = [videoId]
    const assignments = Object.entries(input).filter(([,value]) => value !== undefined).map(([key,value]) => {
      values.push(value)
      return `${columns[key as keyof VideoUpdateInput]}=$${values.length}`
    })
    assignments.push("approval_status='pending'")
    return (await client.query(`UPDATE demo_videos SET ${assignments.join(',')} WHERE id=$1 RETURNING *`, values)).rows[0]
  })
}
