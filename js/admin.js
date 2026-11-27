(async () => {
  const v = await boot('لوحة مالك المنصة', null, { admin: true }); if (!v) return;
  let tab = 'over', q = ''; const body = h('div');
  async function load() {
    clear(body); body.append(loading());
    try {
      if (tab === 'over') {
        const s = await API.get('/admin/stats'); clear(body); const c = h('canvas', { height: 110 }), c2 = h('canvas', { height: 110 });
        body.append(h('div', { class: 'kpis' }, kpi('المطاعم', s.total), kpi('نشط', s.active), kpi('تجريبي', s.trial), kpi('موقوف', s.suspended), kpi('اشتراكات سارية', s.activeSubscriptions), kpi('اشتراكات منتهية', s.expiredSubscriptions), kpi('MRR', money(s.mrr)), kpi('ARR', money(s.arr)), kpi('إيراد موثّق', money(s.verifiedRevenue))),
          h('div', { class: 'card' }, h('h3', null, 'الإيراد الشهري'), c), h('div', { class: 'card', style: 'margin-top:12px' }, h('h3', null, 'نمو التسجيلات'), c2));
        if (window.Chart) { new Chart(c, { type: 'bar', data: { labels: Object.keys(s.revenueByMonth), datasets: [{ label: 'إيراد', data: Object.values(s.revenueByMonth) }] } }); new Chart(c2, { type: 'line', data: { labels: Object.keys(s.signupsByMonth), datasets: [{ label: 'تسجيلات', data: Object.values(s.signupsByMonth) }] } }); }
      } else if (tab === 'rest') {
        const rows = await API.get('/admin/tenants' + qs({ q })); clear(body);
        body.append(h('div', { class: 'toolbar' }, h('input', { placeholder: 'بحث', value: q, oninput: e => { q = e.target.value; clearTimeout(load.t); load.t = setTimeout(load, 300); } })),
          dataTable([{ label: 'المطعم', render: t => h('div', null, h('strong', null, t.name), h('div', { class: 'muted' }, t.slug)) }, { label: 'النوع', key: 'businessType' }, { label: 'الحالة', render: t => h('span', { class: 'badge' }, t.status) },
            { label: 'الباقة', render: t => t.subscriptions[0] ? `${t.subscriptions[0].plan.name} (${t.subscriptions[0].status})` : '-' }, { label: 'ينتهي', render: t => t.subscriptions[0] ? dt(t.subscriptions[0].expiresAt) : '-' },
            { label: 'طلبات/موظفون/فروع', render: t => `${t._count.orders}/${t._count.users}/${t._count.branches}` },
            { label: '', render: t => h('div', { class: 'row' }, h('button', { class: 'btn sm secondary', onclick: () => extend(t) }, 'تمديد'), h('button', { class: 'btn sm secondary', onclick: () => setPlan(t) }, 'تغيير الباقة'),
              h('button', { class: 'btn sm ' + ((t.modules || {}).reservationsEnabled ? 'ok' : 'secondary'), title: 'تفعيل/إيقاف خدمة الحجوزات لهذا المطعم', onclick: async () => { const on = !(t.modules || {}).reservationsEnabled; if (await confirmBox(on ? 'تفعيل الحجوزات لـ ' + t.name + '؟' : 'إيقاف الحجوزات عن ' + t.name + '؟')) { await API.patch(`/admin/tenants/${t.id}/reservations`, { enabled: on }).catch(fail); toast(on ? 'تم تفعيل الحجوزات' : 'تم إيقاف الحجوزات'); load(); } } }, (t.modules || {}).reservationsEnabled ? 'الحجوزات: مفعّلة' : 'الحجوزات: متوقفة'),
              h('button', { class: 'btn sm ' + (t.status === 'SUSPENDED' ? 'ok' : 'danger'), onclick: async () => { if (await confirmBox(t.status === 'SUSPENDED' ? 'إعادة تفعيل؟' : 'إيقاف الحساب؟')) { await API.patch(`/admin/tenants/${t.id}/status`, { status: t.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED' }).catch(fail); load(); } } }, t.status === 'SUSPENDED' ? 'تفعيل' : 'إيقاف')) }], rows));
      } else if (tab === 'pay') {
        const rows = await API.get('/admin/payments'); clear(body);
        body.append(dataTable([{ label: 'التاريخ', render: p => dt(p.createdAt) }, { label: 'المطعم', render: p => p.subscription.tenant.name }, { label: 'الباقة', render: p => p.subscription.plan.name }, { label: 'المبلغ', render: p => money(p.amount) }, { label: 'المرجع', render: p => `${p.method} ${p.reference || ''}` }, { label: 'الحالة', key: 'status' },
          { label: '', render: p => p.status === 'PENDING' ? h('div', { class: 'row' }, h('button', { class: 'btn sm ok', onclick: async () => { if (await confirmBox('تأكيد استلام الدفعة وتفعيل الاشتراك؟')) { await API.post(`/admin/payments/${p.id}/verify`).catch(fail); load(); } } }, 'تأكيد'), h('button', { class: 'btn sm danger', onclick: async () => { await API.post(`/admin/payments/${p.id}/reject`).catch(fail); load(); } }, 'رفض')) : '' }], rows, 'لا مدفوعات'));
      } else if (tab === 'plans') {
        const rows = await API.get('/admin/plans'); clear(body);
        body.append(h('div', { class: 'toolbar' }, h('button', { class: 'btn', onclick: () => planForm() }, '+ باقة')), dataTable([{ label: 'الكود', key: 'code' }, { label: 'الاسم', key: 'name' }, { label: 'شهري', render: p => money(p.priceMonthly) }, { label: 'سنوي', render: p => money(p.priceAnnual) }, { label: 'فروع', key: 'maxBranches' }, { label: 'موظفون', key: 'maxEmployees' }, { label: 'نشطة', render: p => p.isActive ? 'نعم' : 'لا' }, { label: '', render: p => h('button', { class: 'btn sm secondary', onclick: () => planForm(p) }, 'تعديل') }], rows));
      } else if (tab === 'tix') {
        const rows = await API.get('/admin/tickets'); clear(body);
        body.append(dataTable([{ label: 'التاريخ', render: t => dt(t.createdAt) }, { label: 'المطعم', render: t => t.tenant.name }, { label: 'الموضوع', render: t => h('div', null, h('strong', null, t.subject), h('div', { class: 'muted' }, t.body)) }, { label: 'الحالة', key: 'status' }, { label: 'الرد', render: t => t.reply || '-' },
          { label: '', render: t => t.status === 'CLOSED' ? '' : h('button', { class: 'btn sm', onclick: () => formModal({ title: 'رد على: ' + t.subject, fields: [{ name: 'reply', label: 'الرد', type: 'textarea', required: true }, { name: 'close', label: 'إغلاق التذكرة', type: 'checkbox' }], onSubmit: async d => { await API.post(`/admin/tickets/${t.id}/reply`, d); load(); } }) }, 'رد') }], rows, 'لا تذاكر'));
      } else {
        const rows = await API.get('/admin/audit-logs'); clear(body);
        body.append(dataTable([{ label: 'الوقت', render: l => dt(l.createdAt) }, { label: 'الإجراء', key: 'action' }, { label: 'المستأجر', render: l => l.tenantId || '-' }, { label: 'تفاصيل', render: l => l.meta ? JSON.stringify(l.meta) : '-' }], rows, 'لا سجلات'));
      }
    } catch (e) { clear(body); body.append(h('div', { class: 'card empty' }, e.message)); }
  }
  const extend = t => formModal({ title: 'تمديد اشتراك ' + t.name, fields: [{ name: 'days', label: 'عدد الأيام', type: 'number', required: true }], onSubmit: async d => { await API.post(`/admin/tenants/${t.id}/extend`, d); load(); } });
  async function setPlan(t) {
    let plans; try { plans = (await API.get('/admin/plans')).filter(p => p.isActive); } catch (e) { return fail(e); }
    formModal({ title: 'تغيير باقة ' + t.name, fields: [{ name: 'planCode', label: 'الباقة', type: 'select', required: true, options: plans.map(p => ({ value: p.code, label: `${p.name} (${p.code})` })) },
      { name: 'cycle', label: 'دورة الفوترة', type: 'select', options: [{ value: '', label: 'بدون تغيير' }, { value: 'MONTHLY', label: 'شهري' }, { value: 'ANNUAL', label: 'سنوي' }] }],
      onSubmit: async d => { await API.post(`/admin/tenants/${t.id}/plan`, { planCode: d.planCode, cycle: d.cycle || undefined }); toast('تم تغيير الباقة'); load(); } });
  }
  const planForm = p => formModal({ title: p ? 'تعديل باقة' : 'باقة جديدة', wide: true, values: p ? { ...p, features: JSON.stringify(p.features) } : { isActive: true, features: '{"pos":true,"menu":true}' },
    fields: [...(p ? [] : [{ name: 'code', label: 'الكود (A-Z0-9_)', required: true }]), { name: 'name', label: 'الاسم', required: true }, { name: 'priceMonthly', label: 'السعر الشهري', type: 'number', step: '0.01', required: true }, { name: 'priceAnnual', label: 'السعر السنوي', type: 'number', step: '0.01', required: true },
      { name: 'maxBranches', label: 'أقصى فروع', type: 'number', required: true }, { name: 'maxEmployees', label: 'أقصى موظفين', type: 'number', required: true }, { name: 'features', label: 'الميزات (JSON): pos, menu, inventory, crm, reservations, finance, all', type: 'textarea' }, { name: 'isActive', label: 'نشطة', type: 'checkbox' }],
    onSubmit: async d => { let features; try { features = JSON.parse(d.features || '{}'); } catch { throw new Error('JSON الميزات غير صالح'); } const b = { ...d, features }; if (p) await API.patch('/admin/plans/' + p.id, b); else await API.post('/admin/plans', b); load(); } });
  v.append(tabs([['over', 'نظرة عامة'], ['rest', 'المطاعم'], ['pay', 'المدفوعات'], ['plans', 'الباقات'], ['tix', 'تذاكر الدعم'], ['log', 'سجل التدقيق']], k => { tab = k; load(); }), body);
  load();
})();
