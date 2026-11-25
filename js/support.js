(async () => {
  const v = await boot('الدعم الفني', null); if (!v) return;
  const list = h('div');
  async function load() {
    clear(list); list.append(loading());
    try {
      const rows = await API.get('/support'); clear(list);
      list.append(dataTable([{ label: 'التاريخ', render: t => dt(t.createdAt) }, { label: 'الموضوع', render: t => h('div', null, h('strong', null, t.subject), h('div', { class: 'muted' }, t.body)) }, { label: 'الحالة', render: t => h('span', { class: 'badge ' + (t.status === 'OPEN' ? 'warn' : 'ok') }, { OPEN: 'مفتوحة', ANSWERED: 'تم الرد', CLOSED: 'مغلقة' }[t.status] || t.status) }, { label: 'الرد', render: t => t.reply || '-' }], rows, 'لا تذاكر'));
    } catch (e) { clear(list); list.append(h('div', { class: 'card empty' }, e.message)); }
  }
  v.append(h('div', { class: 'toolbar' }, h('button', { class: 'btn', onclick: () => formModal({ title: 'تذكرة جديدة', fields: [{ name: 'subject', label: 'الموضوع', required: true }, { name: 'body', label: 'التفاصيل', type: 'textarea', required: true }], onSubmit: async d => { await API.post('/support', d); load(); } }) }, '+ تذكرة')), list);
  load();
})();
