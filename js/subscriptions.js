(async () => {
  const v = await boot('الاشتراك', 'subscription.manage'); if (!v) return;
  let cycle = 'MONTHLY'; const body = h('div');
  const SS = { TRIAL: 'تجريبي', ACTIVE: 'نشط', GRACE: 'فترة سماح', EXPIRED: 'منتهي', CANCELLED: 'ملغي' }, PS = { PENDING: 'قيد المراجعة', VERIFIED: 'مؤكد', REJECTED: 'مرفوض' };
  async function load() {
    clear(body); body.append(loading());
    try {
      const d = await API.get('/subscription'); const s = d.subscription; clear(body);
      const left = Math.ceil((new Date(s.expiresAt) - Date.now()) / 864e5);
      body.append(h('div', { class: 'kpis' }, kpi('الباقة', s.plan.name, SS[s.status]), kpi('ينتهي في', dt(s.expiresAt), left >= 0 ? `متبقي ${left} يوم` : `منتهي منذ ${-left} يوم (سماح ${d.graceDays} أيام للمدفوع)`), kpi('الفروع', `${d.usage.branches} / ${s.plan.maxBranches}`), kpi('الموظفون', `${d.usage.employees} / ${s.plan.maxEmployees}`)),
        h('div', { class: 'toolbar' }, h('select', { onchange: e => { cycle = e.target.value; load(); } }, h('option', { value: 'MONTHLY', selected: cycle === 'MONTHLY' }, 'شهري'), h('option', { value: 'ANNUAL', selected: cycle === 'ANNUAL' }, 'سنوي'))),
        h('div', { class: 'grid' }, d.plans.map(p => h('div', { class: 'card' }, h('h3', null, p.name), h('div', { class: 'price' }, money(cycle === 'ANNUAL' ? p.priceAnnual : p.priceMonthly), cycle === 'ANNUAL' ? ' / سنة' : ' / شهر'),
          h('p', { class: 'muted' }, `${p.maxBranches} فرع - ${p.maxEmployees} موظف`), h('p', { class: 'muted' }, Object.keys(p.features || {}).join('، ')),
          h('button', { class: 'btn', onclick: () => request(p) }, p.id === s.planId ? 'تجديد' : 'اشترك / غيّر الباقة')))),
        h('h3', null, 'سجل المدفوعات'), dataTable([{ label: 'التاريخ', render: p => dt(p.createdAt) }, { label: 'المبلغ', render: p => money(p.amount) }, { label: 'الطريقة', key: 'method' }, { label: 'المرجع', render: p => p.reference || '-' },
          { label: 'الحالة', render: p => h('span', { class: 'badge ' + (p.status === 'VERIFIED' ? 'ok' : p.status === 'REJECTED' ? 'err' : 'warn') }, PS[p.status]) },
          { label: '', render: p => p.status === 'VERIFIED' ? h('button', { class: 'btn sm secondary', onclick: () => invoice(p.id) }, 'فاتورة') : '' }], s.payments, 'لا مدفوعات'));
    } catch (e) { clear(body); body.append(h('div', { class: 'card empty' }, e.message)); }
  }
  const request = p => formModal({ title: `طلب اشتراك: ${p.name}`, values: { method: 'تحويل/إنستاباي' }, fields: [{ name: 'method', label: 'طريقة الدفع', required: true }, { name: 'reference', label: 'رقم العملية / المرجع', required: true, hint: 'لن يُفعَّل الاشتراك إلا بعد تأكيد الدفع من إدارة المنصة.' }],
    submitText: 'إرسال طلب الدفع', onSubmit: async d => { await API.post('/subscription/request', { planCode: p.code, cycle, ...d }); toast('تم إرسال الطلب وهو قيد المراجعة'); load(); } });
  async function invoice(id) {
    try { const i = await API.get('/subscription/invoice/' + id);
      modal('فاتورة ' + i.invoiceNo, h('div', null, h('p', null, 'التاريخ: ' + dt(i.date)), h('p', null, 'المطعم: ' + i.restaurant), h('p', null, `الباقة: ${i.plan} (${i.cycle === 'ANNUAL' ? 'سنوي' : 'شهري'})`), h('p', null, `المبلغ: ${Number(i.amount).toFixed(2)} ${i.currency}`), h('p', null, `الدفع: ${i.method} ${i.reference || ''}`), h('button', { class: 'btn', onclick: () => window.print() }, 'طباعة')));
    } catch (e) { fail(e); }
  }
  v.append(body); load();
})();
