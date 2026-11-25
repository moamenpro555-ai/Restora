(async () => {
  const v = await boot('العملاء', 'customers.manage'); if (!v) return;
  const list = h('div'); let q = '';
  async function load() {
    clear(list); list.append(loading());
    try {
      const rows = await API.get('/customers' + qs({ q })); clear(list);
      list.append(dataTable([{ label: 'الاسم', key: 'name' }, { label: 'الهاتف', key: 'phone' }, { label: 'الطلبات', render: c => c._count.orders }, { label: 'نقاط الولاء', render: c => c.loyaltyPoints },
        { label: '', render: c => h('div', { class: 'row' }, h('button', { class: 'btn sm secondary', onclick: () => details(c.id) }, 'الملف'), h('button', { class: 'btn sm secondary', onclick: () => form(c) }, 'تعديل')) }], rows, 'لا عملاء'));
    } catch (e) { clear(list); list.append(h('div', { class: 'card empty' }, e.code === 'FEATURE_LOCKED' ? 'إدارة العملاء غير متاحة في باقتك' : e.message)); }
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
  v.append(h('div', { class: 'toolbar' }, h('input', { placeholder: 'بحث بالاسم أو الهاتف', oninput: e => { q = e.target.value; clearTimeout(load.t); load.t = setTimeout(load, 300); } }), h('button', { class: 'btn', onclick: () => form() }, '+ عميل')), list);
  load();
})();
