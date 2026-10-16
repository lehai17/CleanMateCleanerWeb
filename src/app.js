import { api, session } from './api.js';
import {showSupport} from './support.js';
import { approved, eligible, actionFor, stats, filterJobs, phoneUrl, mapsUrl } from './domain.js';
const root = document.querySelector('#app');
const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const money = value => `${Number(value || 0).toLocaleString('vi-VN')} đ`;
const date = value => value ? new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}) : '—';
const labels = { Pending:'Chờ duyệt', Approved:'Đã duyệt', NeedsInfo:'Cần bổ sung', Rejected:'Từ chối', Accepted:'Đã nhận', InProgress:'Đang làm', Completed:'Hoàn thành', Cancelled:'Đã hủy' };
const actions = { accept:'Nhận việc', start:'Bắt đầu công việc', complete:'Hoàn thành công việc', 'cash-payment':'Xác nhận đã nhận tiền mặt' };
let user, revision = 0, busy = false, noticeItems = [], cursor;
const route = () => location.hash.slice(2).split('?')[0] || 'dashboard';
const selectedBooking = () => {
  const value = new URLSearchParams(location.hash.split('?')[1] || '').get('booking');
  return /^\d+$/.test(value || '') && Number(value) > 0 ? Number(value) : null;
};
const emptyFilters = () => ({search:'',status:'All',day:''});
const jobFilters = {available:emptyFilters(),jobs:emptyFilters(),calendar:emptyFilters()};
function message(text) { const el = document.querySelector('#notice'); if (el) { el.className = text ? 'alert' : ''; el.textContent = text; } }
function fail(error) { if (error.status === 401) { session.clear(); user = null; login(error.message); } else message(error.message); }
function field(label, name, value = '', type = 'text', max = 200, required = true) {
  return `<label>${label}<input name="${name}" type="${type}" value="${h(value)}" maxlength="${max}" ${required ? 'required' : ''}></label>`;
}
function login(error = '', register = false) {
  revision++;
  root.innerHTML = `<div class="login"><aside class="login-aside"><div class="brand">Clean<span>Mate</span> Cleaner</div><h1>Chủ động công việc.<br>An tâm mỗi ca làm.</h1><p>Nhận việc phù hợp, theo dõi lịch làm và quản lý hồ sơ của bạn.</p></aside><main class="login-main"><p class="eyebrow">Dành cho cộng tác viên</p><h2>${register ? 'Đăng ký làm cleaner' : 'Đăng nhập'}</h2><div id="notice" class="${error ? 'alert' : ''}">${h(error)}</div><form id="auth">${register ? field('Họ tên','fullName') + field('Số điện thoại','phoneNumber','','tel',20) : ''}${field('Email','email','','email',254)}${field('Mật khẩu','password','','password',128)}<button>${register ? 'Gửi đăng ký' : 'Đăng nhập'}</button></form><button id="switch" class="secondary">${register ? 'Đã có tài khoản? Đăng nhập' : 'Đăng ký làm cleaner'}</button><p class="muted">Hồ sơ cần được nhân viên duyệt trước khi nhận việc.</p></main></div>`;
  document.querySelector('#switch').onclick = () => login('', !register);
  document.querySelector('#auth').onsubmit = async event => {
    event.preventDefault(); const form = event.currentTarget, button = form.querySelector('button'); button.disabled = true;
    try {
      const data = Object.fromEntries(new FormData(form));
      if (register) data.role = 'Cleaner';
      const result = await api(register ? '/auth/register' : '/auth/login', { method:'POST', data });
      if (!eligible(result.user)) throw new Error('Vui lòng sử dụng tài khoản khách hàng/cleaner để đăng ký hoặc làm việc.');
      session.set(result.token); user = result.user; await render();
    } catch (error) { message(error.message); form.elements.password.value = ''; }
    finally { button.disabled = false; }
  };
}
function layout(current) {
  const links = approved(user) ? [['dashboard','Tổng quan'],['available','Tìm việc'],['jobs','Công việc của tôi'],['calendar','Lịch làm việc'],['support','Hỗ trợ'],['notifications','Thông báo'],['profile','Hồ sơ']] : [['profile','Hồ sơ'],['support','Hỗ trợ'],['notifications','Thông báo']];
  root.innerHTML = `<div class="layout"><aside class="sidebar"><div><div class="brand">Clean<span>Mate</span></div><small>Không gian cộng tác viên</small></div><nav aria-label="Cleaner">${links.map(([key,label]) => `<a href="#/${key}" ${key === current ? 'class="active" aria-current="page"' : ''}>${label}</a>`).join('')}</nav><div class="account"><strong>${h(user.fullName)}</strong><p>${h(user.email)}</p><button id="logout">Đăng xuất</button></div></aside><div class="workspace"><header class="topbar"><h1>${h(links.find(([key]) => key === current)?.[1] || 'Hồ sơ')}</h1><span class="role">${approved(user) ? 'Cleaner đã duyệt' : 'Chờ xét hồ sơ'}</span></header><main class="content"><div id="notice" role="status"></div><section id="view" aria-live="polite">Đang tải...</section></main></div></div>`;
  document.querySelector('#logout').onclick = () => { session.clear(); user = null; Object.keys(jobFilters).forEach(key => jobFilters[key] = emptyFilters()); login(); };
}
function jobCard(job, hasActive) {
  const action = actionFor(job), blocked = action === 'start' && hasActive;
  const phone = phoneUrl(job.customerPhone), map = mapsUrl(job.address);
  return `<article class="job-card" data-booking-id="${job.id}" id="job-${job.id}">
    <div class="section-head"><h3>CM${job.id}</h3><span class="status ${h(job.status)}">${job.status === 'Pending' ? 'Chờ nhận' : h(labels[job.status])}</span></div>
    <p><strong>${h(job.customerName)}</strong> · ${h(job.customerPhone || 'Chưa có số liên hệ')}</p>
    <p>${h(date(job.startTime))} → ${h(date(new Date(new Date(job.startTime).getTime() + job.durationHours * 3600000)))} · ${job.durationHours} giờ</p>
    <p>${h(job.address)}</p><p>${h(job.notes)}</p><p class="job-price">${money(job.price)}</p>
    <p>${job.paymentMethod === 'cash' ? job.paymentStatus === 'Paid' ? 'Bạn đã xác nhận nhận đủ tiền mặt' : 'Khách trả tiền mặt trực tiếp sau ca' : 'Thông tin thanh toán lưu từ trước'}</p>
    ${job.startedAt ? `<p>Bắt đầu thực tế: ${h(date(job.startedAt))}</p>` : ''}${job.completedAt ? `<p>Hoàn thành thực tế: ${h(date(job.completedAt))}</p>` : ''}
    ${job.customerConfirmedAt ? `<p>Khách đã xác nhận · Đánh giá: ${job.customerRating}/5</p>` : ''}
    <div class="contact-links">${phone && job.status !== 'Pending' ? `<a href="${h(phone)}">Gọi khách</a>` : ''}${map ? `<a href="${h(map)}" target="_blank" rel="noopener noreferrer">Xem bản đồ</a>` : ''}</div>
    ${blocked ? '<p>Hoàn thành ca đang làm trước khi bắt đầu ca tiếp theo.</p>' : ''}
    ${action ? `<button data-job="${job.id}" data-action="${action}" ${blocked ? 'disabled' : ''}>${actions[action]}</button>` : ''}</article>`;
}
function renderJobList(view, jobs, mine, current) {
  const selected = current === 'jobs' ? selectedBooking() : null;
  const filters = selected ? emptyFilters() : jobFilters[current];
  const statuses = current === 'calendar' ? ['All','Accepted','InProgress'] : ['All','Accepted','InProgress','Completed','Cancelled'];
  view.innerHTML = `<div class="section-head"><p>${current === 'available' ? 'Ca trùng lịch đã nhận được tự động ẩn.' : 'Hoàn thành ca đang làm trước khi bắt đầu ca tiếp theo.'}</p><button id="reload" class="secondary">Tải lại</button></div>
    ${selected ? `<p>Đang xem công việc CM${selected} từ thông báo. <a href="#/jobs">Xem tất cả công việc</a></p>` : ''}
    <form id="job-filters" class="filters"><label>Tìm công việc<input name="search" maxlength="100" placeholder="Mã CM, khách hàng, địa chỉ" value="${h(filters.search)}" ${selected ? 'disabled' : ''}></label>
    <label>Ngày làm việc<input name="day" type="date" value="${h(filters.day)}" ${selected ? 'disabled' : ''}></label>
    ${current !== 'available' ? `<label>Trạng thái<select name="status" aria-label="Trạng thái" ${selected ? 'disabled' : ''}>${statuses.map(value => `<option value="${value}" ${filters.status === value ? 'selected' : ''}>${value === 'All' ? 'Tất cả' : labels[value]}</option>`).join('')}</select></label>` : ''}
    <button ${selected ? 'disabled' : ''}>Lọc công việc</button><button type="button" id="clear-filters" class="secondary" ${selected ? 'disabled' : ''}>Xóa bộ lọc</button></form>
    <p id="result-count" role="status"></p><div id="job-results" class="job-grid"></div>`;
  const draw = () => {
    const visible = filterJobs(jobs, {...jobFilters[current],calendar:current === 'calendar',...(selected ? {...emptyFilters(),bookingId:selected} : {})});
    document.querySelector('#result-count').textContent = `${visible.length} công việc phù hợp · Ngày theo giờ Việt Nam`;
    document.querySelector('#job-results').innerHTML = visible.map(job => jobCard(job,mine.some(item => item.status === 'InProgress'))).join('') || `<p>${selected ? 'Không tìm thấy ca này trong công việc của bạn. Tải lại hoặc xem tất cả công việc.' : 'Chưa có công việc phù hợp. Thử đổi ngày hoặc xóa bộ lọc.'}</p>`;
    bindJobs();
  };
  document.querySelector('#job-filters').onsubmit = event => {
    event.preventDefault(); if (busy || selected) return;
    jobFilters[current] = {...emptyFilters(),...Object.fromEntries(new FormData(event.currentTarget))}; draw();
  };
  document.querySelector('#clear-filters').onclick = () => { if (busy) return; jobFilters[current] = emptyFilters(); const form = document.querySelector('#job-filters'); form.elements.search.value = ''; form.elements.day.value = ''; if (form.elements.status) form.elements.status.value = 'All'; draw(); };
  document.querySelector('#reload').onclick = render; draw();
}
function bindJobs() {
  document.querySelectorAll('[data-job]').forEach(button => button.onclick = async () => {
    if (busy) return;
    if (button.dataset.action === 'cash-payment' && !confirm(`Bạn đã nhận đủ tiền mặt trực tiếp từ khách cho CM${button.dataset.job}?`)) return;
    busy = true; document.querySelectorAll('[data-job]').forEach(b => b.disabled = true);
    let result = 'Đã cập nhật công việc.';
    try { await api(`/cleaner/jobs/${button.dataset.job}/${button.dataset.action}`, { method:'PUT' }); }
    catch (error) { if (error.status === 401) { busy = false; fail(error); return; } result = error.message; }
    finally { busy = false; }
    await render(); message(result);
  });
}
function profile(view) {
  const p = user.cleanerProfile, active = approved(user), pending = p?.reviewStatus === 'Pending';
  view.innerHTML = `<div class="panel"><h2>${active ? 'Hồ sơ cộng tác viên' : 'Đăng ký và xét duyệt'}</h2><p>${h(user.email)}</p><p>Trạng thái: <strong>${h(labels[p?.reviewStatus] || 'Chưa đăng ký')}</strong></p>${p?.reviewReason ? `<div class="alert">${h(p.reviewReason)}</div>` : ''}<button id="refresh-profile" class="secondary">Tải lại trạng thái hồ sơ</button><form id="profile" class="form-grid">${field('Họ tên','fullName',user.fullName)}${field('Số điện thoại','phoneNumber',user.phoneNumber,'tel',20)}${field('Thành phố','city',p?.city || 'Ha Noi')}${field('Địa chỉ','addressText',p?.addressText || user.address || '', 'text',500,false)}<label>Giới thiệu<textarea aria-label="Giới thiệu" name="bio" maxlength="2000" rows="4">${h(p?.bio)}</textarea></label><button ${pending ? 'disabled' : ''}>${pending ? 'Đang chờ xét duyệt' : active ? 'Lưu hồ sơ' : p ? 'Gửi lại hồ sơ' : 'Gửi hồ sơ cleaner'}</button></form><p class="muted">Giá dịch vụ do CleanMate cấu hình. Khách thanh toán tiền mặt trực tiếp sau ca.</p></div>`;
  document.querySelector('#refresh-profile').onclick = async () => { try { user = await api('/me'); await render(); } catch (e) { fail(e); } };
  document.querySelector('#profile').onsubmit = async event => {
    event.preventDefault(); if (busy || pending) return; busy = true;
    const button = event.currentTarget.querySelector('button'); button.disabled = true;
    try {
      const data = Object.fromEntries(new FormData(event.currentTarget));
      data.hourlyRate = p?.hourlyRate || 0;
      if (active) user = await api('/cleaner/profile', { method:'PUT', data });
      else {
        user = await api('/profile/', { method:'PUT', data: { fullName:data.fullName, phoneNumber:data.phoneNumber, address:data.addressText } });
        user = await api(p ? '/profile/cleaner-application' : '/profile/register-cleaner', { method:p ? 'PUT' : 'POST', data });
      }
      await render(); message(active ? 'Đã lưu hồ sơ.' : 'Đã gửi hồ sơ. Vui lòng chờ nhân viên duyệt.');
    } catch (e) { fail(e); } finally { busy = false; button.disabled = false; }
  };
}
async function notifications(view, stamp) {
  const data = await api('/notifications'); if (stamp !== revision) return;
  noticeItems = data.items; cursor = data.nextBeforeId;
  const draw = () => {
    view.innerHTML = `<div class="section-head"><p>Chưa đọc: ${data.unreadCount}</p><button id="read-all" ${!noticeItems.length || !data.unreadCount ? 'disabled' : ''}>Đánh dấu tất cả đã đọc</button></div><div class="job-grid">${noticeItems.map(item => `<article class="job-card"><h3>${h(item.title)}</h3><p>${h(item.message)}</p><p>${h(date(item.createdAt))} · ${item.readAt ? 'Đã đọc' : 'Chưa đọc'}</p><button data-open="${item.id}" class="secondary">${item.target === 'Profile' ? 'Xem hồ sơ' : 'Xem công việc'}</button>${!item.readAt ? `<button data-read="${item.id}">Đánh dấu đã đọc</button>` : ''}</article>`).join('') || '<p>Chưa có thông báo.</p>'}</div>${cursor ? '<button id="more">Xem thêm</button>' : ''}`;
    document.querySelector('#read-all').onclick = () => mark(null);
    document.querySelectorAll('[data-read]').forEach(b => b.onclick = () => mark(Number(b.dataset.read)));
    document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => {
      const item = noticeItems.find(n => n.id === Number(b.dataset.open));
      if (item.target === 'Support') {location.hash = '#/support';return;}
      if (item.target === 'Orders') { message('Thông báo này thuộc đơn khách hàng. Vui lòng mở web/app khách hàng để xem.'); return; }
      if (item.target === 'Profile' || !approved(user)) location.hash = '#/profile';
      else { jobFilters.jobs = emptyFilters(); location.hash = Number.isSafeInteger(item.bookingId) && item.bookingId > 0 ? `#/jobs?booking=${item.bookingId}` : '#/jobs'; }
    });
    if (cursor) document.querySelector('#more').onclick = async event => {
      event.currentTarget.disabled = true;
      try { const next = await api(`/notifications?beforeId=${cursor}`); if (stamp !== revision) return; noticeItems.push(...next.items.filter(n => !noticeItems.some(old => old.id === n.id))); cursor = next.nextBeforeId; data.unreadCount = next.unreadCount; draw(); }
      catch (e) { fail(e); if (document.querySelector('#more')) document.querySelector('#more').disabled = false; }
    };
  };
  const mark = async id => {
    if (busy) return; busy = true;
    try { await api(id ? `/notifications/${id}/read` : '/notifications/read-all', { method:'PUT', data:id ? undefined : { throughId:noticeItems[0].id } }); await render(); }
    catch (e) { fail(e); } finally { busy = false; }
  };
  draw();
}
async function render() {
  if (!user) return login();
  const stamp = ++revision;
  let current = route();
  if (!approved(user) && !['notifications','support'].includes(current)) current = 'profile';
  layout(current); const view = document.querySelector('#view');
  try {
    if (current === 'profile') return profile(view);
    if (current === 'notifications') return await notifications(view, stamp);
    if (current === 'support') return await showSupport({view,api,h,isCurrent:()=>stamp===revision,fail});
    const mine = await api('/cleaner/jobs/mine'); if (stamp !== revision) return;
    if (current === 'dashboard') {
      const summary = stats(mine);
      view.innerHTML = `<p class="eyebrow">Sẵn sàng cho ca làm tiếp theo</p><h2>Công việc rõ ràng, lịch làm chủ động.</h2><div class="stats"><div class="stat"><span>Ca sắp làm / đang làm</span><strong>${summary.active}</strong></div><div class="stat"><span>Ca đã hoàn thành</span><strong>${summary.completed}</strong></div><div class="stat"><span>Tiền mặt bạn đã xác nhận nhận</span><strong>${money(summary.declaredCash)}</strong></div></div><p>Khách trả tiền trực tiếp cho bạn. Đây là tổng tiền bạn tự xác nhận đã nhận, không phải số dư hay khoản app sẽ chuyển.</p><a class="button-link" href="#/available">Tìm công việc mới</a>`;
      return;
    }
    const available = current === 'available' ? await api('/cleaner/jobs/available') : null; if (stamp !== revision) return;
    if (!['available','jobs','calendar'].includes(current)) { location.hash = '#/dashboard'; return; }
    renderJobList(view,available || mine,mine,current);
  } catch (e) { if (stamp === revision) { view.innerHTML = '<button id="retry">Thử lại</button>'; document.querySelector('#retry').onclick = render; fail(e); } }
}
window.addEventListener('hashchange', () => { if (!busy) render(); });
async function init() {
  if (!session.get()) return login();
  root.textContent = 'Đang kiểm tra tài khoản...';
  try { user = await api('/me'); if (!eligible(user)) { session.clear(); user = null; return login('Tài khoản này không thuộc khu vực cleaner.'); } await render(); }
  catch (e) { if (e.status === 401) { session.clear(); user = null; login(e.message); } else { root.innerHTML = '<p>Không thể kết nối. Kiểm tra API và thử lại.</p><button id="retry-init">Thử lại</button>'; document.querySelector('#retry-init').onclick = init; } }
}
init();
