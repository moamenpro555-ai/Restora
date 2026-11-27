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
  let bestName = ''; try { const bs = ((await API.get('/reports/dashboard')).bestSellers || [])[0]; if (bs && bs.qty > 0) bestName = bs.name; } catch {}
  let zones = []; try { zones = (await API.get('/delivery-zones')).filter(z => z.isActive); } catch {}

  const grid = h('div', { class: 'grid' }), catBar = h('div', { class: 'cats' }), cartBox = h('div', { class: 'card cart' });
  // category bar: arrows at both ends, mouse wheel and click-and-drag all scroll it sideways
  const dir = () => (getComputedStyle(catBar).direction === 'rtl' ? -1 : 1);
  const arrow = (side, name) => h('button', { type: 'button', class: 'cat-arrow ' + side, 'aria-label': side === 'l' ? 'السابق' : 'التالي', onclick: () => catBar.scrollBy({ left: (side === 'l' ? -1 : 1) * 320, behavior: 'smooth' }) }, icon(name, 18));
  const catWrap = h('div', { class: 'cats-wrap' }, arrow('l', 'chevl'), catBar, arrow('r', 'chevr'));
  const catOverflow = () => catWrap.classList.toggle('scrollable', catBar.scrollWidth > catBar.clientWidth + 4);
  window.addEventListener('resize', catOverflow);
  catBar.addEventListener('wheel', e => { if (catBar.scrollWidth <= catBar.clientWidth || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return; e.preventDefault(); catBar.scrollLeft += dir() * e.deltaY; }, { passive: false });
  let drag = null, moved = false;
  catBar.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button === 0) { drag = { x: e.clientX, s: catBar.scrollLeft }; moved = false; } });
  window.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x; if (Math.abs(dx) > 5) { moved = true; catBar.classList.add('dragging'); } if (moved) catBar.scrollLeft = drag.s - dx; });
  window.addEventListener('pointerup', () => { drag = null; setTimeout(() => catBar.classList.remove('dragging'), 0); });
  catBar.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
  const key = l => l.productId + JSON.stringify(l.options) + (l.notes || '');
  const lineTotal = l => (l.price + l.options.reduce((s, o) => s + o.price, 0)) * l.qty;
  const totals = () => totalsFor(st.discount);
  function totalsFor(discount) {
    const sub = st.cart.reduce((s, l) => s + lineTotal(l), 0);
    const disc = Math.min(Math.max(discount || 0, 0), sub);
    const tax = (sub - disc) * Number(mods.taxRate || 0) / 100;
    const zn = zones.find(z => z.id === st.zoneId); const fee = st.type === 'DELIVERY' ? Number(zn ? zn.fee : mods.deliveryFee || 0) : 0;
    return { sub, disc, tax, fee, total: sub - disc + tax + fee };
  }
  const catIcon = n => (/مشروب|عصير|قهوة|شاي|drink|juice|coffee/i.test(n) ? 'cup' : /حلو|كيك|dessert|cake|sweet/i.test(n) ? 'cake' : /وجب|رئيس|main|meal/i.test(n) ? 'cloche' : 'grid');
  function drawProducts() {
    clear(catBar); clear(grid); setTimeout(catOverflow, 0);
    [['all', 'الكل'], ...cats.map(c => [c.id, c.name])].forEach(([id, n]) => catBar.append(h('button', { class: 'pill' + (st.cat === id ? ' on' : ''), onclick: () => { st.cat = id; drawProducts(); } }, id === 'all' ? null : icon(catIcon(n), 18), n)));
    const list = products.filter(p => (st.cat === 'all' || p.categoryId === st.cat) && p.name.includes(st.q));
    if (!list.length) grid.append(h('div', { class: 'empty' }, 'لا منتجات'));
    list.forEach(p => grid.append(h('div', { class: 'card pcard' + (p.isAvailable ? '' : ' off') + (st.cart.some(l => l.productId === p.id) ? ' sel' : ''), 'data-id': p.id, onclick: () => pick(p) },
      h('div', { class: 'pimg' }, p.imageUrl ? h('img', { src: p.imageUrl, alt: '', loading: 'lazy' }) : icon('chef', 40), p.name === bestName ? h('span', { class: 'pbadge' }, icon('star', 13), 'الأكثر مبيعاً') : null),
      h('div', { class: 'pname' }, p.name),
      h('div', { class: 'pfoot' }, h('span', { class: 'price' }, p.isAvailable ? money(p.price) : 'غير متاح'), h('span', { class: 'padd' }, icon('plus', 18))))));
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
  function lineNote(l) {
    formModal({ title: 'ملاحظة على: ' + l.name, values: { notes: l.notes || '' }, fields: [{ name: 'notes', label: 'الملاحظة (تظهر للمطبخ)', type: 'textarea' }],
      onSubmit: async d => { l.notes = (d.notes || '').trim() || undefined; drawCart(); } });
  }
  function custSearch() { // look up a customer already saved in the customers list and fill the delivery details
    const res = h('div', { class: 'cust-res' }); let t;
    const pick = c => { st.name = c.name; st.phone = c.phone; st.addr = c.address || ''; st.zoneId = c.zoneId && zones.some(z => z.id === c.zoneId) ? c.zoneId : ''; drawCart(); toast('تم تحديد العميل'); };
    const input = h('input', { placeholder: 'بحث عن عميل (بالاسم أو الهاتف)...', oninput: e => {
      clearTimeout(t); const q = e.target.value.trim();
      if (q.length < 2) { clear(res); return; }
      t = setTimeout(async () => {
        try {
          const rows = await API.get('/customers/lookup' + qs({ q })); clear(res);
          if (!rows.length) res.append(h('div', { class: 'muted' }, 'لا يوجد عميل بهذا البحث - أدخل بياناته بالأسفل وسيُسجّل تلقائيًا'));
          rows.forEach(c => res.append(h('button', { type: 'button', class: 'cust-item', onclick: () => pick(c) }, h('strong', null, c.name), h('span', { class: 'ltr muted' }, ' ' + c.phone), c.address ? h('small', { class: 'muted' }, ' — ' + c.address) : null)));
        } catch {}
      }, 300);
    } });
    return h('div', null, input, res);
  }
  function drawCart() {
    drawShift(); clear(cartBox);
    grid.querySelectorAll('.pcard').forEach(c => c.classList.toggle('sel', st.cart.some(l => l.productId === c.dataset.id))); // highlight products already in the cart
    cartBox.append(h('div', { class: 'cart-scroll' }, h('div', { class: 'cart-head' }, h('h3', null, 'الطلب الحالي'), icon('cart', 24)),
      branches.length > 1 ? h('select', { onchange: async e => { st.branchId = e.target.value; st.table = ''; await Promise.all([loadTables(), loadRegister()]); drawCart(); } }, branches.map(b => h('option', { value: b.id, selected: b.id === st.branchId }, b.name))) : null,
      h('select', { onchange: e => { st.type = e.target.value; drawCart(); } }, Object.entries(AR.type).filter(([k]) => k !== 'DINE_IN' || mods.tables !== false).filter(([k]) => k !== 'DELIVERY' || mods.delivery !== false).map(([k, n]) => h('option', { value: k, selected: k === st.type }, n))),
      st.type === 'DINE_IN' ? h('select', { onchange: e => { st.table = e.target.value; } }, h('option', { value: '' }, 'اختر الطاولة'), tables.map(x => h('option', { value: x.number, selected: x.number === st.table }, `طاولة ${x.number}${x.orders.length ? ' (مشغولة)' : ''}`))) : null,
      st.type === 'DELIVERY' ? custSearch() : null,
      h('div', { class: 'two' }, h('input', { placeholder: 'اسم العميل', value: st.name, oninput: e => { st.name = e.target.value; } }), h('input', { placeholder: 'الهاتف', value: st.phone, oninput: e => { st.phone = e.target.value; } })),
      st.type === 'DELIVERY' ? h('input', { placeholder: 'عنوان التوصيل', value: st.addr, oninput: e => { st.addr = e.target.value; } }) : null,
      st.type === 'DELIVERY' ? h('div', null, h('label', { class: 'sec' }, 'المنطقة'), h('select', { onchange: e => { st.zoneId = e.target.value; drawTotals(); } }, h('option', { value: '' }, zones.length ? 'اختر المنطقة (أو الرسوم الافتراضية)' : 'لا توجد مناطق - أضفها من الإعدادات'), zones.map(z => h('option', { value: z.id, selected: z.id === st.zoneId }, `${z.name} - ${money(z.fee)}`)))) : null,
      h('label', { class: 'sec' }, 'الأصناف المضافة'),
      st.cart.length ? h('div', { class: 'cart-lines' }, st.cart.map((l, i) => h('div', { class: 'cart-line' }, h('div', null, h('strong', null, l.name), l.options.length ? h('div', { class: 'muted' }, l.options.map(o => o.choice).join('، ')) : null, l.notes ? h('div', { class: 'ln-note-t' }, icon('note', 14), l.notes) : null, h('small', { class: 'price' }, money(lineTotal(l)))),
        h('div', { class: 'qty' }, h('button', { class: 'ln-note' + (l.notes ? ' has' : ''), title: 'ملاحظة على الصنف', onclick: () => lineNote(l) }, icon(l.notes ? 'edit' : 'plus', 15)), h('button', { onclick: () => { l.qty--; if (l.qty < 1) st.cart.splice(i, 1); drawCart(); } }, '−'), h('span', null, l.qty), h('button', { onclick: () => { l.qty++; drawCart(); } }, '+')))))
        : h('div', { class: 'empty-cart' }, h('div', { class: 'ec-ico' }, icon('cart', 44)), h('strong', null, 'لم يتم إضافة أي أصناف بعد'), h('small', null, 'اختر المنتجات من القائمة لإضافتها إلى الطلب')),
    ), h('div', { class: 'cart-foot' }, totalsBox,
      h('button', { class: 'btn checkout', disabled: !st.cart.length, onclick: () => submit(true) }, icon('card', 20), 'إتمام الطلب والدفع')));
    drawTotals(); tick();
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
    let pay = null;
    if (payNow) { // the payment dialog also takes the discount and the order notes; nothing is created if it is dismissed
      pay = await collectPayment(totals().total, { totalFor: d => totalsFor(d).total, discount: st.discount, notes: st.notes });
      if (!pay) return;
      st.discount = pay.discount; st.notes = pay.notes;
    }
    const body = { type: st.type, branchId: st.branchId, customerName: st.name || undefined, customerPhone: st.phone || undefined, deliveryAddress: st.addr || undefined, notes: st.notes || undefined,
      discount: st.discount || undefined, zoneId: st.type === 'DELIVERY' ? st.zoneId || undefined : undefined, tableNumber: st.type === 'DINE_IN' ? st.table : undefined,
      items: st.cart.map(l => ({ productId: l.productId, quantity: l.qty, notes: l.notes || undefined, options: l.options.map(o => ({ group: o.group, choice: o.choice })) })) };
    try {
      const order = await API.post('/orders', body);
      if (pay) {
        const lines = pay.lines.map(l => ({ ...l })), r2 = x => Math.round(x * 100) / 100, sum = r2(lines.reduce((a, l) => a + l.amount, 0));
        // a full payment follows the server's authoritative total (cent rounding); a deliberate part-payment is left as entered
        if (Math.abs(sum - r2(totalsFor(st.discount).total)) < 0.02) lines[lines.length - 1].amount = r2(lines[lines.length - 1].amount + Number(order.total) - sum);
        await API.post(`/orders/${order.id}/pay`, { payments: lines });
        await sendToKitchen(order); // paid -> goes to the kitchen
        toast(`تم الدفع وأُرسل الطلب #${order.number} للمطبخ`);
      } else { await sendToKitchen(order); toast(`تم إرسال الطلب #${order.number} للمطبخ`); }
      KDS.refresh();
      if (await confirmBox('طباعة الإيصال؟')) await printReceipt(order, brand);
      st.cart = []; st.discount = 0; st.notes = ''; st.name = ''; st.phone = ''; st.addr = ''; await loadTables(); drawCart();
    } catch (e) { fail(e); }
  }
  // Live clock (top bar): current time and date, updates every second.
  const tVal = h('span', { class: 't-val' }), tLbl = h('small'), timerChip = h('div', { class: 'shift-timer' }, icon('clock', 22), h('div', null, tVal, tLbl));
  function tick() {
    const d = new Date();
    tVal.textContent = d.toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    tLbl.textContent = d.toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  setInterval(tick, 1000);
  // Cash shift control lives in the top bar next to the clock.
  const shiftBox = h('div', { class: 'shift-chip-wrap' });
  function drawShift() {
    clear(shiftBox);
    shiftBox.append(!register
      ? h('button', { class: 'shift-chip warn', onclick: openRegister, title: 'لا توجد وردية نقدية مفتوحة' }, icon('play', 18), 'فتح وردية')
      : h('div', { class: 'shift-chip ok' }, icon('clock', 18), h('div', { class: 'sc-t' }, h('b', null, 'الوردية مفتوحة'), h('small', null, 'منذ ' + dt(register.openedAt))),
        h('button', { class: 'sc-x', onclick: closeRegister }, 'إغلاق')));
  }
  const slot = $('#bar-slot'); if (slot) slot.append(shiftBox, timerChip);
  clear(v);
  v.append(h('div', { class: 'pos' }, h('div', { class: 'pos-products' }, h('div', { class: 'search' }, h('input', { placeholder: 'ابحث عن منتج...', oninput: e => { st.q = e.target.value; drawProducts(); } }), h('span', { class: 'search-ico' }, icon('search', 20))), catWrap, grid), cartBox));
  drawProducts(); drawCart();
  // Pinned kitchen list beside the cart (toggled from the kitchen button in the top bar).
  const posEl = v.querySelector('.pos'); let kds = null;
  function syncKds() {
    const on = KDS.pinned() && KDS.allowed();
    posEl.classList.toggle('with-kds', on);
    if (on && !kds) { kds = KDS.view({ pinnedView: true }); posEl.append(kds.el); }
    else if (!on && kds) { kds.destroy(); kds.el.remove(); kds = null; }
  }
  window.addEventListener('kdspin', syncKds); syncKds();
})();
