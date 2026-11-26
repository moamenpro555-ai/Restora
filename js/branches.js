(async () => {
  const v = await boot('الفروع', 'branches.manage', { deco: 'dining' }); if (!v) return;
  const list = h('div');
  let all = [], q = '', page = 1;
  const PAGE = 8;
  function draw() {
    const t = q.trim().toLowerCase();
    const rows = all.filter(b => !t || b.name.toLowerCase().includes(t) || (b.address || '').toLowerCase().includes(t));
    const pages = Math.max(1, Math.ceil(rows.length / PAGE)); if (page > pages) page = pages;
    const slice = rows.slice((page - 1) * PAGE, page * PAGE);
    clear(list);
    list.append(h('div', { class: 'tbl-card' }, dataTable([
      { label: 'الفرع', cls: 'start', key: 'name' }, { label: 'العنوان', render: b => b.address || '-' },
      { label: 'الحالة', render: b => chip(b.isActive ? 'نشط' : 'متوقف', b.isActive ? 'ok' : 'err') },
      { label: 'تفعيل / تعطيل', render: b => h('button', { class: 'btn detail', onclick: async () => { await API.patch('/branches/' + b.id, { isActive: !b.isActive }).catch(fail); load(); } }, icon(b.isActive ? 'stop' : 'play', 16), b.isActive ? 'تعطيل' : 'تفعيل') },
      { label: 'إجراءات', render: b => h('div', { class: 'act-row' },
        h('button', { class: 'ibtn orange', title: 'تعديل', onclick: () => form(b) }, icon('edit', 18)),
        h('button', { class: 'ibtn red', title: 'حذف', onclick: () => del(b) }, icon('trash', 18))) }],
      slice, q ? 'لا نتائج مطابقة' : 'لا توجد فروع', 'rt'), rows.length ? pager(rows.length, PAGE, page, n => { page = n; draw(); }, `إجمالي الفروع: ${rows.length}`) : null));
  }
  async function load() {
    clear(list); list.append(loading());
    try { all = await API.get('/branches'); draw(); }
    catch (e) { clear(list); list.append(h('div', { class: 'card empty' }, e.message)); }
  }
  async function del(b) {
    if (!(await confirmBox(`حذف الفرع "${b.name}"؟ لا يمكن التراجع عن هذا الإجراء.`))) return;
    try { await API.del('/branches/' + b.id); toast('تم حذف الفرع'); load(); } catch (e) { fail(e); }
  }
  const form = b => formModal({ title: b ? 'تعديل فرع' : 'فرع جديد', values: b || {}, fields: [{ name: 'name', label: 'الاسم', required: true }, { name: 'address', label: 'العنوان' }],
    onSubmit: async d => { if (b) await API.patch('/branches/' + b.id, d); else await API.post('/branches', d); load(); } });
  const sb = searchBox('البحث باسم الفرع...', x => { q = x; page = 1; draw(); }); sb.style.maxWidth = 'none';
  v.append(pageHead('الفروع', null, 'store', h('button', { class: 'btn lg', onclick: () => form() }, icon('plus', 20), 'فرع جديد')),
    h('div', { class: 'filters' }, h('div', { class: 'grp', style: 'flex:1' }, sb, h('span', { class: 'muted' }, 'عدد الفروع مقيّد بباقتك. الموظف المرتبط بفرع لا يرى إلا بيانات فرعه.'))), list);
  load();
})();
