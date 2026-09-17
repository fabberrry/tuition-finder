import { one, rows, transaction } from '@/lib/server/db'
import { ApiError } from '@/lib/server/http'
import type { BatchCreateInput, BatchUpdateInput, OwnerListQuery, TeacherCreateInput, TeacherUpdateInput } from '@/validators/owner.validator'
import { requireOwnedCenter } from './ownership'

const teacherColumns: Record<'name'|'qualification'|'experienceYears'|'bio'|'active',string> = {
  name:'name', qualification:'qualification', experienceYears:'experience_years', bio:'bio', active:'active',
}
const batchColumns: Record<Exclude<keyof BatchUpdateInput,'status'> | 'status',string> = {
  teacherId:'teacher_id', subjectId:'subject_id', batchName:'batch_name', classLevel:'class_level',
  board:'board', examType:'exam_type', startTime:'start_time', endTime:'end_time',
  daysOfWeek:'days_of_week', mode:'mode', capacity:'capacity', monthlyFee:'monthly_fee', status:'status',
}

async function validateSubjects(client: import('pg').PoolClient, subjectIds: string[]) {
  const unique = [...new Set(subjectIds)]
  if (unique.length !== subjectIds.length) throw new ApiError(422,'Duplicate subject IDs')
  const result = await client.query('SELECT COUNT(*)::int AS count FROM subjects WHERE id=ANY($1::uuid[])', [unique])
  if (result.rows[0].count !== unique.length) throw new ApiError(422,'Unknown subject ID')
}

async function requireTeacherSubject(client: import('pg').PoolClient, centerId: string, teacherId: string, subjectId: string) {
  const result = await client.query(`SELECT t.id FROM teachers t JOIN teacher_subjects ts ON ts.teacher_id=t.id
    WHERE t.id=$1 AND t.center_id=$2 AND t.active=true AND ts.subject_id=$3`, [teacherId,centerId,subjectId])
  if (!result.rowCount) throw new ApiError(422,'Active teacher must belong to center and teach this subject')
}

export async function listTeachers(ownerId: string, query: OwnerListQuery) {
  if (query.centerId) await requireOwnedCenter(ownerId,query.centerId)
  return rows(`SELECT t.*,COALESCE(json_agg(s.id) FILTER (WHERE s.id IS NOT NULL),'[]') AS subject_ids
    FROM teachers t JOIN centers c ON c.id=t.center_id LEFT JOIN teacher_subjects ts ON ts.teacher_id=t.id
    LEFT JOIN subjects s ON s.id=ts.subject_id WHERE c.owner_id=$1 AND ($2::uuid IS NULL OR t.center_id=$2)
    GROUP BY t.id ORDER BY t.created_at DESC,t.id LIMIT $3 OFFSET $4`,
  [ownerId,query.centerId ?? null,query.limit,query.offset])
}

export async function getTeacher(ownerId: string, teacherId: string) {
  const teacher = await one(`SELECT t.* FROM teachers t JOIN centers c ON c.id=t.center_id
    WHERE t.id=$1 AND c.owner_id=$2`, [teacherId,ownerId])
  if (!teacher) throw new ApiError(404,'Teacher not found')
  const subjects = await rows(`SELECT s.* FROM subjects s JOIN teacher_subjects ts ON ts.subject_id=s.id
    WHERE ts.teacher_id=$1 ORDER BY s.name`, [teacherId])
  return { ...teacher,subjects }
}

export async function createTeacher(ownerId: string, input: TeacherCreateInput) {
  await requireOwnedCenter(ownerId,input.centerId)
  return transaction(async client => {
    await validateSubjects(client,input.subjectIds)
    const teacher = (await client.query(`INSERT INTO teachers(center_id,name,qualification,experience_years,bio)
      VALUES($1,$2,$3,$4,$5) RETURNING *`, [input.centerId,input.name,input.qualification ?? null,
      input.experienceYears ?? null,input.bio ?? null])).rows[0]
    for (const subjectId of input.subjectIds) {
      await client.query('INSERT INTO teacher_subjects(teacher_id,subject_id) VALUES($1,$2)', [teacher.id,subjectId])
    }
    return teacher
  })
}

export async function updateTeacher(ownerId: string, teacherId: string, input: TeacherUpdateInput) {
  return transaction(async client => {
    const teacher = (await client.query(`SELECT t.* FROM teachers t JOIN centers c ON c.id=t.center_id
      WHERE t.id=$1 AND c.owner_id=$2 FOR UPDATE OF t`, [teacherId,ownerId])).rows[0]
    if (!teacher) throw new ApiError(404,'Teacher not found')
    if (input.subjectIds) {
      await validateSubjects(client,input.subjectIds)
      const used = await client.query(`SELECT 1 FROM batches WHERE teacher_id=$1 AND subject_id <> ALL($2::uuid[])
        UNION ALL SELECT 1 FROM demo_videos WHERE teacher_id=$1 AND subject_id <> ALL($2::uuid[]) LIMIT 1`,
      [teacherId,input.subjectIds])
      if (used.rowCount) throw new ApiError(409,'Cannot remove a subject used by a batch or video')
      await client.query('DELETE FROM teacher_subjects WHERE teacher_id=$1', [teacherId])
      for (const subjectId of input.subjectIds) {
        await client.query('INSERT INTO teacher_subjects(teacher_id,subject_id) VALUES($1,$2)', [teacherId,subjectId])
      }
    }
    const fields = Object.entries(input).filter(([key,value]) => key !== 'subjectIds' && value !== undefined)
    const values: unknown[] = [teacherId]
    const assignments = fields.map(([key,value]) => {
      values.push(value)
      return `${teacherColumns[key as keyof typeof teacherColumns]}=$${values.length}`
    })
    if (fields.some(([key]) => key !== 'active') || input.subjectIds) {
      assignments.push("verification_status='pending'")
      await client.query("UPDATE demo_videos SET approval_status='pending' WHERE teacher_id=$1", [teacherId])
    }
    const updated = assignments.length
      ? (await client.query(`UPDATE teachers SET ${assignments.join(',')} WHERE id=$1 RETURNING *`, values)).rows[0]
      : teacher
    return updated
  })
}

export async function listBatches(ownerId: string, query: OwnerListQuery) {
  if (query.centerId) await requireOwnedCenter(ownerId,query.centerId)
  return rows(`SELECT b.*,b.capacity-b.filled_seats AS vacant_seats,s.name AS subject,t.name AS teacher_name
    FROM batches b JOIN centers c ON c.id=b.center_id JOIN subjects s ON s.id=b.subject_id
    JOIN teachers t ON t.id=b.teacher_id WHERE c.owner_id=$1 AND ($2::uuid IS NULL OR b.center_id=$2)
    ORDER BY b.created_at DESC,b.id LIMIT $3 OFFSET $4`,
  [ownerId,query.centerId ?? null,query.limit,query.offset])
}

export async function getBatch(ownerId: string, batchId: string) {
  const batch = await one(`SELECT b.*,b.capacity-b.filled_seats AS vacant_seats,s.name AS subject,t.name AS teacher_name
    FROM batches b JOIN centers c ON c.id=b.center_id JOIN subjects s ON s.id=b.subject_id
    JOIN teachers t ON t.id=b.teacher_id WHERE b.id=$1 AND c.owner_id=$2`, [batchId,ownerId])
  if (!batch) throw new ApiError(404,'Batch not found')
  return batch
}

export async function createBatch(ownerId: string, input: BatchCreateInput) {
  await requireOwnedCenter(ownerId,input.centerId)
  return transaction(async client => {
    await requireTeacherSubject(client,input.centerId,input.teacherId,input.subjectId)
    return (await client.query(`INSERT INTO batches(center_id,teacher_id,subject_id,batch_name,class_level,board,exam_type,
      start_time,end_time,days_of_week,mode,capacity,filled_seats,monthly_fee)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *,capacity-filled_seats AS vacant_seats`,
    [input.centerId,input.teacherId,input.subjectId,input.batchName,input.classLevel ?? null,
      input.board ?? null,input.examType ?? null,input.startTime,input.endTime,input.daysOfWeek,
      input.mode,input.capacity,input.filledSeats,input.monthlyFee ?? null])).rows[0]
  })
}

export async function updateBatch(ownerId: string, batchId: string, input: BatchUpdateInput) {
  return transaction(async client => {
    const batch = (await client.query(`SELECT b.* FROM batches b JOIN centers c ON c.id=b.center_id
      WHERE b.id=$1 AND c.owner_id=$2 FOR UPDATE OF b`, [batchId,ownerId])).rows[0]
    if (!batch) throw new ApiError(404,'Batch not found')
    const capacity = input.capacity ?? batch.capacity
    if (capacity < batch.filled_seats) throw new ApiError(422,'Capacity cannot be below filled seats')
    if ((input.startTime ?? batch.start_time) >= (input.endTime ?? batch.end_time)) throw new ApiError(422,'Invalid time range')
    await requireTeacherSubject(client,batch.center_id,input.teacherId ?? batch.teacher_id,input.subjectId ?? batch.subject_id)
    if ((input.teacherId && input.teacherId !== batch.teacher_id) || (input.subjectId && input.subjectId !== batch.subject_id)) {
      const booked = await client.query("SELECT 1 FROM demo_bookings WHERE batch_id=$1 AND status='booked' LIMIT 1", [batchId])
      if (booked.rowCount) throw new ApiError(409,'Cancel or complete booked demos before reassigning the batch')
    }
    const values: unknown[] = [batchId]
    const assignments = Object.entries(input).filter(([,value]) => value !== undefined).map(([key,value]) => {
      values.push(value)
      return `${batchColumns[key as keyof typeof batchColumns]}=$${values.length}`
    })
    if (input.capacity !== undefined && input.capacity !== batch.capacity) assignments.push('vacancy_last_updated_at=now()')
    const updated = (await client.query(`UPDATE batches SET ${assignments.join(',')} WHERE id=$1
      RETURNING *,capacity-filled_seats AS vacant_seats`, values)).rows[0]
    if (input.capacity !== undefined && input.capacity !== batch.capacity) {
      await client.query(`INSERT INTO vacancy_audit(batch_id,actor_id,old_filled,new_filled,old_capacity,new_capacity)
        VALUES($1,$2,$3,$3,$4,$5)`, [batchId,ownerId,batch.filled_seats,batch.capacity,input.capacity])
    }
    if (input.monthlyFee !== undefined && input.monthlyFee !== batch.monthly_fee) {
      await client.query(`INSERT INTO batch_fee_audit(batch_id,actor_id,old_monthly_fee,new_monthly_fee)
        VALUES($1,$2,$3,$4)`, [batchId,ownerId,batch.monthly_fee,input.monthlyFee])
    }
    return updated
  })
}

export async function updateVacancy(ownerId: string, batchId: string, filledSeats: number) {
  return transaction(async client => {
    const batch = (await client.query(`SELECT b.* FROM batches b JOIN centers c ON c.id=b.center_id
      WHERE b.id=$1 AND c.owner_id=$2 FOR UPDATE OF b`, [batchId,ownerId])).rows[0]
    if (!batch) throw new ApiError(404,'Batch not found')
    if (filledSeats > batch.capacity) throw new ApiError(422,'Filled seats exceed capacity')
    const updated = (await client.query(`UPDATE batches SET filled_seats=$2,vacancy_last_updated_at=now()
      WHERE id=$1 RETURNING *,capacity-filled_seats AS vacant_seats`, [batchId,filledSeats])).rows[0]
    await client.query(`INSERT INTO vacancy_audit(batch_id,actor_id,old_filled,new_filled,old_capacity,new_capacity)
      VALUES($1,$2,$3,$4,$5,$5)`, [batchId,ownerId,batch.filled_seats,filledSeats,batch.capacity])
    return updated
  })
}

export async function getBatchHistory(ownerId: string, batchId: string) {
  await getBatch(ownerId,batchId)
  const [vacancy,fees] = await Promise.all([
    rows('SELECT * FROM vacancy_audit WHERE batch_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100', [batchId]),
    rows('SELECT * FROM batch_fee_audit WHERE batch_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100', [batchId]),
  ])
  return { vacancy,fees }
}
