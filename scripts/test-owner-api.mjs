import assert from 'node:assert/strict'
import { startIsolatedApiTest } from './api-test-harness.mjs'

const test = await startIsolatedApiTest()
const { client, expectStatus } = test

try {
  await expectStatus('GET','/api/owner/centers',undefined,undefined,401)
  const register = (name, role) => expectStatus('POST','/api/auth/register',{
    fullName:name,email:`${name.toLowerCase()}@example.test`,password:'ExamplePassword123!',role,
  },undefined,200)
  const owner = await register('OwnerOne','owner')
  const otherOwner = await register('OwnerTwo','owner')
  const student = await register('StudentOne','student')
  const admin = await register('AdminOne','student')
  await client.query("UPDATE users SET role='admin' WHERE id=$1", [admin.user.id])
  await expectStatus('GET','/api/owner/centers',undefined,student.token,403)

  const maths = await expectStatus('POST','/api/admin/subjects',{ name:'Maths',classLevel:'10',board:'CBSE' },admin.token,201)
  const science = await expectStatus('POST','/api/admin/subjects',{ name:'Science',classLevel:'10',board:'CBSE' },admin.token,201)
  const centerInput = { name:'Test Academy',address:'1 Test Street',city:'Delhi',locality:'Laxmi Nagar',
    latitude:28.6304,longitude:77.2773,photos:['https://example.test/photo.jpg'],facilities:['Library'] }
  await expectStatus('POST','/api/owner/centers',{ ...centerInput,longitude:undefined },owner.token,422)
  const center = await expectStatus('POST','/api/owner/centers',centerInput,owner.token,201)
  const otherCenter = await expectStatus('POST','/api/owner/centers',{ ...centerInput,name:'Other Academy' },otherOwner.token,201)
  assert.equal((await expectStatus('GET','/api/owner/centers',undefined,owner.token,200)).length,1)
  await expectStatus('GET',`/api/owner/centers/${center.id}`,undefined,otherOwner.token,404)
  await expectStatus('PUT',`/api/owner/centers/${center.id}`,{ listingStatus:'active' },owner.token,409)
  await expectStatus('PUT',`/api/owner/centers/${center.id}`,{ name:'Unauthorized' },otherOwner.token,404)

  const teacher = await expectStatus('POST','/api/owner/teachers',{
    centerId:center.id,name:'Test Teacher',subjectIds:[maths.id],qualification:'BSc',experienceYears:5,
  },owner.token,201)
  await expectStatus('POST','/api/owner/teachers',{ centerId:center.id,name:'Wrong Owner' },otherOwner.token,404)
  assert.equal((await expectStatus('GET',`/api/owner/teachers?centerId=${center.id}`,undefined,owner.token,200)).length,1)
  await expectStatus('GET',`/api/owner/teachers/${teacher.id}`,undefined,otherOwner.token,404)
  const batchInput = { centerId:center.id,teacherId:teacher.id,subjectId:maths.id,batchName:'Evening Maths',
    classLevel:'10',board:'CBSE',startTime:'17:00:00',endTime:'18:00:00',daysOfWeek:['mon','wed'],
    mode:'offline',capacity:10,filledSeats:2,monthlyFee:2000 }
  await expectStatus('POST','/api/owner/batches',{ ...batchInput,subjectId:science.id },owner.token,422)
  const batch = await expectStatus('POST','/api/owner/batches',batchInput,owner.token,201)
  await expectStatus('POST','/api/owner/batches',{ ...batchInput,centerId:otherCenter.id },owner.token,404)
  await expectStatus('GET',`/api/owner/batches/${batch.id}`,undefined,otherOwner.token,404)
  await expectStatus('PUT',`/api/owner/teachers/${teacher.id}`,{ subjectIds:[science.id] },owner.token,409)

  const video = await expectStatus('POST','/api/owner/demo-videos',{
    centerId:center.id,teacherId:teacher.id,subjectId:maths.id,title:'Algebra',videoUrl:'https://example.test/demo',
  },owner.token,201)
  await expectStatus('GET',`/api/owner/demo-videos/${video.id}`,undefined,otherOwner.token,404)
  assert.equal((await expectStatus('GET',`/api/owner/demo-videos?centerId=${center.id}`,undefined,owner.token,200)).length,1)
  await expectStatus('GET',`/api/demo-videos/${video.id}`,undefined,undefined,404)

  await expectStatus('POST','/api/admin/approve-listing',{ id:center.id,decision:'approved' },admin.token,200)
  await expectStatus('POST','/api/admin/moderate-teacher',{ id:teacher.id,decision:'approved' },admin.token,200)
  await expectStatus('POST','/api/admin/approve-video',{ id:video.id,decision:'approved' },admin.token,200)
  await expectStatus('PUT',`/api/owner/centers/${center.id}`,{ listingStatus:'active' },owner.token,200)
  await expectStatus('GET',`/api/centers/${center.id}`,undefined,undefined,200)
  await expectStatus('GET',`/api/demo-videos/${video.id}`,undefined,undefined,200)

  const editedCenter = await expectStatus('PUT',`/api/owner/centers/${center.id}`,{ name:'New Academy Name' },owner.token,200)
  assert.equal(editedCenter.verification_status,'pending')
  assert.equal(editedCenter.listing_status,'draft')
  await expectStatus('GET',`/api/centers/${center.id}`,undefined,undefined,404)
  await expectStatus('POST','/api/admin/approve-listing',{ id:center.id,decision:'approved' },admin.token,200)
  await expectStatus('PUT',`/api/owner/centers/${center.id}`,{ listingStatus:'active' },owner.token,200)

  const editedTeacher = await expectStatus('PUT',`/api/owner/teachers/${teacher.id}`,{ qualification:'MSc' },owner.token,200)
  assert.equal(editedTeacher.verification_status,'pending')
  await expectStatus('GET',`/api/teachers/${teacher.id}`,undefined,undefined,404)
  await expectStatus('POST','/api/admin/moderate-teacher',{ id:teacher.id,decision:'approved' },admin.token,200)
  await expectStatus('POST','/api/admin/approve-video',{ id:video.id,decision:'approved' },admin.token,200)
  const editedVideo = await expectStatus('PUT',`/api/owner/demo-videos/${video.id}`,{ title:'Better Algebra' },owner.token,200)
  assert.equal(editedVideo.approval_status,'pending')
  await expectStatus('GET',`/api/demo-videos/${video.id}`,undefined,undefined,404)
  await expectStatus('POST','/api/admin/approve-video',{ id:video.id,decision:'approved' },admin.token,200)
  await expectStatus('GET',`/api/demo-videos/${video.id}`,undefined,undefined,200)

  const vacancy = await expectStatus('PUT',`/api/owner/batches/${batch.id}/vacancy`,{ filledSeats:4 },owner.token,200)
  assert.equal(vacancy.vacant_seats,6)
  await expectStatus('PUT',`/api/owner/batches/${batch.id}/vacancy`,{ filledSeats:11 },owner.token,422)
  await expectStatus('PUT',`/api/owner/batches/${batch.id}/vacancy`,{ filledSeats:3 },otherOwner.token,404)
  await expectStatus('PUT',`/api/owner/batches/${batch.id}`,{ capacity:3 },owner.token,422)
  const updatedBatch = await expectStatus('PUT',`/api/owner/batches/${batch.id}`,{ capacity:12,monthlyFee:2300 },owner.token,200)
  assert.equal(updatedBatch.vacant_seats,8)
  const history = await expectStatus('GET',`/api/owner/batches/${batch.id}/history`,undefined,owner.token,200)
  assert.equal(history.vacancy.length,2)
  assert.equal(history.fees.length,1)
  await expectStatus('GET',`/api/owner/batches/${batch.id}/history`,undefined,otherOwner.token,404)

  const inquiry = await expectStatus('POST','/api/leads',{ centerId:center.id,batchId:batch.id,message:'Need Maths' },student.token,201)
  assert.equal((await expectStatus('GET',`/api/owner/leads?centerId=${center.id}`,undefined,owner.token,200)).length,1)
  assert.equal((await expectStatus('GET','/api/owner/leads',undefined,otherOwner.token,200)).length,0)
  await expectStatus('GET',`/api/owner/leads/${inquiry.id}`,undefined,otherOwner.token,404)
  await expectStatus('PATCH',`/api/owner/leads/${inquiry.id}`,{ status:'contacted' },otherOwner.token,404)
  const contacted = await expectStatus('PATCH',`/api/owner/leads/${inquiry.id}`,{ status:'contacted' },owner.token,200)
  assert.equal(contacted.status,'contacted')

  const booking = await expectStatus('POST','/api/demo-bookings',{
    centerId:center.id,batchId:batch.id,bookingTime:new Date(Date.now()+3_600_000).toISOString(),contactPhone:'+911234567890',
  },student.token,201)
  const replacementTeacher = await expectStatus('POST','/api/owner/teachers',{
    centerId:center.id,name:'Replacement Teacher',subjectIds:[maths.id],
  },owner.token,201)
  await expectStatus('PUT',`/api/owner/batches/${batch.id}`,{ teacherId:replacementTeacher.id },owner.token,409)
  assert.equal((await expectStatus('GET',`/api/owner/demo-bookings?centerId=${center.id}`,undefined,owner.token,200)).length,1)
  await expectStatus('GET',`/api/owner/demo-bookings/${booking.id}`,undefined,otherOwner.token,404)
  const ownerBooking = await expectStatus('GET',`/api/owner/demo-bookings/${booking.id}`,undefined,owner.token,200)
  assert.equal(ownerBooking.student_phone,'+911234567890')
  const analytics = await expectStatus('GET',`/api/owner/analytics?centerId=${center.id}`,undefined,owner.token,200)
  assert.equal(analytics.centers.total,1)
  assert.equal(analytics.leads.total,2)
  assert.equal(analytics.bookings.booked,1)
  await expectStatus('GET',`/api/owner/analytics?centerId=${center.id}`,undefined,otherOwner.token,404)

  await expectStatus('PUT',`/api/owner/teachers/${teacher.id}`,{ active:false },owner.token,200)
  await expectStatus('GET',`/api/teachers/${teacher.id}`,undefined,undefined,404)
  assert.equal((await expectStatus('GET','/api/search/centers?subject=Maths',undefined,undefined,200)).length,0)
  await expectStatus('PUT',`/api/owner/teachers/${teacher.id}`,{ active:true },owner.token,200)
  await expectStatus('GET',`/api/teachers/${teacher.id}`,undefined,undefined,200)
  await expectStatus('PUT',`/api/owner/batches/${batch.id}`,{ status:'paused' },owner.token,200)
  assert.equal((await expectStatus('GET','/api/search/centers?subject=Maths',undefined,undefined,200)).length,0)
  await expectStatus('PUT',`/api/owner/batches/${batch.id}`,{ status:'active' },owner.token,200)
  assert.equal((await expectStatus('GET','/api/search/centers?subject=Maths',undefined,undefined,200)).length,1)
  console.log('Owner API integration checks passed')
} finally {
  await test.stop()
}
