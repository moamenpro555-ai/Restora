(async () => {
  const v = await boot('المخزون والوصفات', 'inventory.manage'); if (!v) return;
  let tab = 'ings', ings = [], sups = [];
  const body = h('div');
  const num = (name, label, extra) => ({ name, label, type: 'number', step: '0.001', ...extra });
  async function load() {
    clear(body); body.append(loading());
    try {
      ings = await API.get('/inventory/ingredients'); sups = await API.get('/inventory/suppliers');
      clear(body);
      if (tab === 'ings') {
        body.append(h('div', { class: 'toolbar' }, h('button', { class: 'btn', onclick: () => ingForm() }, '+ مكون')),
          dataTable([{ label: 'المكون', key: 'name' }, { label: 'المخزون', render: i => h('span', { class: 'badge ' + (i.low ? 'err' : 'ok') }, `${Number(i.stock)} ${i.unit}`) },
            { label: 'الحد الأدنى', render: i => Number(i.minStock) }, { label: 'تكلفة الوحدة', render: i => i.unitCost == null ? '—' : Number(i.unitCost).toFixed(4) },
            { label: '', render: i => h('div', { class: 'row' }, h('button', { class: 'btn sm secondary', onclick: () => adjust(i, 'ADJUSTMENT') }, 'تسوية'), h('button', { class: 'btn sm secondary', onclick: () => adjust(i, 'WASTE') }, 'هدر'),
              h('button', { class: 'btn sm secondary', onclick: () => ingForm(i) }, 'تعديل'), h('button', { class: 'btn sm danger', onclick: async () => { if (await confirmBox('حذف المكون؟')) { await API.del('/inventory/ingredients/' + i.id).catch(fail); load(); } } }, 'حذف')) }], ings, 'لا مكونات'));
      } else if (tab === 'sups') {
        body.append(h('div', { class: 'toolbar' }, h('button', { class: 'btn', onclick: () => supForm() }, '+ مورد')),
          dataTable([{ label: 'المورد', key: 'name' }, { label: 'الهاتف', render: s => s.phone || '-' }, { label: '', render: s => h('button', { class: 'btn sm secondary', onclick: () => supForm(s) }, 'تعديل') }], sups, 'لا موردون'));
      } else if (tab === 'buy') {
        const rows = await API.get('/inventory/purchases');
        body.append(h('div', { class: 'toolbar' }, h('button', { class: 'btn', onclick: buyForm }, '+ عملية شراء')),
          dataTable([{ label: 'التاريخ', render: p => dt(p.createdAt) }, { label: 'المكون', render: p => p.ingredient.name }, { label: 'المورد', render: p => p.supplier ? p.supplier.name : '-' },
            { label: 'الكمية', render: p => `${Number(p.quantity)} ${p.ingredient.unit}` }, { label: 'التكلفة', render: p => money(p.totalCost) }, { label: 'مدفوع', render: p => p.paid ? 'نعم' : 'آجل' }], rows, 'لا مشتريات'));
      } else {
        const rows = await API.get('/inventory/movements');
        const R = { SALE: 'بيع', SALE_REVERSAL: 'عكس بيع', PURCHASE: 'شراء', WASTE: 'هدر', ADJUSTMENT: 'تسوية', TRANSFER: 'تحويل' };
        body.append(dataTable([{ label: 'التاريخ', render: m => dt(m.createdAt) }, { label: 'المكون', render: m => m.ingredient.name }, { label: 'التغير', render: m => h('span', { class: Number(m.delta) < 0 ? 'price' : '' }, `${Number(m.delta)} ${m.ingredient.unit}`) }, { label: 'السبب', render: m => R[m.reason] || m.reason }], rows, 'لا حركات'));
      }
    } catch (e) { clear(body); body.append(h('div', { class: 'card empty' }, e.code === 'FEATURE_LOCKED' ? 'المخزون غير متاح في باقتك - قم بالترقية من صفحة الاشتراك' : e.message)); }
  }
  const ingForm = i => formModal({ title: i ? 'تعديل مكون' : 'مكون جديد', values: i || {}, fields: [{ name: 'name', label: 'الاسم', required: true }, { name: 'unit', label: 'الوحدة (كجم، لتر، قطعة)', required: true }, num('minStock', 'الحد الأدنى للتنبيه'), num('unitCost', 'تكلفة الوحدة (اختياري)')],
    onSubmit: async d => { if (i) await API.patch('/inventory/ingredients/' + i.id, d); else await API.post('/inventory/ingredients', d); load(); } });
  const supForm = s => formModal({ title: s ? 'تعديل مورد' : 'مورد جديد', values: s || {}, fields: [{ name: 'name', label: 'الاسم', required: true }, { name: 'phone', label: 'الهاتف' }], onSubmit: async d => { if (s) await API.patch('/inventory/suppliers/' + s.id, d); else await API.post('/inventory/suppliers', d); load(); } });
  const adjust = (i, reason) => formModal({ title: (reason === 'WASTE' ? 'تسجيل هدر: ' : 'تسوية: ') + i.name, fields: [num('delta', reason === 'WASTE' ? 'الكمية المهدرة' : 'التغيير (+ زيادة / - نقص)', { required: true }), { name: 'note', label: 'ملاحظة' }],
    onSubmit: async d => { await API.post(`/inventory/ingredients/${i.id}/adjust`, { delta: reason === 'WASTE' ? -Math.abs(d.delta) : d.delta, reason, note: d.note }); load(); } });
  const buyForm = () => formModal({ title: 'عملية شراء', fields: [{ name: 'ingredientId', label: 'المكون', type: 'select', required: true, options: ings.map(i => ({ value: i.id, label: i.name })) },
    { name: 'supplierId', label: 'المورد', type: 'select', options: [{ value: '', label: '—' }, ...sups.map(s => ({ value: s.id, label: s.name }))] }, num('quantity', 'الكمية', { required: true }), { name: 'totalCost', label: 'إجمالي التكلفة', type: 'number', step: '0.01', required: true }, { name: 'paid', label: 'مدفوعة', type: 'checkbox' }],
    values: { paid: true }, onSubmit: async d => { await API.post('/inventory/purchases', { ...d, supplierId: d.supplierId || null }); load(); } });
  v.append(tabs([['ings', 'المكونات'], ['sups', 'الموردون'], ['buy', 'المشتريات'], ['mov', 'حركة المخزون']], k => { tab = k; load(); }), h('p', { class: 'muted' }, 'الوصفات تُعدَّل من صفحة المنتجات (زر الوصفة).'), body);
  load();
})();
