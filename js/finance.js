(async () => {
  const v = await boot('المالية', 'finance.view'); if (!v) return;
  let tab = 'sum', days = 30; const body = h('div');
  const range = () => rangeBounds(days);
  const daysSel = () => h('select', { onchange: e => { days = Number(e.target.value); load(); } }, [[1, 'اليوم'], [7, '7 أيام'], [30, '30 يومًا'], [90, '90 يومًا']].map(([d, n]) => h('option', { value: d, selected: d === days }, n)));
  async function load() {
    clear(body); body.append(loading());
    try {
      if (tab === 'sum') {
        const s = await API.get('/finance/summary' + qs(range())); clear(body);
        body.append(h('div', { class: 'toolbar' }, daysSel()), h('div', { class: 'kpis' }, kpi('الإيراد', money(s.revenue), `${s.completed} طلب مكتمل`), kpi('مبيعات بدون ضريبة', money(s.salesExTax)), kpi('المرتجعات', money(s.refunds)), kpi('تكلفة المنتجات', s.cogs == null ? '—' : money(s.cogs)),
          kpi('الربح الإجمالي', s.grossProfit == null ? '—' : money(s.grossProfit)), kpi('المصروفات', money(s.expenses)), kpi('صافي الربح', s.netProfit == null ? '—' : money(s.netProfit))),
          s.cogsComplete ? null : h('div', { class: 'banner', style: 'border-radius:10px' }, `الأرباح غير معروضة لأن ${s.itemsMissingCost} بند مبيع بلا تكلفة. سجّل تكلفة المنتجات أو الوصفات.`),
          h('p', { class: 'muted' }, s.note), h('h3', null, 'حسب الفرع'), dataTable([{ label: 'الفرع', key: 'k' }, { label: 'الإيراد', render: r => money(r.v) }], Object.entries(s.byBranch).map(([k, v]) => ({ k, v })), 'لا بيانات'));
      } else if (tab === 'exp') {
        const rows = await API.get('/finance/expenses' + qs(range())); clear(body);
        body.append(h('div', { class: 'toolbar' }, daysSel(), ME.permissions.includes('expenses.manage') ? h('button', { class: 'btn', onclick: expForm }, '+ مصروف') : null),
          dataTable([{ label: 'التاريخ', render: e => dt(e.spentAt) }, { label: 'الفئة', key: 'category' }, { label: 'المبلغ', render: e => money(e.amount) }, { label: 'من الدرج', render: e => e.paidFromCash ? 'نعم' : '-' }, { label: 'ملاحظة', render: e => e.note || '-' },
            { label: '', render: e => ME.permissions.includes('expenses.manage') ? h('button', { class: 'btn sm danger', onclick: async () => { if (await confirmBox('حذف المصروف؟')) { await API.del('/finance/expenses/' + e.id).catch(fail); load(); } } }, 'حذف') : '' }], rows, 'لا مصروفات'));
      } else {
        const rows = await API.get('/finance/registers'); clear(body);
        body.append(dataTable([{ label: 'الفرع', render: r => r.branch.name }, { label: 'فُتحت', render: r => dt(r.openedAt) }, { label: 'أُغلقت', render: r => dt(r.closedAt) }, { label: 'الافتتاح', render: r => money(r.openingBalance) },
          { label: 'المتوقع', render: r => r.expectedBalance == null ? '-' : money(r.expectedBalance) }, { label: 'الفعلي', render: r => r.closingBalance == null ? '-' : money(r.closingBalance) },
          { label: 'الفرق', render: r => r.closingBalance == null ? '-' : money(Number(r.closingBalance) - Number(r.expectedBalance)) }, { label: 'الحالة', render: r => r.status === 'OPEN' ? 'مفتوحة' : 'مغلقة' }], rows, 'لا ورديات'),
          h('p', { class: 'muted' }, 'فتح وإغلاق الوردية يتم من شاشة الكاشير.'));
      }
    } catch (e) { clear(body); body.append(h('div', { class: 'card empty' }, e.code === 'FEATURE_LOCKED' ? 'الإدارة المالية غير متاحة في باقتك' : e.message)); }
  }
  const expForm = () => formModal({ title: 'مصروف جديد', values: { category: 'إيجار' }, fields: [{ name: 'category', label: 'الفئة (إيجار، رواتب، كهرباء...)', required: true }, { name: 'amount', label: 'المبلغ', type: 'number', step: '0.01', required: true }, { name: 'note', label: 'ملاحظة' }, { name: 'paidFromCash', label: 'مدفوع من درج النقدية', type: 'checkbox' }],
    onSubmit: async d => { await API.post('/finance/expenses', d); load(); } });
  v.append(tabs([['sum', 'الملخص'], ['exp', 'المصروفات'], ['reg', 'الورديات النقدية']], k => { tab = k; load(); }), body);
  load();
})();
