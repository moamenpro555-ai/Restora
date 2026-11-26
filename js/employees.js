(async () => {
  const v = await boot('الموظفون والصلاحيات', 'employees.manage', { deco: 'building' }); if (!v) return;
  let tab = 'emps', roles = [], allPerms = [], branches = [], q = '', page = 1;
  const PAGE = 8;
  const body = h('div'), list = h('div');
  const PL = { 'orders.view': 'عرض الطلبات', 'orders.create': 'إنشاء طلبات/كاشير', 'orders.update': 'تحديث الطلبات والدفع', 'orders.cancel': 'إلغاء الطلبات', 'orders.refund': 'استرداد', 'products.view': 'عرض المنتجات', 'products.manage': 'إدارة المنتجات', 'inventory.manage': 'المخزون', 'customers.manage': 'العملاء', 'employees.manage': 'الموظفون', 'branches.manage': 'الفروع', 'finance.view': 'عرض المالية', 'expenses.manage': 'المصروفات', 'settings.manage': 'الإعدادات', 'subscription.manage': 'الاشتراك', 'reports.view': 'التقارير', 'kitchen.view': 'المطبخ', 'tables.manage': 'الطاولات', 'reservations.manage': 'الحجوزات' };
  let all = [];
  function drawEmps() {
    const t = q.trim().toLowerCase();
    const rows = all.filter(u => !t || u.name.toLowerCase().includes(t) || (u.email || '').toLowerCase().includes(t));
    const pages = Math.max(1, Math.ceil(rows.length / PAGE)); if (page > pages) page = pages;
    const slice = rows.slice((page - 1) * PAGE, page * PAGE);
    clear(list);
    list.append(h('div', { class: 'tbl-card' }, dataTable([
      { label: 'الاسم', cls: 'start', key: 'name' }, { label: 'البريد', render: u => h('span', { class: 'ltr' }, u.email) }, { label: 'الدور', render: u => u.role ? u.role.name : '-' },
      { label: 'الفرع', render: u => (branches.find(b => b.id === u.branchId) || {}).name || 'كل الفروع' },
      { label: 'الحالة', render: u => chip(u.isActive ? 'نشط' : 'موقوف', u.isActive ? 'ok' : 'err') },
      { label: 'إجراءات', render: u => u.role && u.role.name === 'Owner' ? '' : h('div', { class: 'act-row' },
        h('button', { class: 'ibtn orange', title: 'تعديل', onclick: () => empForm(u) }, icon('edit', 18)),
        h('button', { class: 'ibtn blue', title: 'كلمة المرور', onclick: () => pw(u) }, icon('shield', 18)),
        u.id !== ME.id ? h('button', { class: 'ibtn ' + (u.isActive ? 'red' : 'orange'), title: u.isActive ? 'إيقاف' : 'تفعيل', onclick: async () => { await API.patch('/employees/' + u.id, { isActive: !u.isActive }).catch(fail); load(); } }, icon(u.isActive ? 'stop' : 'play', 18)) : null) }],
      slice, q ? 'لا نتائج مطابقة' : 'لا يوجد موظفون', 'rt'), rows.length ? pager(rows.length, PAGE, page, n => { page = n; drawEmps(); }, `إجمالي الموظفين: ${rows.length}`) : null));
  }
  async function load() {
    clear(body); body.append(loading());
    try {
      const r = await API.get('/employees/roles/all'); roles = r.roles; allPerms = r.allPermissions; branches = await API.get('/branches'); clear(body);
      if (tab === 'emps') { all = await API.get('/employees'); body.append(list); drawEmps(); }
      else { clear(body); body.append(h('div', { class: 'tbl-card' }, dataTable([{ label: 'الدور', cls: 'start', key: 'name' }, { label: 'عدد الصلاحيات', render: r => r.permissions.length }, { label: 'إجراءات', render: r => r.name === 'Owner' ? chip('ثابت', 'neutral') : h('div', { class: 'act-row' }, h('button', { class: 'ibtn orange', title: 'تعديل', onclick: () => roleForm(r) }, icon('edit', 18))) }], roles, 'لا توجد أدوار', 'rt'))); }
    } catch (e) { clear(body); body.append(h('div', { class: 'card empty' }, e.message)); }
  }
  const roleOpts = () => roles.filter(r => r.name !== 'Owner').map(r => ({ value: r.id, label: r.name }));
  const brOpts = () => [{ value: '', label: 'كل الفروع' }, ...branches.map(b => ({ value: b.id, label: b.name }))];
  const empForm = u => formModal({ title: u ? 'تعديل موظف' : 'موظف جديد', values: u ? { ...u, branchId: u.branchId || '' } : {},
    fields: [{ name: 'name', label: 'الاسم', required: true }, ...(u ? [] : [{ name: 'email', label: 'البريد', type: 'email', required: true }, { name: 'password', label: 'كلمة المرور (8+)', type: 'password', required: true }]),
      { name: 'roleId', label: 'الدور', type: 'select', options: roleOpts(), required: true }, { name: 'branchId', label: 'الفرع', type: 'select', options: brOpts() }],
    onSubmit: async d => { const b = { ...d, branchId: d.branchId || null }; if (u) await API.patch('/employees/' + u.id, { name: b.name, roleId: b.roleId, branchId: b.branchId }); else await API.post('/employees', b); load(); } });
  const pw = u => formModal({ title: 'كلمة مرور جديدة: ' + u.name, fields: [{ name: 'password', label: 'كلمة المرور (8+)', type: 'password', required: true }], onSubmit: async d => { await API.post(`/employees/${u.id}/reset-password`, d); toast('تم التغيير'); } });
  const roleForm = r => formModal({ title: r ? 'تعديل الدور' : 'دور جديد', wide: true, values: r || { permissions: [] }, fields: [{ name: 'name', label: 'اسم الدور', required: true }, { name: 'permissions', label: 'الصلاحيات', type: 'multicheck', options: allPerms.filter(p => ME.permissions.includes(p)).map(p => ({ value: p, label: PL[p] || p })) }],
    onSubmit: async d => { const b = { name: d.name, permissions: d.permissions }; if (r) await API.put('/employees/roles/' + r.id, b); else await API.post('/employees/roles', b); load(); } });
  const sb = searchBox('البحث بالاسم أو البريد الإلكتروني...', x => { q = x; page = 1; if (tab === 'emps' && list.isConnected) drawEmps(); }); sb.style.maxWidth = 'none';
  const search = h('div', { class: 'filters' }, h('div', { class: 'grp', style: 'flex:1' }, sb));
  const addBtn = h('button', { class: 'btn lg', onclick: () => (tab === 'emps' ? empForm() : roleForm()) });
  const paintAdd = () => { clear(addBtn); addBtn.append(icon('plus', 20), tab === 'emps' ? 'موظف جديد' : 'دور جديد'); };
  paintAdd();
  const tabBar = pillTabs([['emps', 'الموظفون'], ['roles', 'الأدوار والصلاحيات']], k => { tab = k; page = 1; search.hidden = k !== 'emps'; paintAdd(); load(); });
  v.append(pageHead('الموظفون والصلاحيات', null, 'users', addBtn), tabBar, search, body);
  load();
})();
