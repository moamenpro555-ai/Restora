// Split-payment dialog shared by POS and Orders. Resolves with [{method,amount}] or null.
function collectPayment(remaining) {
  return new Promise(res => {
    const lines = [{ method: 'CASH', amount: remaining }];
    const box = h('div');
    const draw = () => {
      clear(box);
      lines.forEach((l, i) => box.append(h('div', { class: 'row' },
        h('select', { onchange: e => { l.method = e.target.value; } }, Object.entries(AR.method).map(([k, v]) => h('option', { value: k, selected: k === l.method }, v))),
        h('input', { type: 'number', step: '0.01', min: '0', value: l.amount, oninput: e => { l.amount = Number(e.target.value); upd(); } }),
        lines.length > 1 ? h('button', { class: 'btn secondary sm', type: 'button', onclick: () => { lines.splice(i, 1); draw(); upd(); } }, '✕') : null)));
    };
    const info = h('div', { class: 'totals' });
    const upd = () => { const s = lines.reduce((a, l) => a + (l.amount || 0), 0); clear(info); info.append(h('div', null, h('span', null, 'المطلوب'), h('span', null, money(remaining))), h('div', { class: 't' }, h('span', null, 'المدخل'), h('span', null, money(s))), h('div', null, h('span', null, 'المتبقي'), h('span', null, money(Math.max(0, remaining - s))))); ok.disabled = !(s > 0 && s <= remaining + 0.005); };
    const ok = h('button', { class: 'btn ok', onclick: () => { m.close(); res(lines.filter(l => l.amount > 0)); } }, 'تأكيد الدفع');
    const m = modal('تحصيل المبلغ', h('div', null, box, h('button', { class: 'btn secondary sm', type: 'button', onclick: () => { lines.push({ method: 'CARD', amount: 0 }); draw(); } }, '+ تقسيم الدفع'), info, h('div', { class: 'row', style: 'margin-top:12px' }, ok)));
    m.el.addEventListener('click', e => { if (e.target === m.el) res(null); });
    draw(); upd();
  });
}
async function printReceipt(order, brand) {
  const pa = $('#print-area'); clear(pa);
  const cur = (ME && ME.tenant && ME.tenant.currency) || '';
  pa.append(h('div', { style: 'text-align:center' }, brand && brand.logoUrl ? h('img', { src: brand.logoUrl, style: 'max-width:60px' }) : null, h('h3', null, ME.tenant.name), brand && brand.phone ? h('div', null, brand.phone) : null, h('div', null, `طلب #${order.number} - ${dt(order.createdAt)}`)),
    h('hr'), order.items.map(i => h('div', { class: 'row spread' }, h('span', null, `${i.quantity} × ${i.name}`), h('span', null, (Number(i.unitPrice) * i.quantity).toFixed(2)))),
    h('hr'), h('div', { class: 'row spread' }, h('span', null, 'المجموع'), h('span', null, Number(order.subtotal).toFixed(2))),
    Number(order.discount) ? h('div', { class: 'row spread' }, h('span', null, 'خصم'), h('span', null, '-' + Number(order.discount).toFixed(2))) : null,
    Number(order.tax) ? h('div', { class: 'row spread' }, h('span', null, 'ضريبة'), h('span', null, Number(order.tax).toFixed(2))) : null,
    Number(order.deliveryFee) ? h('div', { class: 'row spread' }, h('span', null, 'توصيل'), h('span', null, Number(order.deliveryFee).toFixed(2))) : null,
    h('div', { class: 'row spread' }, h('strong', null, 'الإجمالي'), h('strong', null, `${Number(order.total).toFixed(2)} ${cur}`)),
    h('p', { style: 'text-align:center' }, (brand && brand.receiptFooter) || 'شكرًا لزيارتكم'));
  window.print();
}
