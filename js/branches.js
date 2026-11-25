(async () => {
  const v = await boot('الفروع', 'branches.manage'); if (!v) return;
  const list = h('div');
  async function load() {
    clear(list); list.append(loading());
    try {
      const rows = await API.get('/branches'); clear(list);
      list.append(dataTable([{ label: 'الفرع', key: 'name' }, { label: 'العنوان', render: b => b.address || '-' }, { label: 'الحالة', render: b => h('span', { class: 'badge ' + (b.isActive ? 'ok' : 'err') }, b.isActive ? 'نشط' : 'متوقف') },
        { label: '', render: b => h('div', { class: 'row' }, h('button', { class: 'btn sm secondary', onclick: () => form(b) }, 'تعديل'), h('button', { class: 'btn sm secondary', onclick: async () => { await API.patch('/branches/' + b.id, { isActive: !b.isActive }).catch(fail); load(); } }, b.isActive ? 'إيقاف' : 'تفعيل')) }], rows));
    } catch (e) { clear(list); list.append(h('div', { class: 'card empty' }, e.message)); }
  }
  const form = b => formModal({ title: b ? 'تعديل فرع' : 'فرع جديد', values: b || {}, fields: [{ name: 'name', label: 'الاسم', required: true }, { name: 'address', label: 'العنوان' }],
    onSubmit: async d => { if (b) await API.patch('/branches/' + b.id, d); else await API.post('/branches', d); load(); } });
  v.append(h('div', { class: 'toolbar' }, h('button', { class: 'btn', onclick: () => form() }, '+ فرع')), h('p', { class: 'muted' }, 'عدد الفروع مقيّد بباقتك. الموظف المرتبط بفرع لا يرى إلا بيانات فرعه.'), list);
  load();
})();
