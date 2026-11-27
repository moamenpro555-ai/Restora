(async () => {
  const v = await boot('الورديات', 'finance.view', { foot: { text: 'مع Restora .. تحكّم أدق في أرباحك', icon: 'heart' } }); if (!v) return;
  let tab = 'reg', days = 30; const body = h('div');
  const range = () => rangeBounds(days);
  const daysSel = () => selectPill('calendar', [[1, 'اليوم'], [7, '7 أيام'], [30, '30 يومًا'], [90, '90 يومًا']], days, d => { days = Number(d); load(); });
  const sect = (title, ico, content) => h('div', { class: 'sect' }, h('h3', null, icon(ico, 24), title), content);
  const tbl = (cols, rows, empty) => h('div', { class: 'tbl-card' }, dataTable(cols, rows, empty, 'rt'));
  async function shiftDetails(id) {
    try {
      const d = await API.get('/finance/registers/' + id), r = d.register;
      const list = (rows, cols, empty) => rows.length ? dataTable(cols, rows, empty, 'rt') : h('p', { class: 'muted' }, empty);
      modal('تفاصيل الوردية — ' + r.branch.name, h('div', null,
        h('div', { class: 'totals' },
          h('div', null, h('span', null, 'فتحها'), h('span', null, d.register.openedByName)), h('div', null, h('span', null, 'من'), h('span', null, dt(r.openedAt))), h('div', null, h('span', null, 'إلى'), h('span', null, r.closedAt ? dt(r.closedAt) : 'مفتوحة')),
          h('div', null, h('span', null, 'رصيد الافتتاح'), h('span', null, money(r.openingBalance))), r.expectedBalance != null ? h('div', null, h('span', null, 'المتوقع بالدرج'), h('span', null, money(r.expectedBalance))) : null,
          r.closingBalance != null ? h('div', null, h('span', null, 'الفعلي'), h('span', null, money(r.closingBalance))) : null),
        h('h3', null, 'المبيعات'), h('div', { class: 'totals' }, h('div', null, h('span', null, 'عدد الطلبات'), h('span', null, d.orders)),
          ...Object.entries(d.byMethod).map(([m, a]) => h('div', null, h('span', null, AR.method[m] || m), h('span', null, money(a)))), h('div', { class: 't' }, h('span', null, 'إجمالي المحصّل'), h('span', null, money(d.sales)))),
        h('h3', null, 'مصروفات الوردية'), list(d.expenses, [{ label: 'الفئة', key: 'category' }, { label: 'المبلغ', render: e => money(e.amount) }, { label: 'ملاحظة', render: e => e.note || '-' }], 'لا مصروفات في هذه الوردية'),
        d.expenses.length ? h('div', { class: 'totals' }, h('div', { class: 't' }, h('span', null, 'إجمالي المصروفات'), h('span', null, money(d.expensesTotal)))) : null,
        h('h3', null, 'سلف الموظفين'), list(d.advances, [{ label: 'الموظف', key: 'personName' }, { label: 'المبلغ', render: e => money(e.amount) }, { label: 'ملاحظة', render: e => e.note || '-' }], 'لا سلف في هذه الوردية'),
        d.advances.length ? h('div', { class: 'totals' }, h('div', { class: 't' }, h('span', null, 'إجمالي السلف'), h('span', null, money(d.advancesTotal)))) : null), { wide: true });
    } catch (e) { fail(e); }
  }
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
      } else {
        const rows = await API.get('/finance/registers'); clear(body);
        body.append(tbl([{ label: 'الفرع', render: r => r.branch.name }, { label: 'فُتحت', render: r => dt(r.openedAt) }, { label: 'أُغلقت', render: r => dt(r.closedAt) }, { label: 'الافتتاح', render: r => money(r.openingBalance) },
          { label: 'المتوقع', render: r => r.expectedBalance == null ? '-' : money(r.expectedBalance) }, { label: 'الفعلي', render: r => r.closingBalance == null ? '-' : money(r.closingBalance) },
          { label: 'الفرق', render: r => r.closingBalance == null ? '-' : money(Number(r.closingBalance) - Number(r.expectedBalance)) }, { label: 'الحالة', render: r => r.status === 'OPEN' ? chip('مفتوحة', 'ok', 'dot') : chip('مغلقة', 'neutral') },
          { label: 'تفاصيل', render: r => h('button', { class: 'btn detail', onclick: () => shiftDetails(r.id) }, icon('eye', 18), 'تفاصيل') }], rows, 'لا ورديات'),
          h('p', { class: 'muted', style: 'margin-top:12px' }, 'فتح وإغلاق الوردية يتم من شاشة الكاشير. مصروفات وسلف كل وردية تظهر في تفاصيلها.'));
      }
    } catch (e) { clear(body); body.append(h('div', { class: 'card empty' }, e.code === 'FEATURE_LOCKED' ? 'الإدارة المالية غير متاحة في باقتك' : e.message)); }
  }
  v.append(pillTabs([['reg', 'الورديات', 'clock'], ['sum', 'الملخص', 'bars']], k => { tab = k; load(); }), body);
  load();
})();
