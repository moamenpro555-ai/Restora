(async () => {
  const v = await boot('المنتجات والتصنيفات', 'products.view'); if (!v) return;
  const manage = ME.permissions.includes('products.manage');
  let cats = [], prods = [], tab = 'products';
  const body = h('div');
  // options <-> text:  المجموعة | required/optional | single/multi | خيار:سعر, خيار:سعر
  const toText = o => (o || []).map(g => `${g.name} | ${g.required ? 'required' : 'optional'} | ${g.multi ? 'multi' : 'single'} | ${g.choices.map(c => `${c.name}:${c.price || 0}`).join(', ')}`).join('\n');
  function fromText(t) {
    return (t || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const [name, req, multi, ch] = l.split('|').map(s => s.trim());
      return { name, required: req === 'required', multi: multi === 'multi', choices: (ch || '').split(',').map(c => c.trim()).filter(Boolean).map(c => { const [n, p] = c.split(':'); return { name: n.trim(), price: Number(p || 0) }; }) };
    });
  }
  async function load() {
    try { [cats, prods] = await Promise.all([API.get('/products/categories/all'), API.get('/products')]); } catch (e) { clear(body); body.append(h('div', { class: 'card empty' }, e.message)); return; }
    draw();
  }
  function prodForm(p) {
    formModal({ title: p ? 'تعديل منتج' : 'منتج جديد', wide: true, values: p ? { ...p, options: toText(p.options) } : { isAvailable: true },
      fields: [{ name: 'name', label: 'الاسم', required: true }, { name: 'categoryId', label: 'التصنيف', type: 'select', options: [{ value: '', label: '—' }, ...cats.map(c => ({ value: c.id, label: c.name }))] },
        { name: 'price', label: 'السعر', type: 'number', step: '0.01', required: true }, { name: 'cost', label: 'التكلفة (اختياري، تُحسب من الوصفة)', type: 'number', step: '0.01' },
        { name: 'imageUrl', label: 'صورة المنتج (من جهازك)', type: 'image' }, { name: 'station', label: 'محطة المطبخ', hint: 'مثال: Grill, Drinks, Pizza' },
        { name: 'description', label: 'الوصف', type: 'textarea' },
        { name: 'options', label: 'الإضافات والخيارات', type: 'textarea', hint: 'سطر لكل مجموعة: الحجم | required | single | صغير:0, كبير:10' },
        { name: 'isAvailable', label: 'متاح للبيع', type: 'checkbox' }],
      onSubmit: async d => {
        const data = { ...d, options: fromText(d.options), categoryId: d.categoryId || null, imageUrl: d.imageUrl || null, station: d.station || null, description: d.description || null, cost: d.cost ?? null };
        if (p) await API.patch('/products/' + p.id, data); else await API.post('/products', data);
        toast('تم الحفظ'); load();
      } });
  }
  async function recipe(p) {
    let ings, cur;
    try { [ings, cur] = await Promise.all([API.get('/inventory/ingredients'), API.get('/inventory/recipes/' + p.id)]); } catch (e) { return fail(e); }
    const lines = cur.lines.map(l => ({ ingredientId: l.ingredientId, quantity: Number(l.quantity) }));
    const box = h('div');
    const draw2 = () => { clear(box); lines.forEach((l, i) => box.append(h('div', { class: 'row' },
      h('select', { onchange: e => { l.ingredientId = e.target.value; } }, ings.map(x => h('option', { value: x.id, selected: x.id === l.ingredientId }, `${x.name} (${x.unit})`))),
      h('input', { type: 'number', step: '0.001', min: '0', value: l.quantity, oninput: e => { l.quantity = Number(e.target.value); } }),
      h('button', { class: 'btn secondary sm', onclick: () => { lines.splice(i, 1); draw2(); } }, '✕')))); };
    const m = modal('وصفة: ' + p.name, h('div', null, box,
      h('button', { class: 'btn secondary sm', onclick: () => { if (ings.length) { lines.push({ ingredientId: ings[0].id, quantity: 1 }); draw2(); } else toast('أضف مكونات أولًا', true); } }, '+ مكون'),
      h('p', { class: 'muted' }, cur.costComplete ? 'تكلفة الوصفة الحالية: ' + money(cur.cost) : 'التكلفة تُحسب عندما يكون لكل المكونات سعر وحدة (يُسجَّل من المشتريات).'),
      h('button', { class: 'btn', onclick: async () => { try { const r = await API.put('/inventory/recipes/' + p.id, { lines: lines.filter(l => l.quantity > 0) }); toast(r.costComplete ? 'تم الحفظ، التكلفة ' + money(r.cost) : 'تم الحفظ'); m.close(); load(); } catch (e) { fail(e); } } }, 'حفظ الوصفة')));
    draw2();
  }
  function draw() {
    clear(body);
    if (tab === 'cats') {
      body.append(manage ? h('div', { class: 'toolbar' }, h('button', { class: 'btn', onclick: () => catForm() }, '+ تصنيف')) : null,
        dataTable([{ label: 'الاسم', key: 'name' }, { label: 'الترتيب', key: 'sortOrder' }, { label: 'ظاهر', render: c => c.isActive ? 'نعم' : 'لا' },
          { label: '', render: c => manage ? h('div', { class: 'row' }, h('button', { class: 'btn sm secondary', onclick: () => catForm(c) }, 'تعديل'), h('button', { class: 'btn sm danger', onclick: async () => { if (await confirmBox('حذف التصنيف؟')) { await API.del('/products/categories/' + c.id).catch(fail); load(); } } }, 'حذف')) : '' }], cats));
    } else {
      body.append(manage ? h('div', { class: 'toolbar' }, h('button', { class: 'btn', onclick: () => prodForm() }, '+ منتج')) : null,
        dataTable([{ label: 'المنتج', render: p => h('div', { class: 'row' }, p.imageUrl ? h('img', { src: p.imageUrl, style: 'width:36px;height:36px;border-radius:6px;object-fit:cover' }) : null, p.name) },
          { label: 'التصنيف', render: p => (cats.find(c => c.id === p.categoryId) || {}).name || '-' }, { label: 'السعر', render: p => money(p.price) },
          { label: 'التكلفة', render: p => p.cost == null ? '—' : money(p.cost) }, { label: 'المحطة', render: p => p.station || '-' },
          { label: 'الحالة', render: p => h('span', { class: 'badge ' + (p.isAvailable ? 'ok' : 'err') }, p.isAvailable ? 'متاح' : 'غير متاح') },
          { label: '', render: p => manage ? h('div', { class: 'row' }, h('button', { class: 'btn sm secondary', onclick: () => prodForm(p) }, 'تعديل'), h('button', { class: 'btn sm secondary', onclick: () => recipe(p) }, 'الوصفة'),
            h('button', { class: 'btn sm danger', onclick: async () => { if (await confirmBox('حذف المنتج؟')) { await API.del('/products/' + p.id).catch(fail); load(); } } }, 'حذف')) : '' }], prods, 'لا منتجات بعد'));
    }
  }
  function catForm(c) { formModal({ title: c ? 'تعديل تصنيف' : 'تصنيف جديد', values: c || { isActive: true, sortOrder: cats.length }, fields: [{ name: 'name', label: 'الاسم', required: true }, { name: 'sortOrder', label: 'الترتيب', type: 'number' }, { name: 'isActive', label: 'ظاهر في المنيو', type: 'checkbox' }], onSubmit: async d => { if (c) await API.patch('/products/categories/' + c.id, d); else await API.post('/products/categories', d); load(); } }); }
  v.append(tabs([['products', 'المنتجات'], ['cats', 'التصنيفات']], k => { tab = k; draw(); }), body);
  load();
})();
