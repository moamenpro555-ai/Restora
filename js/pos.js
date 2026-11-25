(async () => {
  const v = await boot('الكاشير', 'orders.create'); if (!v) return;
  v.append(loading());
  let products, cats, branches, tables = [], brand = null, register = null;
  try {
    [products, cats, branches, brand] = await Promise.all([API.get('/products'), API.get('/products/categories/all'), API.get('/branches'), API.get('/settings/branding').catch(() => null)]);
  } catch (e) { clear(v); v.append(h('div', { class: 'card empty' }, e.message)); return; }
  const mods = ME.tenant.modules || {};
  const st = { cat: 'all', q: '', cart: [], type: 'TAKEAWAY', branchId: branches[0] && branches[0].id, table: '', name: '', phone: '', addr: '', zoneId: '', discount: 0, notes: '' };
  async function loadTables() { if (mods.tables === false) return; try { tables = (await API.get('/tables')).filter(t => t.branchId === st.branchId); } catch { tables = []; } }
  async function loadRegister() { try { register = await API.get('/finance/registers/current' + qs({ branchId: st.branchId })); } catch { register = null; } }
  await Promise.all([loadTables(), loadRegister()]);
  let zones = []; try { zones = (await API.get('/delivery-zones')).filter(z => z.isActive); } catch {}

  const grid = h('div', { class: 'grid' }), catBar = h('div', { class: 'cats' }), cartBox = h('div', { class: 'card cart' });
  const key = l => l.productId + JSON.stringify(l.options) + (l.notes || '');
  const lineTotal = l => (l.price + l.options.reduce((s, o) => s + o.price, 0)) * l.qty;
  function totals() {
    const sub = st.cart.reduce((s, l) => s + lineTotal(l), 0);
    const disc = Math.min(Math.max(st.discount || 0, 0), sub);
    const tax = (sub - disc) * Number(mods.taxRate || 0) / 100;
    const zn = zones.find(z => z.id === st.zoneId); const fee = st.type === 'DELIVERY' ? Number(zn ? zn.fee : mods.deliveryFee || 0) : 0;
    return { sub, disc, tax, fee, total: sub - disc + tax + fee };
  }
  function drawProducts() {
    clear(catBar); clear(grid);
    [['all', 'الكل'], ...cats.map(c => [c.id, c.name])].forEach(([id, n]) => catBar.append(h('button', { class: 'btn sm ' + (st.cat === id ? '' : 'secondary'), onclick: () => { st.cat = id; drawProducts(); } }, n)));
    const list = products.filter(p => (st.cat === 'all' || p.categoryId === st.cat) && p.name.includes(st.q));
    if (!list.length) grid.append(h('div', { class: 'empty' }, 'لا منتجات'));
    list.forEach(p => grid.append(h('div', { class: 'card pcard' + (p.isAvailable ? '' : ' off'), onclick: () => pick(p) },
      p.imageUrl ? h('img', { src: p.imageUrl, alt: '' }) : null, h('strong', null, p.name), h('span', { class: 'price' }, money(p.price)))));
  }
  function addLine(p, options, notes) {
    const l = { productId: p.id, name: p.name, price: Number(p.price), options, qty: 1, notes };
    const ex = st.cart.find(x => key(x) === key(l));
    if (ex) ex.qty++; else st.cart.push(l);
    drawCart();
  }
  function pick(p) {
    const groups = Array.isArray(p.options) ? p.options : [];
    if (!groups.length) return addLine(p, []);
    const sel = {};
    const body = h('div', null, groups.map(g => h('div', null, h('strong', null, g.name + (g.required ? ' *' : '')),
      g.choices.map(c => h('label', { style: 'display:block' }, h('input', { type: g.multi ? 'checkbox' : 'radio', name: 'g-' + g.name, onchange: e => {
        sel[g.name] = sel[g.name] || [];
        if (g.multi) { if (e.target.checked) sel[g.name].push(c); else sel[g.name] = sel[g.name].filter(x => x !== c); } else sel[g.name] = [c];
      } }), `${c.name} ${c.price ? '(+' + c.price + ')' : ''}`)))),
      h('button', { class: 'btn', onclick: () => {
        for (const g of groups) if (g.required && !(sel[g.name] || []).length) return toast('اختر ' + g.name, true);
        const opts = groups.flatMap(g => (sel[g.name] || []).map(c => ({ group: g.name, choice: c.name, price: Number(c.price || 0) })));
        m.close(); addLine(p, opts);
      } }, 'إضافة'));
    const m = modal(p.name, body);
  }
  function drawCart() {
    clear(cartBox);
    const t = totals();
    cartBox.append(h('h3', null, 'الطلب الحالي'),
      branches.length > 1 ? h('select', { onchange: async e => { st.branchId = e.target.value; st.table = ''; await Promise.all([loadTables(), loadRegister()]); drawCart(); } }, branches.map(b => h('option', { value: b.id, selected: b.id === st.branchId }, b.name))) : null,
      !register ? h('div', { class: 'banner', style: 'border-radius:8px;margin-bottom:8px' }, 'لا توجد وردية نقدية مفتوحة ', h('button', { class: 'btn sm', onclick: openRegister }, 'فتح وردية')) : h('div', { class: 'muted' }, 'الوردية مفتوحة منذ ' + dt(register.openedAt) + ' '),
      register ? h('button', { class: 'btn secondary sm', onclick: closeRegister }, 'إغلاق الوردية') : null,
      h('select', { onchange: e => { st.type = e.target.value; drawCart(); } }, Object.entries(AR.type).filter(([k]) => k !== 'DINE_IN' || mods.tables !== false).filter(([k]) => k !== 'DELIVERY' || mods.delivery !== false).map(([k, n]) => h('option', { value: k, selected: k === st.type }, n))),
      st.type === 'DINE_IN' ? h('select', { onchange: e => { st.table = e.target.value; } }, h('option', { value: '' }, 'اختر الطاولة'), tables.map(x => h('option', { value: x.number, selected: x.number === st.table }, `طاولة ${x.number}${x.orders.length ? ' (مشغولة)' : ''}`))) : null,
      h('div', { class: 'two' }, h('input', { placeholder: 'اسم العميل', value: st.name, oninput: e => { st.name = e.target.value; } }), h('input', { placeholder: 'الهاتف', value: st.phone, oninput: e => { st.phone = e.target.value; } })),
      st.type === 'DELIVERY' ? h('input', { placeholder: 'عنوان التوصيل', value: st.addr, oninput: e => { st.addr = e.target.value; } }) : null,
      st.type === 'DELIVERY' && zones.length ? h('select', { onchange: e => { st.zoneId = e.target.value; drawTotals(); } }, h('option', { value: '' }, 'منطقة التوصيل (الرسوم الافتراضية)'), zones.map(z => h('option', { value: z.id, selected: z.id === st.zoneId }, `${z.name} - ${z.fee}`))) : null,
      st.cart.length ? st.cart.map((l, i) => h('div', { class: 'cart-line' }, h('div', null, h('strong', null, l.name), l.options.length ? h('div', { class: 'muted' }, l.options.map(o => o.choice).join('، ')) : null, h('small', { class: 'price' }, money(lineTotal(l)))),
        h('div', { class: 'qty' }, h('button', { onclick: () => { l.qty--; if (l.qty < 1) st.cart.splice(i, 1); drawCart(); } }, '−'), h('span', null, l.qty), h('button', { onclick: () => { l.qty++; drawCart(); } }, '+')))) : h('div', { class: 'empty' }, 'السلة فارغة'),
      h('input', { type: 'number', min: '0', placeholder: 'خصم (مبلغ)', value: st.discount || '', oninput: e => { st.discount = Number(e.target.value); drawTotals(); } }),
      h('input', { placeholder: 'ملاحظات', value: st.notes, oninput: e => { st.notes = e.target.value; } }),
      totalsBox,
      h('div', { class: 'row' }, h('button', { class: 'btn secondary', disabled: !st.cart.length, onclick: () => submit(false) }, 'إرسال بدون دفع'), h('button', { class: 'btn ok', disabled: !st.cart.length, onclick: () => submit(true) }, 'دفع وإنهاء')));
    drawTotals();
  }
  const totalsBox = h('div', { class: 'totals' });
  function drawTotals() {
    const t = totals(); clear(totalsBox);
    totalsBox.append(h('div', null, h('span', null, 'المجموع'), h('span', null, money(t.sub))), t.disc ? h('div', null, h('span', null, 'خصم'), h('span', null, '-' + money(t.disc))) : null,
      t.tax ? h('div', null, h('span', null, 'ضريبة'), h('span', null, money(t.tax))) : null, t.fee ? h('div', null, h('span', null, 'توصيل'), h('span', null, money(t.fee))) : null,
      h('div', { class: 't' }, h('span', null, 'الإجمالي'), h('span', null, money(t.total))), h('small', { class: 'muted' }, 'الإجمالي النهائي يحسبه الخادم'));
  }
  function openRegister() {
    formModal({ title: 'فتح وردية', fields: [{ name: 'openingBalance', label: 'رصيد الافتتاح', type: 'number', step: '0.01', required: true }], onSubmit: async d => { register = await API.post('/finance/registers/open', { ...d, branchId: st.branchId }); drawCart(); toast('تم فتح الوردية'); } });
  }
  function closeRegister() {
    formModal({ title: 'إغلاق الوردية', fields: [{ name: 'closingBalance', label: 'النقدية الفعلية بالدرج', type: 'number', step: '0.01', required: true }],
      onSubmit: async d => { const r = await API.post(`/finance/registers/${register.id}/close`, d); register = null; drawCart(); modal('نتيجة الجرد', h('div', null, h('p', null, 'المتوقع: ' + money(r.expectedBalance)), h('p', null, 'الفعلي: ' + money(r.closingBalance)), h('p', { class: r.difference === 0 ? '' : 'price' }, 'الفرق: ' + money(r.difference)))); } });
  }
  async function submit(payNow) {
    if (st.type === 'DINE_IN' && !st.table && mods.tables !== false) return toast('اختر الطاولة', true);
    const body = { type: st.type, branchId: st.branchId, customerName: st.name || undefined, customerPhone: st.phone || undefined, deliveryAddress: st.addr || undefined, notes: st.notes || undefined,
      discount: st.discount || undefined, zoneId: st.type === 'DELIVERY' ? st.zoneId || undefined : undefined, tableNumber: st.type === 'DINE_IN' ? st.table : undefined,
      items: st.cart.map(l => ({ productId: l.productId, quantity: l.qty, options: l.options.map(o => ({ group: o.group, choice: o.choice })) })) };
    try {
      let order = await API.post('/orders', body);
      if (payNow) {
        const lines = await collectPayment(Number(order.total));
        if (lines) {
          await API.post(`/orders/${order.id}/pay`, { payments: lines });
          if (st.type !== 'DINE_IN' && await confirmBox('تسليم الطلب الآن وإنهاؤه؟')) await API.patch(`/orders/${order.id}/status`, { status: 'COMPLETED' });
        }
      }
      toast(`تم إنشاء الطلب #${order.number}`);
      if (await confirmBox('طباعة الإيصال؟')) await printReceipt(order, brand);
      st.cart = []; st.discount = 0; st.notes = ''; st.name = ''; st.phone = ''; st.addr = ''; await loadTables(); drawCart();
    } catch (e) { fail(e); }
  }
  clear(v);
  v.append(h('div', { class: 'pos' }, h('div', { class: 'pos-products' }, h('input', { placeholder: 'بحث عن منتج...', oninput: e => { st.q = e.target.value; drawProducts(); } }), catBar, grid), cartBox));
  drawProducts(); drawCart();
})();
