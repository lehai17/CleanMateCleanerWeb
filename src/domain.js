export const approved = user => user?.role === 'Cleaner' && user?.isCleaner === true && user?.cleanerProfile?.reviewStatus === 'Approved';
export const eligible = user => ['Customer', 'Cleaner'].includes(user?.role);
export function actionFor(job) {
  if (job.status === 'Pending') return 'accept';
  if (job.status === 'Accepted') return 'start';
  if (job.status === 'InProgress') return 'complete';
  if (job.status === 'Completed' && job.paymentMethod === 'cash' && job.paymentStatus !== 'Paid') return 'cash-payment';
  return null;
}
export function stats(jobs) {
  const completed = jobs.filter(job => job.status === 'Completed');
  return { active: jobs.filter(job => ['Accepted', 'InProgress'].includes(job.status)).length, completed: completed.length,
    declaredCash: completed.filter(job => job.paymentMethod === 'cash' && job.paymentStatus === 'Paid').reduce((sum, job) => sum + Number(job.price), 0) };
}
export function validDay(value) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0,10) === value;
}
export function vietnamDay(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(parsed);
  return ['year','month','day'].map(type => parts.find(part => part.type === type).value).join('-');
}
const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase();
export function filterJobs(jobs, {search='',status='All',day='',calendar=false,bookingId=null} = {}) {
  if (!validDay(day)) return [];
  const query = normalized(search.trim());
  const code = /^cm0*(\d+)$/.exec(query);
  const result = jobs.filter(job => (!calendar || ['Accepted','InProgress'].includes(job.status)) &&
    (status === 'All' || job.status === status) && (!day || vietnamDay(job.startTime) === day) &&
    (!bookingId || job.id === Number(bookingId)) &&
    (!query || (code ? job.id === Number(code[1]) : normalized(`CM${job.id} ${job.customerName || ''} ${job.customerPhone || ''} ${job.address || ''}`).includes(query))));
  return [...result].sort((a,b) => new Date(a.startTime) - new Date(b.startTime) || a.id-b.id);
}
export function phoneUrl(value) {
  const phone = String(value || '').replace(/[\s().-]/g,'');
  return /^\+?\d{8,15}$/.test(phone) ? `tel:${phone}` : null;
}
export function mapsUrl(value) {
  const address = String(value || '').trim();
  return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;
}
