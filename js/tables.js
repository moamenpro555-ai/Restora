(async () => {
  const v = await boot('الطاولات', 'tables.manage'); if (!v) return;
  const grid = h('div', { class: 'floor' });
  const base = location.href.replace(/[^/]*$/, '') + 'menu.html?restaurant=' + encodeURIComponent(ME.tenant.slug);
  const ST = { AVAILABLE: 'متاحة', OCCUPIED: 'مشغولة', RESERVED: 'محجوزة' };
  async function load() {
    clear(grid); grid.append(loading());
    try {
      const rows = await API.get('/tables'); clear(grid);
      if (!rows.length) grid.append(h('div', { class: 'card empty' }, 'لا توجد طاولات'));
      for (const t of rows) grid.append(h('div', { class: 'card tbl ' + t.status },
        h('h2', null, 'طاولة ' + t.number), h('div', { class: 'muted' }, `${t.seats} مقاعد - ${t.branch.name}`), h('span', { class: 'badge' }, ST[t.status]),
        t.orders.length ? h('div', null, t.orders.map(o => h('div', null, `طلب #${o.number} - ${money(o.total)}`))) : null,
        h('div', { class: 'row', style: 'justify-content:center;margin-top:8px' }, h('button', { class: 'btn sm secondary', onclick: () => qr(t) }, 'QR'), h('button', { class: 'btn sm secondary', onclick: () => form(t) }, 'تعديل'),
          t.orders.length ? h('button', { class: 'btn sm secondary', onclick: () => transfer(t, rows) }, 'نقل') : null,
          h('button', { class: 'btn sm danger', onclick: async () => { if (await confirmBox('حذف الطاولة؟')) { await API.del('/tables/' + t.id).catch(fail); load(); } } }, 'حذف'))));
    } catch (e) { clear(grid); grid.append(h('div', { class: 'card empty' }, e.message)); }
  }
  const form = t => formModal({ title: t ? 'تعديل طاولة' : 'طاولة جديدة', values: t || { seats: 4 }, fields: [{ name: 'number', label: 'الرقم', required: true }, { name: 'seats', label: 'المقاعد', type: 'number' }, ...(t ? [{ name: 'status', label: 'الحالة', type: 'select', options: Object.entries(ST).map(([value, label]) => ({ value, label })) }] : [])],
    onSubmit: async d => { if (t) await API.patch('/tables/' + t.id, d); else await API.post('/tables', d); load(); } });
  function transfer(t, all) {
    const free = all.filter(x => x.branchId === t.branchId && !x.orders.length);
    formModal({ title: 'نقل طلب طاولة ' + t.number, fields: [{ name: 'tableId', label: 'إلى طاولة', type: 'select', required: true, options: free.map(x => ({ value: x.id, label: 'طاولة ' + x.number })) }],
      onSubmit: async d => { await API.patch(`/orders/${t.orders[0].id}/table`, d); load(); } });
  }
  function qr(t) {
    // table numbers are only unique per branch, so the link carries the branch id
    const url = base + '&table=' + encodeURIComponent(t.number) + '&branch=' + encodeURIComponent(t.branchId); const box = h('div', { style: 'display:flex;justify-content:center;padding:12px' });
    modal('QR - طاولة ' + t.number, h('div', null, box, h('p', { class: 'muted', style: 'word-break:break-all' }, url), h('button', { class: 'btn', onclick: () => {
      const pa = $('#print-area'); clear(pa); const pb = h('div', { style: 'display:flex;justify-content:center' });
      pa.append(h('div', { style: 'text-align:center' }, h('h2', null, ME.tenant.name), h('h3', null, 'طاولة ' + t.number), pb, h('p', null, 'امسح الكود لعرض المنيو وإرسال طلبك')));
      new QRCode(pb, { text: url, width: 220, height: 220 }); setTimeout(() => window.print(), 150);
    } }, 'طباعة')));
    if (window.QRCode) new QRCode(box, { text: url, width: 220, height: 220 }); else box.append('تعذر تحميل مكتبة QR (تحقق من الاتصال بالإنترنت)');
  }
  v.append(h('div', { class: 'toolbar' }, h('button', { class: 'btn', onclick: () => form() }, '+ طاولة'), h('span', { class: 'muted' }, 'المسح عبر QR يربط الطلب بالطاولة تلقائيًا (إن كان الطلب عبر QR مفعّلًا).')), grid);
  load();
})();
