import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
const API='http://127.0.0.1:15238', password='Cleaner-system-test-123!';
async function admin(request) {const r=await request.post(`${API}/api/auth/login`,{data:{email:'admin@system.test',password:'CleanMate-admin-test-123!'}});expect(r.status()).toBe(200);return {Authorization:`Bearer ${(await r.json()).token}`};}
async function review(request,id,status='Approved',reason) {expect((await request.put(`${API}/api/management/applications/${id}/review`,{headers:await admin(request),data:{status,reason}})).status()).toBe(200);}
async function account(request,role='Cleaner',approve=true) {
  const email=`${randomUUID()}@example.test`;
  const r=await request.post(`${API}/api/auth/register`,{data:{email,password,fullName:'Cleaner Test',phoneNumber:'0901234567',role}});expect(r.status()).toBe(200);const auth=await r.json();
  if(role==='Cleaner' && approve)await review(request,auth.user.cleanerProfile.id);
  return {...auth,email};
}
async function login(page,email) {await page.goto('/');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Mật khẩu',{exact:true}).fill(password);await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();}
async function booking(request,offset=2) {
  const customer=await account(request,'Customer');
  const r=await request.post(`${API}/api/bookings`,{headers:{Authorization:`Bearer ${customer.token}`},data:{serviceKey:'cleaning',startTime:new Date(Date.now()+offset*86400000).toISOString(),durationHours:2,address:'123 Cleaner Test Street',paymentMethod:'cash',notes:'Test cleaner workspace'}});
  expect(r.status()).toBe(200);return r.json();
}
test.beforeEach(async({page})=>{page.errors=[];page.on('pageerror',e=>page.errors.push(e.message));});
test.afterEach(async({page})=>expect(page.errors).toEqual([]));
test('pending applicant resubmits requested information and gains work access after approval',async({page,request})=>{
  const applicant=await account(request,'Cleaner',false);await login(page,applicant.email);
  await expect(page.getByRole('button',{name:'Đang chờ xét duyệt'})).toBeDisabled();
  await expect(page.getByRole('link',{name:'Tìm việc',exact:true})).toHaveCount(0);
  expect((await request.get(`${API}/api/cleaner/jobs/mine`,{headers:{Authorization:`Bearer ${applicant.token}`}})).status()).toBe(403);
  await review(request,applicant.user.cleanerProfile.id,'NeedsInfo','Bổ sung kinh nghiệm');
  await page.getByRole('button',{name:'Tải lại trạng thái hồ sơ'}).click();
  await expect(page.getByText('Bổ sung kinh nghiệm',{exact:true})).toBeVisible();
  await page.getByLabel('Giới thiệu',{exact:true}).fill('Có kinh nghiệm dọn nhà');
  await page.getByRole('button',{name:'Gửi lại hồ sơ',exact:true}).click();
  await expect(page.getByRole('button',{name:'Đang chờ xét duyệt'})).toBeDisabled();
  await review(request,applicant.user.cleanerProfile.id);
  await page.getByRole('button',{name:'Tải lại trạng thái hồ sơ'}).click();
  await expect(page.getByRole('link',{name:'Tìm việc',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Thông báo',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Hồ sơ cleaner đã được duyệt',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Đánh dấu tất cả đã đọc'}).click();
  await expect(page.getByText('Chưa đọc: 0',{exact:true})).toBeVisible();
  await page.reload();await expect(page.getByText('Chưa đọc: 0',{exact:true})).toBeVisible();
});
test('cleaner accepts starts completes and declares actual cash receipt without duplicate actions',async({page,request})=>{
  const cleaner=await account(request),job=await booking(request);
  await login(page,cleaner.email);await page.getByRole('link',{name:'Tìm việc',exact:true}).click();
  let card=page.locator(`[data-booking-id="${job.id}"]`);
  await card.getByRole('button',{name:'Nhận việc',exact:true}).click();
  await page.getByRole('link',{name:'Công việc của tôi',exact:true}).click();
  await card.getByRole('button',{name:'Bắt đầu công việc'}).click();
  await expect(card).toContainText('Bắt đầu thực tế:');
  await card.getByRole('button',{name:'Hoàn thành công việc',exact:true}).click();
  await expect(card).toContainText('Hoàn thành thực tế:');
  page.once('dialog',d=>d.dismiss());await card.getByRole('button',{name:'Xác nhận đã nhận tiền mặt'}).click();
  await expect(card.getByRole('button',{name:'Xác nhận đã nhận tiền mặt'})).toBeVisible();
  page.once('dialog',d=>d.accept());await card.getByRole('button',{name:'Xác nhận đã nhận tiền mặt'}).click();
  await expect(card).toContainText('Bạn đã xác nhận nhận đủ tiền mặt');
  await expect(card.getByRole('button')).toHaveCount(0);await page.reload();await expect(card).toContainText('Bạn đã xác nhận nhận đủ tiền mặt');
  const mine=await request.get(`${API}/api/cleaner/jobs/mine`,{headers:{Authorization:`Bearer ${cleaner.token}`}});expect((await mine.json()).find(j=>j.id===job.id)).toMatchObject({status:'Completed',paymentStatus:'Paid'});
  await page.getByRole('link',{name:'Tổng quan',exact:true}).click();await expect(page.locator('#view')).toContainText('140.000 đ');
});
test('stale claim reloads available jobs and only one cleaner owns the booking',async({page,request})=>{
  const first=await account(request),other=await account(request),job=await booking(request,4);
  await login(page,first.email);await page.getByRole('link',{name:'Tìm việc',exact:true}).click();const card=page.locator(`[data-booking-id="${job.id}"]`);await expect(card).toBeVisible();
  expect((await request.put(`${API}/api/cleaner/jobs/${job.id}/accept`,{headers:{Authorization:`Bearer ${other.token}`}})).status()).toBe(200);
  await card.getByRole('button',{name:'Nhận việc',exact:true}).click();await expect(card).toHaveCount(0);await expect(page.locator('#notice')).not.toBeEmpty();
  const mine=await request.get(`${API}/api/cleaner/jobs/mine`,{headers:{Authorization:`Bearer ${first.token}`}});expect((await mine.json()).some(j=>j.id===job.id)).toBe(false);
});
test('cleaner profile persists real values and logout removes access',async({page,request})=>{
  const cleaner=await account(request);await login(page,cleaner.email);await page.getByRole('link',{name:'Hồ sơ',exact:true}).click();
  await page.getByLabel('Họ tên',{exact:true}).fill('Nguyễn Cleaner');await page.getByLabel('Thành phố',{exact:true}).fill('Đà Nẵng');await page.getByLabel('Giới thiệu',{exact:true}).fill('Làm việc cẩn thận');
  await page.getByRole('button',{name:'Lưu hồ sơ',exact:true}).click();await expect(page.locator('#notice')).toContainText('Đã lưu hồ sơ');await page.reload();
  await expect(page.getByLabel('Họ tên',{exact:true})).toHaveValue('Nguyễn Cleaner');await expect(page.getByLabel('Thành phố',{exact:true})).toHaveValue('Đà Nẵng');
  await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await page.reload();await expect(page.getByRole('button',{name:'Đăng nhập',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Tìm việc',exact:true})).toHaveCount(0);
});
test('new applicant can register in the cleaner portal without granting work access',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Đăng ký làm cleaner',exact:true}).click();
  await page.getByLabel('Họ tên',{exact:true}).fill('New Cleaner');await page.getByLabel('Số điện thoại',{exact:true}).fill('0901234567');await page.getByLabel('Email',{exact:true}).fill(`${randomUUID()}@example.test`);await page.getByLabel('Mật khẩu',{exact:true}).fill(password);await page.getByRole('button',{name:'Gửi đăng ký',exact:true}).click();
  await expect(page.getByRole('button',{name:'Đang chờ xét duyệt'})).toBeDisabled();await expect(page.getByRole('link',{name:'Tìm việc',exact:true})).toHaveCount(0);
});
