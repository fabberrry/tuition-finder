import assert from 'node:assert/strict'
import { startIsolatedApiTest } from './api-test-harness.mjs'

const test = await startIsolatedApiTest()
const { client, expectStatus } = test
try {
  const register = (name, role) => expectStatus('POST','/api/auth/register',{
    fullName:name,email:`${name.toLowerCase()}@example.test`,password:'ExamplePassword123!',role,
  },undefined,200)
  const admin = await register('AdminChecks','student')
  await client.query("UPDATE users SET role='admin' WHERE id=$1", [admin.user.id])
  const owner = await register('OwnerChecks','owner')
  const student = await register('StudentChecks','student')
  await expectStatus('GET','/api/admin/moderation',undefined,undefined,401)
  await expectStatus('GET','/api/admin/audit',undefined,owner.token,403)
  await expectStatus('POST','/api/admin/subjects',{ name:'Maths' },owner.token,403)
  const subject = await expectStatus('POST','/api/admin/subjects',{ name:'Maths' },admin.token,201)
  const centerInput = { name:'Academy',address:'1 Main Road',city:'Delhi',locality:'North' }
  const center = await expectStatus('POST','/api/owner/centers',centerInput,owner.token,201)
  const duplicate = await expectStatus('POST','/api/owner/centers',centerInput,owner.token,201)
  assert.equal((await expectStatus('GET','/api/admin/duplicates',undefined,admin.token,200)).length,1)
  const teacher = await expectStatus('POST','/api/owner/teachers',{ centerId:center.id,name:'Teacher',subjectIds:[subject.id] },owner.token,201)
  const video = await expectStatus('POST','/api/owner/demo-videos',{
    centerId:center.id,teacherId:teacher.id,subjectId:subject.id,title:'Maths demo',videoUrl:'https://example.test/demo',
  },owner.token,201)
  const queue = await expectStatus('GET','/api/admin/moderation',undefined,admin.token,200)
  assert.equal(queue.centers.length,2)
  assert.equal(queue.duplicates.length,1)
  await expectStatus('POST','/api/admin/moderate-teacher',{ id:teacher.id,decision:'approved' },admin.token,409)
  await expectStatus('POST','/api/admin/reject-listing',{ id:center.id,decision:'approved' },admin.token,422)
  await expectStatus('PUT',`/api/admin/centers/${center.id}/featured`,{ featured:true },admin.token,409)
  await expectStatus('POST','/api/admin/approve-listing',{ id:center.id,decision:'approved' },admin.token,200)
  await expectStatus('POST','/api/admin/approve-listing',{ id:center.id,decision:'approved' },admin.token,409)
  await expectStatus('POST','/api/admin/moderate-teacher',{ id:teacher.id,decision:'approved' },admin.token,200)
  await expectStatus('POST','/api/admin/approve-video',{ id:video.id,decision:'approved' },admin.token,200)
  await expectStatus('PUT',`/api/owner/centers/${center.id}`,{ listingStatus:'active' },owner.token,200)
  const batch = await expectStatus('POST','/api/owner/batches',{
    centerId:center.id,teacherId:teacher.id,subjectId:subject.id,batchName:'Morning Maths',
    startTime:'09:00:00',endTime:'10:00:00',daysOfWeek:['mon'],mode:'offline',capacity:10,
  },owner.token,201)
  const booking = (await client.query(`INSERT INTO demo_bookings(student_id,center_id,batch_id,teacher_id,booking_time,status)
    VALUES($1,$2,$3,$4,now()-interval '1 day','attended') RETURNING id`,
    [student.user.id,center.id,batch.id,teacher.id])).rows[0]
  const review = await expectStatus('POST','/api/reviews',{ bookingId:booking.id,rating:5,reviewText:'Helpful demo' },student.token,201)
  await expectStatus('POST','/api/admin/moderate-review',{ id:review.id,decision:'approved' },owner.token,403)
  await expectStatus('POST','/api/admin/moderate-review',{ id:review.id,decision:'approved' },admin.token,200)
  await expectStatus('POST','/api/admin/moderate-review',{ id:review.id,decision:'rejected' },admin.token,409)
  const featured = await expectStatus('PUT',`/api/admin/centers/${center.id}/featured`,{ featured:true },admin.token,200)
  assert.equal(featured.featured,true)
  const suspended = await expectStatus('PUT',`/api/admin/centers/${center.id}/status`,{ status:'suspended',notes:'Reported listing' },admin.token,200)
  assert.equal(suspended.featured,false)
  await expectStatus('GET',`/api/centers/${center.id}`,undefined,undefined,404)
  await expectStatus('PUT',`/api/owner/centers/${center.id}`,{ listingStatus:'active' },owner.token,409)
  await expectStatus('PUT',`/api/admin/centers/${center.id}/status`,{ status:'draft',notes:'Issue resolved' },admin.token,200)
  await expectStatus('PUT',`/api/owner/centers/${center.id}`,{ listingStatus:'active' },owner.token,200)
  const report = await expectStatus('POST','/api/reports',{ centerId:center.id,issueType:'duplicate_listing',details:'Possible duplicate' },student.token,201)
  assert.equal((await expectStatus('GET','/api/admin/reports?status=pending',undefined,admin.token,200)).length,1)
  await expectStatus('POST','/api/admin/moderate-report',{ id:report.id,decision:'resolved',notes:'Reviewed' },admin.token,200)
  await expectStatus('POST','/api/admin/moderate-report',{ id:report.id,decision:'dismissed' },admin.token,409)
  await expectStatus('PUT',`/api/admin/users/${admin.user.id}/status`,{ status:'suspended',notes:'test' },admin.token,409)
  await expectStatus('PUT',`/api/admin/users/${owner.user.id}/status`,{ status:'suspended',notes:'Policy violation' },admin.token,200)
  await expectStatus('GET','/api/owner/centers',undefined,owner.token,401)
  await expectStatus('PUT',`/api/admin/users/${owner.user.id}/status`,{ status:'active',notes:'Appeal accepted' },admin.token,200)
  await expectStatus('GET','/api/owner/centers',undefined,owner.token,200)
  const rejected = await expectStatus('POST','/api/admin/reject-listing',{ id:duplicate.id,decision:'rejected',notes:'Duplicate' },admin.token,200)
  assert.equal(rejected.verification_status,'rejected')
  const audit = await expectStatus('GET','/api/admin/audit',undefined,admin.token,200)
  assert.ok(audit.some(row => row.action === 'listing_suspended'))
  assert.ok(audit.some(row => row.action === 'user_suspended'))
  assert.ok(audit.some(row => row.action === 'report_resolved'))
  console.log('Admin API integration checks passed')
} finally {
  await test.stop()
}
