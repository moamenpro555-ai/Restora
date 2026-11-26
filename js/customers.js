(async () => {
  const v = await boot('العملاء', 'customers.manage', { tagline: 'إدارة أذكى .. لمطعم أكثر نجاحاً' }); if (!v) return;
  const list = h('div'), statsBox = h('div', { class: 'stats sq' });
  let all = [], q = '', seg = '', days = 30, page = 1;
  const PAGE = 8, COLORS = ['#f97316', '#3b82f6', '#16a34a', '#8b5cf6', '#ef4444', '#0ea5e9'];
  const avatar = c => h('span', { class: 'av', style: 'background:' + COLORS[(c.name.charCodeAt(0) || 0) % COLORS.length] }, c.name.trim().charAt(0));
  async function load() {
    clear(list); list.append(loading());
    try { all = await API.get('/customers' + qs({ q })); draw(); }
    catch (e) { clear(statsBox); clear(list); list.append(h('div', { class: 'card empty' }, e.code === 'FEATURE_LOCKED' ? 'إدارة العملاء غير متاحة في باقتك' : e.message)); }
  }
  function draw() {
    clear(list); clear(statsBox);
    const since = days ? Date.now() - days * 864e5 : 0;
    const base = all.filter(c => !since || new Date(c.createdAt) >= since || c._count.orders > 0);
    const active = base.filter(c => c._count.orders > 0);
    statsBox.append(statCard('green', 'users', 'إجمالي العملاء', base.length), statCard('blue', 'users', 'عملاء نشطون', active.length), statCard('orange', 'users', 'عملاء بدون طلبات', base.length - active.length));
    const rows = base.filter(c => !seg || (seg === 'active' ? c._count.orders > 0 : c._count.orders === 0));
    const pages = Math.max(1, Math.ceil(rows.length / PAGE)); if (page > pages) page = pages;
    const slice = rows.slice((page - 1) * PAGE, page * PAGE);
    list.append(h('div', { class: 'tbl-card' }, dataTable([
      { label: '#', render: c => rows.indexOf(c) + 1 },
      { label: 'اسم العميل', cls: 'start', render: c => h('span', { class: 'ic-line' }, avatar(c), c.name) },
      { label: 'رقم الهاتف', render: c => h('span', { class: 'ltr' }, c.phone) },
      { label: 'عدد الطلبات', render: c => c._count.orders }, { label: 'نقاط الولاء', render: c => c.loyaltyPoints },
      { label: 'إجمالي المشتريات', render: c => h('span', { class: 'ltr' }, money(c.totalSpent)) },
      { label: 'الحالة', render: c => c._count.orders > 0 ? chip('نشط', 'ok', 'dot') : chip('جديد', 'warn', 'dot') },
      { label: 'إجراءات', render: c => h('div', { class: 'act-row' }, h('button', { class: 'ibtn blue', title: 'الملف', onclick: () => details(c.id) }, icon('eye', 18)), h('button', { class: 'ibtn orange', title: 'تعديل', onclick: () => form(c) }, icon('edit', 18))) }],
      slice, 'لا عملاء', 'rt'), rows.length ? pager(rows.length, PAGE, page, n => { page = n; draw(); }, `إجمالي العملاء: ${rows.length} عميل`) : null));
  }
  const form = c => formModal({ title: c ? 'تعديل عميل' : 'عميل جديد', values: c || {}, fields: [{ name: 'name', label: 'الاسم', required: true }, { name: 'phone', label: 'الهاتف', required: true }, { name: 'notes', label: 'ملاحظات', type: 'textarea' }],
    onSubmit: async d => { if (c) await API.patch('/customers/' + c.id, d); else await API.post('/customers', d); load(); } });
  async function details(id) {
    try {
      const c = await API.get('/customers/' + id);
      modal(c.name, h('div', null, h('p', null, `${c.phone} — إجمالي الإنفاق: ${money(c.totalSpent)} — النقاط: ${c.loyaltyPoints}`), c.notes ? h('p', { class: 'muted' }, c.notes) : null,
        h('button', { class: 'btn sm', onclick: () => formModal({ title: 'تعديل نقاط', fields: [{ name: 'points', label: 'النقاط (+ إضافة / - استبدال)', type: 'number', required: true }, { name: 'reason', label: 'السبب', required: true }], onSubmit: async d => { await API.post(`/customers/${id}/loyalty`, d); load(); } }) }, 'تعديل النقاط'),
        h('h3', null, 'آخر الطلبات'), c.orders.map(o => h('div', { class: 'cart-line' }, h('span', null, `#${o.number} ${dt(o.createdAt)}`), h('span', null, statusBadge(o.status), ' ', money(o.total))))), { wide: true });
    } catch (e) { fail(e); }
  }
  const sb = searchBox('البحث باسم العميل أو رقم الهاتف...', x => { q = x; clearTimeout(load.t); load.t = setTimeout(() => { page = 1; load(); }, 300); }); sb.style.maxWidth = 'none';
  v.append(pageHead('العملاء', null, 'users', h('button', { class: 'btn lg', onclick: () => form() }, icon('plus', 20), 'عميل جديد')),
    h('div', { class: 'filters' }, h('div', { class: 'grp', style: 'flex:1' },
      selectPill('users', [['', 'جميع العملاء'], ['active', 'نشطون'], ['new', 'بدون طلبات']], seg, k => { seg = k; page = 1; draw(); }),
      selectPill('calendar', [[30, 'آخر 30 يوم'], [90, 'آخر 90 يوم'], [0, 'كل الوقت']], days, k => { days = Number(k); page = 1; draw(); }), sb)),
    statsBox, list);
  load();
})();
