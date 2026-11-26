(async () => {
  const v = await boot('المنتجات والتصنيفات', 'products.view'); if (!v) return;
  const manage = ME.permissions.includes('products.manage');
  let cats = [], prods = [], tab = 'products', fCat = '', fStatus = '', term = '', page = 1;
  const PAGE = 8;
  const body = h('div'), statsBox = h('div', { class: 'stats sq' });
  const EMOJI = [[/برجر|burger/i, '🍔'], [/بيتزا|pizza/i, '🍕'], [/مكرون|باستا|pasta/i, '🍝'], [/مشروب|عصير|drink|juice/i, '🥤'], [/حلو|dessert|كيك/i, '🍰'], [/سلط|salad/i, '🥗'], [/ساندوي|sandwich/i, '🥪'], [/قهوة|coffee/i, '☕'], [/دجاج|فراخ|chicken/i, '🍗'], [/لحم|مشاوي|grill/i, '🥩'], [/سمك|fish/i, '🐟'], [/مقبلات|starter/i, '🍟']];
  const emojiOf = n => { for (const [re, e] of EMOJI) if (re.test(n || '')) return e; return null; };
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
    clear(body); clear(statsBox);
    statsBox.append(statCard('orange', 'box', 'إجمالي المنتجات', prods.length), statCard('green', 'checkc', 'المنتجات المتاحة', prods.filter(p => p.isAvailable).length), statCard('purple', 'tag', 'التصنيفات', cats.length));
    if (tab === 'cats') {
      body.append(h('div', { class: 'filters' }, h('div', { class: 'grp' }), manage ? h('button', { class: 'btn lg', onclick: () => catForm() }, icon('plus', 20), 'إضافة تصنيف') : null),
        h('div', { class: 'tbl-card' }, dataTable([{ label: '#', render: c => cats.indexOf(c) + 1 }, { label: 'الاسم', render: c => h('span', { class: 'ic-line' }, emojiOf(c.name) || icon('tag', 18), c.name) }, { label: 'الترتيب', key: 'sortOrder' }, { label: 'ظاهر', render: c => chip(c.isActive ? 'نعم' : 'لا', c.isActive ? 'ok' : 'err') },
          { label: 'إجراءات', render: c => manage ? h('div', { class: 'act-row' }, h('button', { class: 'ibtn orange', title: 'تعديل', onclick: () => catForm(c) }, icon('edit', 18)), h('button', { class: 'ibtn red', title: 'حذف', onclick: async () => { if (await confirmBox('حذف التصنيف؟')) { await API.del('/products/categories/' + c.id).catch(fail); load(); } } }, icon('trash', 18))) : '' }], cats, 'لا توجد تصنيفات', 'rt')));
      return;
    }
    const sb = searchBox('البحث عن منتج...', x => { term = x; page = 1; draw2(); }); sb.style.maxWidth = 'none'; sb.querySelector('input').value = term;
    const table = h('div');
    const draw2 = () => {
      const rr = prods.filter(p => (!fCat || p.categoryId === fCat) && (!fStatus || (fStatus === 'on' ? p.isAvailable : !p.isAvailable)) && (!term.trim() || p.name.toLowerCase().includes(term.trim().toLowerCase())));
      const pg = Math.max(1, Math.ceil(rr.length / PAGE)); if (page > pg) page = pg;
      const sl = rr.slice((page - 1) * PAGE, page * PAGE);
      clear(table);
      table.append(h('div', { class: 'tbl-card' }, dataTable([
        { label: '#', render: p => prods.indexOf(p) + 1 },
        { label: 'صورة المنتج', render: p => p.imageUrl ? h('img', { class: 'p-thumb', src: p.imageUrl, alt: '' }) : h('span', { class: 'p-thumb none' }, icon('utensils', 22)) },
        { label: 'اسم المنتج', key: 'name' },
        { label: 'التصنيف', render: p => { const c = (cats.find(x => x.id === p.categoryId) || {}).name; return c ? h('span', { class: 'chip cat-chip' }, emojiOf(c) ? h('span', { class: 'em' }, emojiOf(c)) : null, c) : '-'; } },
        { label: 'سعر البيع', render: p => h('span', { class: 'ltr' }, money(p.price)) }, { label: 'تكلفة المنتج', render: p => p.cost == null ? '—' : h('span', { class: 'ltr' }, money(p.cost)) },
        { label: 'الحالة', render: p => chip(p.isAvailable ? 'متاح' : 'غير متاح', p.isAvailable ? 'ok' : 'err', 'dot') },
        { label: 'إجراءات', render: p => manage ? h('div', { class: 'act-row' }, h('button', { class: 'ibtn orange', title: 'تعديل', onclick: () => prodForm(p) }, icon('edit', 18)), h('button', { class: 'ibtn blue', title: 'الوصفة', onclick: () => recipe(p) }, icon('doc', 18)),
          h('button', { class: 'ibtn red', title: 'حذف', onclick: async () => { if (await confirmBox('حذف المنتج؟')) { await API.del('/products/' + p.id).catch(fail); load(); } } }, icon('trash', 18))) : '' }],
        sl, 'لا منتجات بعد', 'rt'), rr.length ? pager(rr.length, PAGE, page, k => { page = k; draw2(); }, `إجمالي النتائج: ${rr.length} ${rr.length === 1 ? 'منتج' : 'منتجات'}`) : null));
    };
    const catSel = selectPill('grid', [['', 'كل التصنيفات'], ...cats.map(c => [c.id, c.name])], fCat, k => { fCat = k; page = 1; draw2(); });
    const stSel = selectPill('checkc', [['', 'كل الحالات'], ['on', 'متاح'], ['off', 'غير متاح']], fStatus, k => { fStatus = k; page = 1; draw2(); });
    body.append(h('div', { class: 'filters' }, h('div', { class: 'grp', style: 'flex:1' }, catSel, stSel, sb), manage ? h('button', { class: 'btn lg', onclick: () => prodForm() }, icon('plus', 20), 'إضافة منتج') : null), table);
    draw2();
  }
  function catForm(c) { formModal({ title: c ? 'تعديل تصنيف' : 'تصنيف جديد', values: c || { isActive: true, sortOrder: cats.length }, fields: [{ name: 'name', label: 'الاسم', required: true }, { name: 'sortOrder', label: 'الترتيب', type: 'number' }, { name: 'isActive', label: 'ظاهر في المنيو', type: 'checkbox' }], onSubmit: async d => { if (c) await API.patch('/products/categories/' + c.id, d); else await API.post('/products/categories', d); load(); } }); }
  v.append(pageHead('المنتجات والتصنيفات', null, 'box'), h('div', { style: 'margin-bottom:16px' }, pillTabs([['products', 'المنتجات', 'box'], ['cats', 'التصنيفات', 'tag']], k => { tab = k; page = 1; draw(); })), statsBox, body);
  load();
})();
