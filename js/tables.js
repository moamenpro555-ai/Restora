(async () => {
  const v = await boot('الطاولات', 'tables.manage', { foot: { text: 'شريكك في نجاح مطعمك ...', icon: 'support' } }); if (!v) return;
  const grid = h('div', { class: 'floor' });
  const base = location.href.replace(/[^/]*$/, '') + 'menu.html?restaurant=' + encodeURIComponent(ME.tenant.slug);
  const ST = { AVAILABLE: 'متاحة', OCCUPIED: 'مشغولة', RESERVED: 'محجوزة' };
  const TONE = { AVAILABLE: 'ok', OCCUPIED: 'err', RESERVED: 'info' };
  let rows = [], filter = '', term = '';
  // Static illustration (no user data) - wooden table with two chairs.
  const ART = '<svg viewBox="0 0 160 96" aria-hidden="true"><g fill="#223a63"><rect x="12" y="24" width="16" height="32" rx="5"/><rect x="10" y="56" width="24" height="7" rx="3"/><rect x="15" y="63" width="4" height="24" rx="2"/><rect x="27" y="63" width="4" height="24" rx="2"/><rect x="132" y="24" width="16" height="32" rx="5"/><rect x="126" y="56" width="24" height="7" rx="3"/><rect x="129" y="63" width="4" height="24" rx="2"/><rect x="141" y="63" width="4" height="24" rx="2"/></g><path d="M54 52l-7 35M106 52l7 35M80 56v32" stroke="#b9783a" stroke-width="5" stroke-linecap="round"/><ellipse cx="80" cy="48" rx="48" ry="12" fill="#c98a4b"/><ellipse cx="80" cy="45" rx="48" ry="11" fill="#e9b87f"/></svg>';
  const art = () => { const d = h('div', { class: 'art' }); d.innerHTML = ART; return d; };
  async function load() {
    clear(grid); grid.append(loading());
    try { rows = await API.get('/tables'); draw(); }
    catch (e) { clear(grid); grid.append(h('div', { class: 'card empty fullc' }, e.message)); }
  }
  function draw() {
    clear(grid);
    const multi = new Set(rows.map(t => t.branchId)).size > 1;
    const list = rows.filter(t => (!filter || t.status === filter) && (!term || String(t.number).includes(term.trim())));
    if (!list.length) grid.append(h('div', { class: 'card empty fullc' }, rows.length ? 'لا توجد طاولات مطابقة' : 'لا توجد طاولات'));
    for (const t of list) grid.append(h('div', { class: 'tcard ' + t.status },
      h('div', { class: 'tcard-top' }, h('div', null, h('h2', null, 'طاولة رقم ' + t.number), h('div', { class: 'tc-sub' }, `${t.seats} مقاعد` + (multi && t.branch ? ' - ' + t.branch.name : ''))), chip(ST[t.status], TONE[t.status], t.status === 'RESERVED' ? 'calendar' : 'dot')),
      art(),
      t.orders.length ? h('div', { class: 'ords' }, t.orders.map(o => h('div', null, 'طلب ', h('span', { class: 'ltr' }, '#' + o.number), ' - ', h('span', { class: 'ltr' }, money(o.total))))) : null,
      h('button', { class: 'btn detail', onclick: () => details(t) }, icon('eye', 18), 'عرض التفاصيل')));
  }
  function details(t) {
    const m = modal('طاولة رقم ' + t.number, h('div', null,
      h('div', { class: 'row' }, chip(ST[t.status], TONE[t.status], 'dot')),
      h('div', { class: 'dt-grid' }, h('div', null, h('small', null, 'المقاعد'), h('b', null, t.seats)), h('div', null, h('small', null, 'الفرع'), h('b', null, t.branch ? t.branch.name : '-'))),
      t.orders.length ? h('div', null, h('strong', null, 'الطلبات الحالية'), t.orders.map(o => h('div', { class: 'cart-line' }, h('span', null, 'طلب ', h('span', { class: 'ltr' }, '#' + o.number)), h('span', { class: 'ltr' }, money(o.total))))) : h('div', { class: 'muted' }, 'لا توجد طلبات حالية'),
      h('div', { class: 'row', style: 'margin-top:14px' },
        h('button', { class: 'btn secondary sm', onclick: () => { m.close(); qr(t); } }, 'QR'), h('button', { class: 'btn secondary sm', onclick: () => { m.close(); form(t); } }, 'تعديل'),
        t.orders.length ? h('button', { class: 'btn secondary sm', onclick: () => { m.close(); transfer(t, rows); } }, 'نقل') : null,
        h('button', { class: 'btn sm danger', onclick: async () => { if (await confirmBox('حذف الطاولة؟')) { m.close(); await API.del('/tables/' + t.id).catch(fail); load(); } } }, 'حذف'))));
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
  v.append(pageHead('الطاولات', 'قم بإدارة طاولات المطعم ومتابعة حالتها في الوقت الفعلي', 'table', h('button', { class: 'btn lg', onclick: () => form() }, icon('plus', 20), 'إضافة طاولة')),
    h('div', { class: 'filters' },
      h('div', { class: 'grp' }, pillTabs([['', 'الكل'], ['AVAILABLE', 'متاحة', 'dot', 'ok'], ['OCCUPIED', 'مشغولة', 'dot', 'err'], ['RESERVED', 'محجوزة', 'calendar', 'info']], k => { filter = k; draw(); })),
      searchBox('ابحث عن طاولة...', x => { term = x; draw(); })),
    grid);
  load();
})();
