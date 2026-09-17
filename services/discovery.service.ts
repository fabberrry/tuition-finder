import { one, rows } from '@/lib/server/db'
import { ApiError } from '@/lib/server/http'
import { publicCenter } from '@/lib/server/marketplace'
import type { ReviewsQuery, SearchInput } from '@/validators/discovery.validator'

export async function searchCenters(input: SearchInput) {
  if ((input.latitude === undefined) !== (input.longitude === undefined) || (input.radiusKm !== undefined && input.latitude === undefined)) {
    throw new ApiError(422, 'Latitude and longitude are required together')
  }
  if (input.minFee !== undefined && input.maxFee !== undefined && input.minFee > input.maxFee) {
    throw new ApiError(422, 'Minimum fee exceeds maximum fee')
  }
  const values: unknown[] = []
  const add = (value: unknown) => { values.push(value); return `$${values.length}` }
  const where = ["c.verification_status='approved'", "c.listing_status='active'"]
  if (input.city) where.push(`c.city ILIKE ${add(input.city)}`)
  if (input.locality) where.push(`c.locality ILIKE ${add(input.locality)}`)
  if (input.subject) where.push(`s.name ILIKE ${add(input.subject)}`)
  if (input.classLevel) where.push(`b.class_level=${add(input.classLevel)}`)
  if (input.board) where.push(`b.board ILIKE ${add(input.board)}`)
  if (input.exam) where.push(`b.exam_type ILIKE ${add(input.exam)}`)
  if (input.mode) where.push(`b.mode=${add(input.mode)}`)
  if (input.minFee !== undefined) where.push(`b.monthly_fee>=${add(input.minFee)}`)
  if (input.maxFee !== undefined) where.push(`b.monthly_fee<=${add(input.maxFee)}`)
  if (input.vacancy === 'true') where.push('b.filled_seats<b.capacity')
  if (input.timing === 'morning') where.push("b.start_time < '12:00'")
  if (input.timing === 'afternoon') where.push("b.start_time >= '12:00' AND b.start_time < '17:00'")
  if (input.timing === 'evening') where.push("b.start_time >= '17:00'")
  let distance = 'NULL::double precision'
  if (input.latitude !== undefined && input.longitude !== undefined) {
    const lat = add(input.latitude), lon = add(input.longitude)
    distance = `(6371 * acos(least(1,greatest(-1,cos(radians(${lat}))*cos(radians(c.latitude))*cos(radians(c.longitude)-radians(${lon}))+sin(radians(${lat}))*sin(radians(c.latitude))))))`
    if (input.radiusKm !== undefined) where.push(`c.latitude IS NOT NULL AND c.longitude IS NOT NULL AND ${distance}<=${add(input.radiusKm)}`)
  }
  const rating = add(input.minRating ?? 0)
  const limit = add(input.limit), offset = add(input.offset)
  return rows(`WITH ratings AS (
    SELECT center_id,ROUND(AVG(rating)::numeric,2) AS average_rating,COUNT(*)::int AS total_reviews
    FROM reviews WHERE moderation_status='approved' GROUP BY center_id
  ), matches AS (
    SELECT c.id,c.name,c.address,c.city,c.locality,c.latitude,c.longitude,c.photos,c.featured,
      b.id AS batch_id,b.batch_name,b.class_level,b.board,b.start_time,b.end_time,b.mode,b.monthly_fee,
      b.capacity-b.filled_seats AS vacant_seats,b.vacancy_last_updated_at,s.name AS subject,
      ${distance} AS distance_km,COALESCE(r.average_rating,0) AS average_rating,
      COALESCE(r.total_reviews,0) AS total_reviews
    FROM centers c JOIN batches b ON b.center_id=c.id AND b.status='active'
    JOIN teachers t ON t.id=b.teacher_id AND t.center_id=b.center_id AND t.verification_status='approved'
    JOIN subjects s ON s.id=b.subject_id LEFT JOIN ratings r ON r.center_id=c.id
    WHERE ${where.join(' AND ')} AND COALESCE(r.average_rating,0)>=${rating}
  ), ranked AS (
    SELECT m.*,ROW_NUMBER() OVER (PARTITION BY m.id ORDER BY m.vacant_seats DESC,m.monthly_fee ASC NULLS LAST,m.batch_id) AS batch_rank
    FROM matches m
  ) SELECT id,name,address,city,locality,latitude,longitude,photos,featured,batch_id,batch_name,
    class_level,board,start_time,end_time,mode,monthly_fee,vacant_seats,vacancy_last_updated_at,
    subject,distance_km,average_rating,total_reviews FROM ranked WHERE batch_rank=1
    ORDER BY featured DESC,average_rating DESC,distance_km ASC NULLS LAST,vacant_seats DESC,id
    LIMIT ${limit} OFFSET ${offset}`, values)
}

export async function getCenterProfile(centerId: string) {
  const center = await publicCenter(centerId)
  const [teachers,batches,videos,reviews] = await Promise.all([
    rows(`SELECT t.id,t.name,t.qualification,t.experience_years,t.bio,t.verification_status,
      COALESCE(json_agg(DISTINCT s.name) FILTER (WHERE s.id IS NOT NULL),'[]') AS subjects
      FROM teachers t LEFT JOIN teacher_subjects ts ON ts.teacher_id=t.id
      LEFT JOIN subjects s ON s.id=ts.subject_id WHERE t.center_id=$1 AND t.verification_status='approved'
      GROUP BY t.id`, [centerId]),
    rows(`SELECT b.*,b.capacity-b.filled_seats AS vacant_seats,s.name AS subject,t.name AS teacher_name
      FROM batches b JOIN subjects s ON s.id=b.subject_id JOIN teachers t ON t.id=b.teacher_id AND t.center_id=b.center_id
      WHERE b.center_id=$1 AND b.status='active' AND t.verification_status='approved' ORDER BY b.start_time`, [centerId]),
    rows(`SELECT v.id,v.teacher_id,v.subject_id,v.title,v.topic,v.video_url,v.duration_seconds,v.language,
      t.name AS teacher_name,s.name AS subject FROM demo_videos v
      JOIN teachers t ON t.id=v.teacher_id AND t.center_id=v.center_id AND t.verification_status='approved'
      JOIN subjects s ON s.id=v.subject_id WHERE v.center_id=$1 AND v.approval_status='approved'`, [centerId]),
    rows(`SELECT r.id,r.rating,r.review_text,r.teaching_clarity_rating,r.doubt_solving_rating,
      r.environment_rating,r.value_for_money_rating,r.created_at,u.full_name AS reviewer
      FROM reviews r JOIN users u ON u.id=r.student_id WHERE r.center_id=$1 AND r.moderation_status='approved'
      ORDER BY r.created_at DESC LIMIT 50`, [centerId]),
  ])
  return { ...center,teachers,batches,videos,reviews }
}

export async function getTeacherProfile(teacherId: string) {
  const teacher = await one(`SELECT t.id,t.center_id,t.name,t.qualification,t.experience_years,t.bio,t.verification_status,
    (SELECT ROUND(AVG(r.rating)::numeric,2) FROM reviews r WHERE r.teacher_id=t.id AND r.moderation_status='approved') AS average_rating,
    (SELECT COUNT(*)::int FROM reviews r WHERE r.teacher_id=t.id AND r.moderation_status='approved') AS total_reviews
    FROM teachers t JOIN centers c ON c.id=t.center_id WHERE t.id=$1 AND t.verification_status='approved'
    AND c.verification_status='approved' AND c.listing_status='active'`, [teacherId])
  if (!teacher) throw new ApiError(404, 'Teacher not found')
  const [subjects,batches,videos,reviews] = await Promise.all([
    rows('SELECT s.* FROM subjects s JOIN teacher_subjects ts ON ts.subject_id=s.id WHERE ts.teacher_id=$1', [teacherId]),
    rows(`SELECT b.id,b.batch_name,b.class_level,b.board,b.start_time,b.end_time,b.days_of_week,b.mode,
      b.monthly_fee,b.capacity-b.filled_seats AS vacant_seats FROM batches b
      WHERE b.teacher_id=$1 AND b.status='active' ORDER BY b.start_time`, [teacherId]),
    rows(`SELECT id,title,topic,video_url,duration_seconds,language FROM demo_videos
      WHERE teacher_id=$1 AND approval_status='approved'`, [teacherId]),
    rows(`SELECT rating,review_text,created_at FROM reviews WHERE teacher_id=$1 AND moderation_status='approved'
      ORDER BY created_at DESC LIMIT 30`, [teacherId]),
  ])
  return { ...teacher,subjects,batches,videos,reviews }
}

export async function getApprovedVideo(videoId: string) {
  const video = await one(`SELECT v.id,v.center_id,v.teacher_id,v.subject_id,v.title,v.topic,v.video_url,
    v.duration_seconds,v.language,v.uploaded_at,t.name AS teacher_name,s.name AS subject
    FROM demo_videos v JOIN centers c ON c.id=v.center_id
    JOIN teachers t ON t.id=v.teacher_id AND t.center_id=c.id JOIN subjects s ON s.id=v.subject_id
    WHERE v.id=$1 AND v.approval_status='approved' AND t.verification_status='approved'
    AND c.verification_status='approved' AND c.listing_status='active'`, [videoId])
  if (!video) throw new ApiError(404, 'Demo video not found')
  return video
}

export async function listApprovedReviews(input: ReviewsQuery) {
  const centerId = input.centerId ?? null, teacherId = input.teacherId ?? null
  if (centerId) await publicCenter(centerId)
  else {
    const teacher = await one(`SELECT 1 FROM teachers t JOIN centers c ON c.id=t.center_id
      WHERE t.id=$1 AND t.verification_status='approved' AND c.verification_status='approved'
      AND c.listing_status='active'`, [teacherId])
    if (!teacher) throw new ApiError(404, 'Teacher not found')
  }
  return rows(`SELECT r.id,r.center_id,r.teacher_id,r.rating,r.review_text,r.teaching_clarity_rating,
    r.doubt_solving_rating,r.environment_rating,r.value_for_money_rating,r.verification_type,
    r.created_at,u.full_name AS reviewer FROM reviews r JOIN users u ON u.id=r.student_id
    WHERE r.moderation_status='approved' AND (($1::uuid IS NOT NULL AND r.center_id=$1) OR ($2::uuid IS NOT NULL AND r.teacher_id=$2))
    ORDER BY r.created_at DESC,r.id LIMIT $3 OFFSET $4`, [centerId,teacherId,input.limit,input.offset])
}
