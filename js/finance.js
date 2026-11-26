(async () => {
  const v = await boot('المالية', 'finance.view', { foot: { text: 'مع Restora .. تحكّم أدق في أرباحك', icon: 'heart' } }); if (!v) return;
  let tab = 'sum', days = 30; const body = h('div');
  const range = () => rangeBounds(days);
  const canExp = ME.permissions.includes('expenses.manage');
  const daysSel = () => selectPill('calendar', [[1, 'اليوم'], [7, '7 أيام'], [30, '30 يومًا'], [90, '90 يومًا']], days, d => { days = Number(d); load(); });
  const sect = (title, ico, content) => h('div', { class: 'sect' }, h('h3', null, icon(ico, 24), title), content);
  const tbl = (cols, rows, empty) => h('div', { class: 'tbl-card' }, dataTable(cols, rows, empty, 'rt'));
  async function load() {
    clear(body); body.append(loading());
    try {
      if (tab === 'sum') {
        const s = await API.get('/finance/summary' + qs(range())); clear(body);
        const br = Object.entries(s.byBranch).map(([k, v]) => ({ k, v }));
        body.append(h('div', { class: 'filters' }, h('div', { class: 'grp' }, daysSel())),
          h('div', { class: 'stats fin' },
            statCard('green', 'trend', 'الإيراد', money(s.revenue), `${s.completed} طلب مكتمل`, 'arrowup'),
            statCard('blue', 'calendar', 'مبيعات بدون ضريبة', money(s.salesExTax)),
            statCard('purple', 'percent', 'المرتجعات', money(s.refunds)),
            statCard('orange', 'wallet', 'تكلفة المنتجات', s.cogs == null ? '—' : money(s.cogs)),
            statCard('teal', 'cart', 'الربح الإجمالي', s.grossProfit == null ? '—' : money(s.grossProfit)),
            statCard('indigo', 'card', 'المصروفات', money(s.expenses)),
            statCard('green', 'checkc', 'صافي الربح', s.netProfit == null ? '—' : money(s.netProfit))),
          s.cogsComplete ? null : h('div', { class: 'banner', style: 'border-radius:12px;margin-bottom:14px' }, `الأرباح غير معروضة لأن ${s.itemsMissingCost} بند مبيع بلا تكلفة. سجّل تكلفة المنتجات أو الوصفات.`),
          s.note ? h('div', { class: 'note-box' }, h('span', { class: 'nb-ic' }, icon('bulb', 40)), h('div', null, h('strong', null, 'ملاحظة:'), h('p', null, s.note))) : null,
          sect('حسب الفرع', 'bars', br.length ? tbl([{ label: 'الفرع', cls: 'start', key: 'k' }, { label: 'الإيراد', render: r => h('span', { class: 'ltr' }, money(r.v)) }], br, 'لا بيانات')
            : h('div', { class: 'sect-empty' }, icon('doc', 86), 'لا بيانات')));
      } else if (tab === 'exp') {
        const rows = await API.get('/finance/expenses' + qs(range())); clear(body);
        body.append(h('div', { class: 'filters' }, h('div', { class: 'grp' }, daysSel()), canExp ? h('button', { class: 'btn lg', onclick: expForm }, icon('plus', 20), 'مصروف جديد') : null),
          tbl([{ label: 'التاريخ', render: e => dt(e.spentAt) }, { label: 'الفئة', key: 'category' }, { label: 'المبلغ', render: e => h('span', { class: 'ltr' }, money(e.amount)) }, { label: 'من الدرج', render: e => e.paidFromCash ? chip('نعم', 'info') : '-' }, { label: 'ملاحظة', render: e => e.note || '-' },
            { label: 'إجراءات', render: e => canExp ? h('div', { class: 'act-row' }, h('button', { class: 'ibtn red', title: 'حذف', onclick: async () => { if (await confirmBox('حذف المصروف؟')) { await API.del('/finance/expenses/' + e.id).catch(fail); load(); } } }, icon('trash', 18))) : '' }], rows, 'لا مصروفات'));
      } else {
        const rows = await API.get('/finance/registers'); clear(body);
        body.append(tbl([{ label: 'الفرع', render: r => r.branch.name }, { label: 'فُتحت', render: r => dt(r.openedAt) }, { label: 'أُغلقت', render: r => dt(r.closedAt) }, { label: 'الافتتاح', render: r => money(r.openingBalance) },
          { label: 'المتوقع', render: r => r.expectedBalance == null ? '-' : money(r.expectedBalance) }, { label: 'الفعلي', render: r => r.closingBalance == null ? '-' : money(r.closingBalance) },
          { label: 'الفرق', render: r => r.closingBalance == null ? '-' : money(Number(r.closingBalance) - Number(r.expectedBalance)) }, { label: 'الحالة', render: r => r.status === 'OPEN' ? chip('مفتوحة', 'ok', 'dot') : chip('مغلقة', 'neutral') }], rows, 'لا ورديات'),
          h('p', { class: 'muted', style: 'margin-top:12px' }, 'فتح وإغلاق الوردية يتم من شاشة الكاشير.'));
      }
    } catch (e) { clear(body); body.append(h('div', { class: 'card empty' }, e.code === 'FEATURE_LOCKED' ? 'الإدارة المالية غير متاحة في باقتك' : e.message)); }
  }
  const expForm = () => formModal({ title: 'مصروف جديد', values: { category: 'إيجار' }, fields: [{ name: 'category', label: 'الفئة (إيجار، رواتب، كهرباء...)', required: true }, { name: 'amount', label: 'المبلغ', type: 'number', step: '0.01', required: true }, { name: 'note', label: 'ملاحظة' }, { name: 'paidFromCash', label: 'مدفوع من درج النقدية', type: 'checkbox' }],
    onSubmit: async d => { await API.post('/finance/expenses', d); load(); } });
  v.append(pillTabs([['sum', 'الملخص', 'bars'], ['exp', 'المصروفات'], ['reg', 'الورديات النقدية']], k => { tab = k; load(); }), body);
  load();
})();
