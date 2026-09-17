import assert from 'node:assert/strict'
import { startIsolatedApiTest } from './api-test-harness.mjs'

const test = await startIsolatedApiTest()
const { client: admin, expectStatus } = test

try {
  await expectStatus( 'GET', '/api/shortlists', undefined, undefined, 401)
  const register = (name, role) => expectStatus('POST','/api/auth/register',{
    fullName: name, email: `${name.toLowerCase()}@example.test`, password: 'ExamplePassword123!', role,
  },undefined,200)
  const student = await register('StudentOne','student')
  const other = await register('StudentTwo','student')
  const owner = await register('CenterOwner','owner')
  const adminUser = await register('SiteAdmin','student')
  await admin.query(`UPDATE users SET role='admin' WHERE id=$1`, [adminUser.user.id])
  const subject = (await admin.query(`INSERT INTO subjects(name,class_level,board) VALUES('Maths','10','CBSE') RETURNING id`)).rows[0]
  const center = (await admin.query(`INSERT INTO centers(owner_id,name,address,city,locality,latitude,longitude,verification_status,listing_status)
    VALUES($1,'Test Academy','1 Test Street','Delhi','Laxmi Nagar',28.6304,77.2773,'approved','active') RETURNING id`, [owner.user.id])).rows[0]
  const teacher = (await admin.query(`INSERT INTO teachers(center_id,name,verification_status)
    VALUES($1,'Test Teacher','approved') RETURNING id`, [center.id])).rows[0]
  await admin.query(`INSERT INTO teacher_subjects(teacher_id,subject_id) VALUES($1,$2)`, [teacher.id,subject.id])
  const batch = (await admin.query(`INSERT INTO batches(center_id,teacher_id,subject_id,batch_name,class_level,board,start_time,end_time,days_of_week,mode,capacity,monthly_fee)
    VALUES($1,$2,$3,'Evening 10','10','CBSE','17:00','18:00',ARRAY['mon'],'offline',10,2000) RETURNING id`, [center.id,teacher.id,subject.id])).rows[0]
  const video = (await admin.query(`INSERT INTO demo_videos(center_id,teacher_id,subject_id,title,video_url,approval_status)
    VALUES($1,$2,$3,'Algebra demo','https://example.test/demo','approved') RETURNING id`, [center.id,teacher.id,subject.id])).rows[0]
  const pendingVideo = (await admin.query(`INSERT INTO demo_videos(center_id,teacher_id,subject_id,title,video_url)
    VALUES($1,$2,$3,'Pending','https://example.test/pending') RETURNING id`, [center.id,teacher.id,subject.id])).rows[0]

  const results = await expectStatus('GET','/api/search/centers?subject=Maths&classLevel=10&board=CBSE&minFee=1500&maxFee=2500&vacancy=true&timing=evening&latitude=28.6304&longitude=77.2773&radiusKm=3',undefined,undefined,200)
  assert.equal(results.length,1)
  assert.equal(results[0].id,center.id)
  await expectStatus('GET',`/api/centers/${center.id}`,undefined,undefined,200)
  await expectStatus('GET',`/api/teachers/${teacher.id}`,undefined,undefined,200)
  await expectStatus('GET',`/api/demo-videos/${video.id}`,undefined,undefined,200)
  await expectStatus('GET',`/api/demo-videos/${pendingVideo.id}`,undefined,undefined,404)
  await expectStatus('GET',`/api/reviews?centerId=${center.id}`,undefined,undefined,200)

  await expectStatus('PUT','/api/student/profile',{ classLevel:'10', board:'CBSE', preferredBudgetMin:1500, preferredBudgetMax:2500 },student.token,200)
  const profile = await expectStatus('GET','/api/student/profile',undefined,student.token,200)
  assert.equal(profile.class_level,'10')
  await expectStatus('GET','/api/student/profile',undefined,owner.token,403)
  await expectStatus('PUT','/api/student/profile',{ preferredBudgetMin:3000 },student.token,422)

  const saved = await expectStatus('POST','/api/shortlists',{ centerId:center.id },student.token,201)
  assert.equal(saved.created,true)
  await expectStatus('POST','/api/shortlists',{ centerId:center.id },student.token,200)
  assert.equal((await expectStatus('GET','/api/shortlists',undefined,other.token,200)).length,0)

  const inquiry = await expectStatus('POST','/api/leads',{ centerId:center.id,batchId:batch.id,message:'Looking for maths tuition' },student.token,201)
  await expectStatus('GET',`/api/leads/${inquiry.id}`,undefined,student.token,200)
  await expectStatus('GET',`/api/leads/${inquiry.id}`,undefined,other.token,404)

  const bookingTime = new Date(Date.now()+3_600_000).toISOString()
  const booking = await expectStatus('POST','/api/demo-bookings',{ centerId:center.id,batchId:batch.id,bookingTime,contactPhone:'+911234567890' },student.token,201)
  await expectStatus('GET',`/api/demo-bookings/${booking.id}`,undefined,student.token,200)
  await expectStatus('GET',`/api/demo-bookings/${booking.id}`,undefined,other.token,404)
  await expectStatus('POST','/api/demo-bookings',{ centerId:center.id,batchId:batch.id,bookingTime,contactPhone:'+911234567890' },student.token,409)
  await expectStatus('POST','/api/reviews',{ bookingId:booking.id,rating:5,reviewText:'Clear explanations' },student.token,422)
  await expectStatus('PATCH',`/api/demo-bookings/${booking.id}`,{ status:'attended' },student.token,403)
  await expectStatus('PATCH',`/api/demo-bookings/${booking.id}`,{ status:'booked',bookingTime:new Date(Date.now()+7_200_000).toISOString() },student.token,200)
  await admin.query(`UPDATE demo_bookings SET booking_time=now()-interval '1 hour' WHERE id=$1`, [booking.id])
  await expectStatus('PATCH',`/api/demo-bookings/${booking.id}`,{ status:'attended' },owner.token,200)
  const review = await expectStatus('POST','/api/reviews',{ bookingId:booking.id,rating:5,reviewText:'Clear explanations',teachingClarityRating:5 },student.token,201)
  assert.equal((await expectStatus('GET',`/api/reviews?centerId=${center.id}`,undefined,undefined,200)).length,0)
  await expectStatus('POST','/api/admin/moderate-review',{ id:review.id,decision:'approved' },adminUser.token,200)
  assert.equal((await expectStatus('GET',`/api/reviews?centerId=${center.id}`,undefined,undefined,200)).length,1)
  await expectStatus('POST','/api/reviews',{ bookingId:booking.id,rating:5,reviewText:'Again' },student.token,409)

  await expectStatus('POST','/api/reports',{ centerId:center.id,issueType:'vacancy_mismatch',details:'Seats shown incorrectly' },student.token,201)
  assert.equal((await expectStatus('GET','/api/reports',undefined,student.token,200)).length,1)
  assert.equal((await expectStatus('GET','/api/reports',undefined,other.token,200)).length,0)
  await expectStatus('DELETE',`/api/shortlists/${center.id}`,undefined,student.token,200)
  console.log('Student API integration checks passed')
} finally {
  await test.stop()
}
