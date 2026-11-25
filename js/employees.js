(async () => {
  const v = await boot('الموظفون والصلاحيات', 'employees.manage'); if (!v) return;
  let tab = 'emps', roles = [], allPerms = [], branches = [];
  const body = h('div');
  const PL = { 'orders.view': 'عرض الطلبات', 'orders.create': 'إنشاء طلبات/كاشير', 'orders.update': 'تحديث الطلبات والدفع', 'orders.cancel': 'إلغاء الطلبات', 'orders.refund': 'استرداد', 'products.view': 'عرض المنتجات', 'products.manage': 'إدارة المنتجات', 'inventory.manage': 'المخزون', 'customers.manage': 'العملاء', 'employees.manage': 'الموظفون', 'branches.manage': 'الفروع', 'finance.view': 'عرض المالية', 'expenses.manage': 'المصروفات', 'settings.manage': 'الإعدادات', 'subscription.manage': 'الاشتراك', 'reports.view': 'التقارير', 'kitchen.view': 'المطبخ', 'tables.manage': 'الطاولات', 'reservations.manage': 'الحجوزات' };
  async function load() {
    clear(body); body.append(loading());
    try {
      const r = await API.get('/employees/roles/all'); roles = r.roles; allPerms = r.allPermissions; branches = await API.get('/branches'); clear(body);
      if (tab === 'emps') {
        const rows = await API.get('/employees');
        body.append(h('div', { class: 'toolbar' }, h('button', { class: 'btn', onclick: () => empForm() }, '+ موظف')),
          dataTable([{ label: 'الاسم', key: 'name' }, { label: 'البريد', key: 'email' }, { label: 'الدور', render: u => u.role ? u.role.name : '-' }, { label: 'الفرع', render: u => (branches.find(b => b.id === u.branchId) || {}).name || 'كل الفروع' },
            { label: 'الحالة', render: u => h('span', { class: 'badge ' + (u.isActive ? 'ok' : 'err') }, u.isActive ? 'نشط' : 'موقوف') },
            { label: '', render: u => u.role && u.role.name === 'Owner' ? '' : h('div', { class: 'row' }, h('button', { class: 'btn sm secondary', onclick: () => empForm(u) }, 'تعديل'),
              h('button', { class: 'btn sm secondary', onclick: () => pw(u) }, 'كلمة المرور'), u.id !== ME.id ? h('button', { class: 'btn sm ' + (u.isActive ? 'danger' : 'ok'), onclick: async () => { await API.patch('/employees/' + u.id, { isActive: !u.isActive }).catch(fail); load(); } }, u.isActive ? 'إيقاف' : 'تفعيل') : null) }], rows));
      } else {
        body.append(h('div', { class: 'toolbar' }, h('button', { class: 'btn', onclick: () => roleForm() }, '+ دور مخصص')),
          dataTable([{ label: 'الدور', key: 'name' }, { label: 'عدد الصلاحيات', render: r => r.permissions.length }, { label: '', render: r => r.name === 'Owner' ? h('span', { class: 'muted' }, 'ثابت') : h('button', { class: 'btn sm secondary', onclick: () => roleForm(r) }, 'تعديل') }], roles));
      }
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
  v.append(tabs([['emps', 'الموظفون'], ['roles', 'الأدوار والصلاحيات']], k => { tab = k; load(); }), body);
  load();
})();
