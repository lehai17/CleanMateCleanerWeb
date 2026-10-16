import {test} from 'node:test';
import assert from 'node:assert/strict';
import {approved,actionFor,stats,filterJobs,vietnamDay,validDay,phoneUrl,mapsUrl} from '../src/domain.js';
test('only a server approved cleaner can enter the workspace',()=>{
  assert.equal(approved({role:'Cleaner',isCleaner:true,cleanerProfile:{reviewStatus:'Pending'}}),false);
  assert.equal(approved({role:'Customer',isCleaner:true,cleanerProfile:{reviewStatus:'Approved'}}),false);
  assert.equal(approved({role:'Cleaner',isCleaner:true,cleanerProfile:{reviewStatus:'Approved'}}),true);
});
test('cash confirmation is offered only for completed unpaid cash jobs',()=>{
  assert.equal(actionFor({status:'Accepted'}),'start');assert.equal(actionFor({status:'InProgress'}),'complete');
  assert.equal(actionFor({status:'Completed',paymentMethod:'cash',paymentStatus:'Unpaid'}),'cash-payment');
  assert.equal(actionFor({status:'Completed',paymentMethod:'cash',paymentStatus:'Paid'}),null);
  assert.equal(actionFor({status:'Completed',paymentMethod:'momo',paymentStatus:'Unpaid'}),null);
  assert.equal(actionFor({status:'Cancelled'}),null);
});
test('declared cash excludes unpaid incomplete cancelled and legacy online payments',()=>{
  const jobs=[{status:'Completed',price:140000,paymentMethod:'cash',paymentStatus:'Paid'},{status:'Completed',price:90000,paymentMethod:'cash',paymentStatus:'Unpaid'},{status:'Accepted',price:90000,paymentMethod:'cash',paymentStatus:'Paid'},{status:'Completed',price:70000,paymentMethod:'momo',paymentStatus:'Paid'}];
  assert.deepEqual(stats(jobs),{active:1,completed:3,declaredCash:140000});
});
test('date filters use Vietnam midnight and reject invalid calendar dates',()=>{
  assert.equal(vietnamDay('2026-10-16T18:00:00Z'),'2026-10-17');
  assert.equal(validDay('2026-02-30'),false);assert.equal(validDay('2028-02-29'),true);
  assert.equal(validDay('2026-1-2'),false);
  const jobs=[{id:1,startTime:'2026-10-16T18:00:00Z',status:'Accepted'}];
  assert.equal(filterJobs(jobs,{day:'2026-10-17'}).length,1);
  assert.equal(filterJobs(jobs,{day:'2026-10-16'}).length,0);
  assert.equal(filterJobs(jobs,{day:'2026-02-30'}).length,0);
});
test('search handles exact booking codes and unaccented Vietnamese addresses',()=>{
  const jobs=[{id:1,address:'Đà Nẵng',startTime:'2026-10-19T09:00:00Z'}, {id:10,address:'Hà Nội',startTime:'2026-10-18T09:00:00Z'}];
  assert.deepEqual(filterJobs(jobs,{search:'CM0001'}).map(j=>j.id),[1]);
  assert.deepEqual(filterJobs(jobs,{search:' da nang '}).map(j=>j.id),[1]);
  assert.deepEqual(filterJobs(jobs).map(j=>j.id),[10,1]);assert.equal(jobs[0].id,1);
});
test('calendar excludes completed jobs and selection never falls back to another job',()=>{
  const jobs=[{id:1,status:'Accepted',startTime:'2026-10-17T09:00:00Z'},{id:2,status:'InProgress',startTime:'2026-10-18T09:00:00Z'},{id:3,status:'Completed',startTime:'2026-10-19T09:00:00Z'}];
  assert.deepEqual(filterJobs(jobs,{calendar:true}).map(j=>j.id),[1,2]);
  assert.deepEqual(filterJobs(jobs,{status:'Completed'}).map(j=>j.id),[3]);
  assert.equal(filterJobs(jobs,{bookingId:99}).length,0);
  assert.deepEqual(filterJobs(jobs,{bookingId:3}).map(j=>j.id),[3]);
});
test('contact links encode addresses and refuse service codes or injected phone URLs',()=>{
  assert.equal(phoneUrl('+84 (901) 234-567'),'tel:+84901234567');
  for(const value of ['*123#','javascript:alert(1)','0901234567;123','',null])assert.equal(phoneUrl(value),null);
  const address='123 Đà Nẵng & q=<script>';
  const url=new URL(mapsUrl(address));assert.equal(url.origin,'https://www.google.com');assert.equal(url.searchParams.get('query'),address);assert.equal(mapsUrl('  '),null);
});
