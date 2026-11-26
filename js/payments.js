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
  const t = (ME && ME.tenant) || {};
  const cur = t.currency || 'EGP';
  const n = x => Number(x || 0).toFixed(2);
  const row = (a, b, cls) => h('div', { class: 'r-row' + (cls ? ' ' + cls : '') }, h('span', null, a), h('span', null, b));
  const tableNo = order.table && order.table.number;
  const paid = (order.payments || []).filter(p => !p.isRefund);
  pa.append(h('div', { class: 'rcpt' },
    h('div', { class: 'r-head' },
      brand && brand.logoUrl ? h('img', { class: 'r-logo', src: brand.logoUrl, alt: '' }) : null,
      h('h1', { class: 'r-name' }, t.name || ''),
      brand && brand.address ? h('div', { class: 'r-sub' }, brand.address) : null,
      brand && brand.phone ? h('div', { class: 'r-sub', style: 'direction:ltr' }, brand.phone) : null),
    h('hr', { class: 'r-sep' }),
    h('div', { class: 'r-meta' }, h('span', null, 'طلب #' + order.number), h('span', null, AR.type[order.type] || '')),
    h('div', { class: 'r-meta' }, h('span', null, dt(order.createdAt)), tableNo ? h('span', null, 'طاولة ' + tableNo) : h('span')),
    order.customerName ? h('div', { class: 'r-meta' }, h('span', null, 'العميل: ' + order.customerName), order.customerPhone ? h('span', { style: 'direction:ltr' }, order.customerPhone) : h('span')) : null,
    order.deliveryAddress ? h('div', { class: 'r-sub' }, 'العنوان: ' + order.deliveryAddress) : null,
    h('hr', { class: 'r-sep' }),
    h('table', null,
      h('thead', null, h('tr', null, h('th', null, 'الصنف'), h('th', { class: 'c-q' }, 'الكمية'), h('th', { class: 'c-p' }, 'السعر'))),
      h('tbody', null, (order.items || []).map(i => h('tr', null,
        h('td', null, i.name,
          Array.isArray(i.options) && i.options.length ? h('div', { class: 'r-opt' }, i.options.map(o => o.choice).join('، ')) : null,
          i.notes ? h('div', { class: 'r-opt' }, i.notes) : null),
        h('td', { class: 'c-q' }, i.quantity),
        h('td', { class: 'c-p' }, n(Number(i.unitPrice) * i.quantity)))))),
    h('hr', { class: 'r-sep solid' }),
    row('المجموع', n(order.subtotal)),
    Number(order.discount) ? row('خصم', '-' + n(order.discount)) : null,
    Number(order.tax) ? row('ضريبة', n(order.tax)) : null,
    Number(order.deliveryFee) ? row('توصيل', n(order.deliveryFee)) : null,
    row('الإجمالي', `${n(order.total)} ${cur}`, 'r-total'),
    paid.length ? h('div', { style: 'margin-top:4px' }, paid.map(p => row(AR.method[p.method] || p.method, n(p.amount)))) : null,
    h('hr', { class: 'r-sep' }),
    h('div', { class: 'r-foot' }, (brand && brand.receiptFooter) || 'شكرًا لزيارتكم')));
  // The browser prints document.title in the page header: use the restaurant name, not the platform name.
  const oldTitle = document.title; document.title = t.name || oldTitle;
  const restore = () => { document.title = oldTitle; window.removeEventListener('afterprint', restore); };
  window.addEventListener('afterprint', restore);
  setTimeout(() => window.print(), 100);
}
