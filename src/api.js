const key = 'cleanmate_cleaner_token';
export const session = { get: () => sessionStorage.getItem(key), set: value => sessionStorage.setItem(key, value), clear: () => sessionStorage.removeItem(key) };
export async function api(path, { method = 'GET', data } = {}) {
  const requestToken=session.get();
  const response = await fetch(`/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {}) }, body: data === undefined ? undefined : JSON.stringify(data), cache: 'no-store' });
  const body = await response.text(); let result;
  if(requestToken!==session.get()){const error=new Error('');error.staleSession=true;error.status=0;throw error;}
  try { result = JSON.parse(body); } catch { result = null; }
  if (!response.ok) { const error = new Error(result?.message || (response.status === 401 ? 'Phiên đăng nhập hết hạn hoặc thông tin đăng nhập không đúng.' : response.status === 403 ? 'Bạn chưa có quyền thực hiện thao tác này.' : 'Không thể xử lý yêu cầu. Vui lòng thử lại.')); error.status = response.status; throw error; }
  return result;
}
