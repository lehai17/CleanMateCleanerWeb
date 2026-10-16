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
