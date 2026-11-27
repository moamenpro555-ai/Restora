(async () => {
  const v = await boot('المالية', 'finance.view', { foot: { text: 'مع Restora .. تحكّم أدق في أرباحك', icon: 'heart' } }); if (!v) return;
  let tab = 'exp', days = 30; const body = h('div');
  const range = () => rangeBounds(days);
  const sdt = d => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const canExp = ME.permissions.includes('expenses.manage');
  const daysSel = () => selectPill('calendar', [[1, 'اليوم'], [7, '7 أيام'], [30, '30 يومًا'], [90, '90 يومًا']], days, d => { days = Number(d); load(); });
  const sect = (title, ico, content) => h('div', { class: 'sect' }, h('h3', null, icon(ico, 24), title), content);
  const tbl = (cols, rows, empty) => h('div', { class: 'tbl-card' }, dataTable(cols, rows, empty, 'rt'));
  async function load() {
    clear(body); body.append(loading());
    try {
      if (tab === 'exp') {
        const rows = await API.get('/finance/expenses' + qs(range())); clear(body);
        body.append(h('div', { class: 'filters' }, h('div', { class: 'grp' }, daysSel()), canExp ? h('button', { class: 'btn lg', onclick: expForm }, icon('plus', 20), 'مصروف جديد') : null),
          tbl([{ label: 'التاريخ', render: e => dt(e.spentAt) }, { label: 'الفئة', key: 'category' }, { label: 'المبلغ', render: e => h('span', { class: 'ltr' }, money(e.amount)) }, { label: 'الوردية', render: e => e.register ? h('span', { class: 'ltr' }, sdt(e.register.openedAt)) : '-' }, { label: 'من الدرج', render: e => e.paidFromCash ? chip('نعم', 'info') : '-' }, { label: 'ملاحظة', render: e => e.note || '-' },
            { label: 'إجراءات', render: e => canExp ? h('div', { class: 'act-row' }, h('button', { class: 'ibtn red', title: 'حذف', onclick: async () => { if (await confirmBox('حذف المصروف؟')) { await API.del('/finance/expenses/' + e.id).catch(fail); load(); } } }, icon('trash', 18))) : '' }], rows, 'لا مصروفات'));
      } else {
        const rows = await API.get('/finance/advances' + qs(range())); clear(body);
        body.append(h('div', { class: 'filters' }, h('div', { class: 'grp' }, daysSel()), canExp ? h('button', { class: 'btn lg', onclick: advForm }, icon('plus', 20), 'سلفة جديدة') : null),
          tbl([{ label: 'التاريخ', render: e => dt(e.givenAt) }, { label: 'الموظف', cls: 'start', key: 'personName' }, { label: 'المبلغ', render: e => h('span', { class: 'ltr' }, money(e.amount)) },
            { label: 'الوردية', render: e => e.register ? h('span', { class: 'ltr' }, sdt(e.register.openedAt)) : '-' }, { label: 'من الدرج', render: e => e.paidFromCash ? chip('نعم', 'info') : '-' }, { label: 'ملاحظة', render: e => e.note || '-' },
            { label: 'إجراءات', render: e => canExp ? h('div', { class: 'act-row' }, h('button', { class: 'ibtn red', title: 'حذف', onclick: async () => { if (await confirmBox('حذف السلفة؟')) { await API.del('/finance/advances/' + e.id).catch(fail); load(); } } }, icon('trash', 18))) : '' }], rows, 'لا توجد سلف'));
      }
    } catch (e) { clear(body); body.append(h('div', { class: 'card empty' }, e.code === 'FEATURE_LOCKED' ? 'الإدارة المالية غير متاحة في باقتك' : e.message)); }
  }
  const expForm = () => formModal({ title: 'مصروف جديد', values: { category: 'إيجار' }, fields: [{ name: 'category', label: 'الفئة (إيجار، رواتب، كهرباء...)', required: true }, { name: 'amount', label: 'المبلغ', type: 'number', step: '0.01', required: true }, { name: 'note', label: 'ملاحظة' }, { name: 'paidFromCash', label: 'مدفوع من درج النقدية', type: 'checkbox' }],
    onSubmit: async d => { await API.post('/finance/expenses', d); load(); } });
  const advForm = async () => {
    let people = []; try { people = await API.get('/finance/people'); } catch (e) { return fail(e); }
    if (!people.length) return toast('أضف موظفين أولًا من صفحة الموظفين', true);
    formModal({ title: 'سلفة موظف', values: { paidFromCash: true, person: people[0].kind + ':' + people[0].id },
      fields: [{ name: 'person', label: 'الموظف', type: 'select', options: people.map(p => ({ value: p.kind + ':' + p.id, label: p.name })), required: true }, { name: 'amount', label: 'المبلغ', type: 'number', step: '0.01', min: '0.01', required: true },
        { name: 'note', label: 'ملاحظة' }, { name: 'paidFromCash', label: 'مدفوعة من درج النقدية (تُخصم من رصيد الوردية)', type: 'checkbox' }],
      onSubmit: async d => { const [kind, personId] = d.person.split(':'); await API.post('/finance/advances', { kind, personId, amount: Number(d.amount), note: d.note || null, paidFromCash: !!d.paidFromCash }); load(); } });
  };
  v.append(pillTabs([['exp', 'المصروفات', 'card'], ['adv', 'سلف الموظفين', 'wallet']], k => { tab = k; load(); }), body);
  load();
})();
