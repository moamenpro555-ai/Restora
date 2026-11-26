(async () => {
  const v = await boot('المخزون والوصفات', 'inventory.manage'); if (!v) return;
  let tab = 'ings', ings = [], sups = [], term = '', fStatus = '', page = 1;
  const PAGE = 8;
  const body = h('div');
  const num = (name, label, extra) => ({ name, label, type: 'number', step: '0.001', ...extra });
  const addBtn = (label, fn) => h('button', { class: 'btn lg', onclick: fn }, icon('plus', 20), label);
  const card = (table, total, label) => h('div', { class: 'tbl-card' }, table, total ? pager(total, PAGE, page, n => { page = n; render(); }, label) : null);
  let cache = {};
  async function load() {
    clear(body); body.append(loading());
    try {
      ings = await API.get('/inventory/ingredients'); sups = await API.get('/inventory/suppliers');
      cache = tab === 'buy' ? { rows: await API.get('/inventory/purchases') } : tab === 'mov' ? { rows: await API.get('/inventory/movements') } : {};
      render();
    } catch (e) { clear(body); body.append(h('div', { class: 'card empty' }, e.code === 'FEATURE_LOCKED' ? 'المخزون غير متاح في باقتك - قم بالترقية من صفحة الاشتراك' : e.message)); }
  }
  const slice = rows => rows.slice((page - 1) * PAGE, page * PAGE);
  function details(i) {
    const m = modal(i.name, h('div', null, h('div', { class: 'row' }, i.low ? chip('منخفض', 'warn', 'alert') : chip('متوفر', 'ok', 'dot')),
      h('div', { class: 'dt-grid' }, h('div', null, h('small', null, 'المخزون'), h('b', null, `${Number(i.stock)} ${i.unit}`)), h('div', null, h('small', null, 'الحد الأدنى'), h('b', null, Number(i.minStock))),
        h('div', null, h('small', null, 'تكلفة الوحدة'), h('b', null, i.unitCost == null ? '—' : Number(i.unitCost).toFixed(4)))),
      h('div', { class: 'row' }, h('button', { class: 'btn secondary sm', onclick: () => { m.close(); adjust(i, 'ADJUSTMENT'); } }, 'تسوية'), h('button', { class: 'btn secondary sm', onclick: () => { m.close(); adjust(i, 'WASTE'); } }, 'هدر'))));
  }
  function render() {
    clear(body);
    if (tab === 'ings') {
      const t = term.trim().toLowerCase();
      const rows = ings.filter(i => (!fStatus || (fStatus === 'low' ? i.low : !i.low)) && (!t || i.name.toLowerCase().includes(t)));
      const pages = Math.max(1, Math.ceil(rows.length / PAGE)); if (page > pages) page = pages;
      const sb = searchBox('البحث عن مكون...', x => { term = x; page = 1; render(); }); sb.style.maxWidth = 'none'; sb.querySelector('input').value = term;
      body.append(h('div', { class: 'filters' }, h('div', { class: 'grp', style: 'flex:1' }, sb, selectPill('checkc', [['', 'كل الحالات'], ['ok', 'متوفر'], ['low', 'منخفض']], fStatus, k => { fStatus = k; page = 1; render(); }))),
        card(dataTable([{ label: '#', render: i => ings.indexOf(i) + 1 }, { label: 'المكون', key: 'name' }, { label: 'الكمية المتوفرة', render: i => Number(i.stock) }, { label: 'الوحدة', key: 'unit' },
          { label: 'الحد الأدنى', render: i => Number(i.minStock) }, { label: 'تكلفة الوحدة', render: i => i.unitCost == null ? '—' : Number(i.unitCost).toFixed(4) },
          { label: 'الحالة', render: i => i.low ? chip('منخفض', 'warn', 'alert') : chip('متوفر', 'ok', 'dot') },
          { label: 'إجراءات', render: i => h('div', { class: 'act-row' }, h('button', { class: 'ibtn blue', title: 'تفاصيل وتسوية', onclick: () => details(i) }, icon('eye', 18)), h('button', { class: 'ibtn orange', title: 'تعديل', onclick: () => ingForm(i) }, icon('edit', 18)),
            h('button', { class: 'ibtn red', title: 'حذف', onclick: async () => { if (await confirmBox('حذف المكون؟')) { await API.del('/inventory/ingredients/' + i.id).catch(fail); load(); } } }, icon('trash', 18))) }], slice(rows), 'لا مكونات', 'rt'), rows.length, `إجمالي الأصناف: ${rows.length} عنصر`));
    } else if (tab === 'sups') {
      body.append(card(dataTable([{ label: '#', render: s => sups.indexOf(s) + 1 }, { label: 'المورد', key: 'name' }, { label: 'الهاتف', render: s => s.phone ? h('span', { class: 'ltr' }, s.phone) : '-' }, { label: 'إجراءات', render: s => h('button', { class: 'ibtn orange', onclick: () => supForm(s) }, icon('edit', 18)) }], slice(sups), 'لا موردون', 'rt'), sups.length, `إجمالي الموردين: ${sups.length}`));
    } else if (tab === 'buy') {
      const rows = cache.rows;
      body.append(card(dataTable([{ label: 'التاريخ', render: p => dt(p.createdAt) }, { label: 'المكون', render: p => p.ingredient.name }, { label: 'المورد', render: p => p.supplier ? p.supplier.name : '-' },
        { label: 'الكمية', render: p => `${Number(p.quantity)} ${p.ingredient.unit}` }, { label: 'التكلفة', render: p => h('span', { class: 'ltr' }, money(p.totalCost)) }, { label: 'الدفع', render: p => p.paid ? chip('مدفوع', 'ok') : chip('آجل', 'warn') }], slice(rows), 'لا مشتريات', 'rt'), rows.length, `إجمالي المشتريات: ${rows.length}`));
    } else {
      const R = { SALE: 'بيع', SALE_REVERSAL: 'عكس بيع', PURCHASE: 'شراء', WASTE: 'هدر', ADJUSTMENT: 'تسوية', TRANSFER: 'تحويل' }, rows = cache.rows;
      body.append(card(dataTable([{ label: 'التاريخ', render: m => dt(m.createdAt) }, { label: 'المكون', render: m => m.ingredient.name }, { label: 'التغير', render: m => chip(`${Number(m.delta)} ${m.ingredient.unit}`, Number(m.delta) < 0 ? 'err' : 'ok') }, { label: 'السبب', render: m => R[m.reason] || m.reason }], slice(rows), 'لا حركات', 'rt'), rows.length, `إجمالي الحركات: ${rows.length}`));
    }
  }
  const ingForm = i => formModal({ title: i ? 'تعديل مكون' : 'مكون جديد', values: i || {}, fields: [{ name: 'name', label: 'الاسم', required: true }, { name: 'unit', label: 'الوحدة (كجم، لتر، قطعة)', required: true }, num('minStock', 'الحد الأدنى للتنبيه'), num('unitCost', 'تكلفة الوحدة (اختياري)')],
    onSubmit: async d => { if (i) await API.patch('/inventory/ingredients/' + i.id, d); else await API.post('/inventory/ingredients', d); load(); } });
  const supForm = s => formModal({ title: s ? 'تعديل مورد' : 'مورد جديد', values: s || {}, fields: [{ name: 'name', label: 'الاسم', required: true }, { name: 'phone', label: 'الهاتف' }], onSubmit: async d => { if (s) await API.patch('/inventory/suppliers/' + s.id, d); else await API.post('/inventory/suppliers', d); load(); } });
  const adjust = (i, reason) => formModal({ title: (reason === 'WASTE' ? 'تسجيل هدر: ' : 'تسوية: ') + i.name, fields: [num('delta', reason === 'WASTE' ? 'الكمية المهدرة' : 'التغيير (+ زيادة / - نقص)', { required: true }), { name: 'note', label: 'ملاحظة' }],
    onSubmit: async d => { await API.post(`/inventory/ingredients/${i.id}/adjust`, { delta: reason === 'WASTE' ? -Math.abs(d.delta) : d.delta, reason, note: d.note }); load(); } });
  const buyForm = () => formModal({ title: 'عملية شراء', fields: [{ name: 'ingredientId', label: 'المكون', type: 'select', required: true, options: ings.map(i => ({ value: i.id, label: i.name })) },
    { name: 'supplierId', label: 'المورد', type: 'select', options: [{ value: '', label: '—' }, ...sups.map(s => ({ value: s.id, label: s.name }))] }, num('quantity', 'الكمية', { required: true }), { name: 'totalCost', label: 'إجمالي التكلفة', type: 'number', step: '0.01', required: true }, { name: 'paid', label: 'مدفوعة', type: 'checkbox' }],
    values: { paid: true }, onSubmit: async d => { await API.post('/inventory/purchases', { ...d, supplierId: d.supplierId || null }); load(); } });
  const ADD = { ings: ['إضافة مكون', () => ingForm()], sups: ['إضافة مورد', () => supForm()], buy: ['عملية شراء', () => buyForm()] };
  const act = h('div', { class: 'ph-act' });
  const setAct = () => { clear(act); if (ADD[tab]) act.append(addBtn(ADD[tab][0], ADD[tab][1])); };
  v.append(pageHead('المخزون والوصفات', 'الوصفات تُعدَّل من صفحة المنتجات (زر الوصفة).', 'box', act), h('div', { style: 'margin-bottom:16px' }, pillTabs([['ings', 'المكونات'], ['sups', 'الموردون'], ['buy', 'المشتريات'], ['mov', 'حركة المخزون']], k => { tab = k; page = 1; setAct(); load(); })), body);
  setAct();
  load();
})();
