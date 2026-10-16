import {test} from 'node:test';
import assert from 'node:assert/strict';
import {approved,actionFor,stats} from '../src/domain.js';
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
