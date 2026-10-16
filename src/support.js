import {conversation} from './conversation.js';
export const categories = {Scheduling:'Lịch làm / không đến',Quality:'Chất lượng công việc',CashPayment:'Tiền mặt với khách/cleaner',Other:'Vấn đề khác'};
const statuses = {Open:'Đã tiếp nhận',InProgress:'Đang xử lý',Resolved:'Đã giải quyết'};
export async function showSupport({view,api,h,isCurrent,fail}) {
  let page = 1, request = null, submitting = false;
  const [bookings] = await Promise.all([api('/support/bookings')]);
  if (!isCurrent()) return;
  view.innerHTML = `<h2>Hỗ trợ đơn hàng</h2><p>Báo sự cố lịch làm, chất lượng hoặc tiền mặt trực tiếp. Staff sẽ xem và phản hồi; hệ thống không tự thu/hoàn tiền hay thay đổi trạng thái ca.</p>
    <form id="support-form" class="panel form-grid"><label>Mã đơn<input name="bookingId" aria-label="Mã đơn" placeholder="Ví dụ: CM123" required maxlength="12" list="support-bookings"></label>
    <datalist id="support-bookings">${bookings.map(b => `<option value="CM${b.id}">${h(b.address)}</option>`).join('')}</datalist>
    <label>Loại sự cố<select name="category" aria-label="Loại sự cố">${Object.entries(categories).map(([key,label]) => `<option value="${key}">${label}</option>`).join('')}</select></label>
    <label>Mô tả<textarea name="description" aria-label="Mô tả" required minlength="10" maxlength="2000" rows="4"></textarea></label><p id="support-message" role="status"></p><button>Gửi yêu cầu hỗ trợ</button></form>
    <div class="section-head"><h3>Yêu cầu của tôi</h3><button id="refresh-support" class="secondary">Tải lại hỗ trợ</button></div><div id="support-list">Đang tải...</div>`;
  const message = value => {if(isCurrent())document.querySelector('#support-message').textContent=value;};
  const load = async () => {
    const data = await api(`/support?page=${page}`);if(!isCurrent())return;
    document.querySelector('#support-list').innerHTML = data.items.map(item => `<article class="job-card" data-support-id="${item.id}"><h3>HT${item.id} · CM${item.bookingId}</h3><p><strong>${statuses[item.status] || h(item.status)}</strong> · ${categories[item.category] || h(item.category)}</p><p>${h(item.description)}</p>${item.response ? `<p><strong>Phản hồi từ staff:</strong> ${h(item.response)}</p>` : '<p>Nhân viên chưa phản hồi.</p>'}</article>`).join('') || '<p>Bạn chưa có yêu cầu hỗ trợ.</p>';
    document.querySelector('#support-list').insertAdjacentHTML('beforeend',`<p>Trang ${page} · ${data.total} yêu cầu</p><button id="support-prev" ${page===1?'disabled':''}>Trang trước</button> <button id="support-next" ${page*20>=data.total?'disabled':''}>Trang sau</button>`);
    for(const [id,offset] of [['support-prev',-1],['support-next',1]])document.querySelector(`#${id}`).onclick=async event=>{event.currentTarget.disabled=true;const previous=page;page+=offset;try{await load();}catch(e){page=previous;fail(e);if(isCurrent())event.target.disabled=false;}};
    view.querySelectorAll('[data-support-id]').forEach(card=>{
      const container=document.createElement('div');card.appendChild(container);
      conversation({container,ticketId:Number(card.dataset.supportId),api,h,fail,isCurrent:()=>isCurrent()&&container.isConnected,onUpdated:result=>{const status=card.querySelector('strong');if(status&&result.status)status.textContent=statuses[result.status]||result.status;}});
    });
  };
  document.querySelector('#refresh-support').onclick=()=>load().catch(fail);
  document.querySelector('#support-form').onsubmit=async event=>{
    event.preventDefault();if(submitting)return;submitting=true;
    const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;
    try {
      const values=Object.fromEntries(new FormData(form));const bookingId=Number(values.bookingId.trim().replace(/^CM/i,''));
      const payload={bookingId,category:values.category,description:values.description.trim()};
      if(!Number.isSafeInteger(bookingId)||bookingId<=0||payload.description.length<10)throw new Error('Nhập mã đơn hợp lệ và mô tả từ 10 ký tự.');
      const key=JSON.stringify(payload);if(request?.key!==key)request={key,id:crypto.randomUUID()};
      const result=await api('/support',{method:'POST',data:{...payload,requestId:request.id}});
      request=null;if(!isCurrent())return;form.elements.description.value='';page=1;message(`Đã gửi yêu cầu HT${result.id}.`);await load();
    }catch(e){if(e.status===401)fail(e);else message(e.message || 'Không gửi được. Thử lại sẽ dùng cùng mã yêu cầu.');}
    finally{submitting=false;button.disabled=false;}
  };
  await load();
}
