(async () => {
  const v = await boot('سجل المبيعات', 'orders.view', { foot: { text: 'مع Restora .. مطعمك دائماً في المقدمة', icon: 'heart', brand: true } }); if (!v) return;
  const can = p => ME.permissions.includes(p);
  let status = '', type = '', days = 7, page = 1, rows = [], brand = null;
  const PAGE = 10;
  const list = h('div');
  const NEXT = o => ({ NEW: 'CONFIRMED', CONFIRMED: 'PREPARING', PREPARING: 'READY', READY: o.type === 'DELIVERY' ? 'OUT_FOR_DELIVERY' : 'COMPLETED', OUT_FOR_DELIVERY: 'COMPLETED' }[o.status]);
  const paid = o => (o.payments || []).reduce((s, p) => s + (p.isRefund ? -1 : 1) * Number(p.amount), 0);
  const TYPE_ICO = { DINE_IN: 'utensils', TAKEAWAY: 'bag', DELIVERY: 'scooter' };
  const ST_CHIP = { NEW: ['info', 'dot'], CONFIRMED: ['info', 'checkc'], PREPARING: ['warn', 'dot'], READY: ['ok', 'checkc'], OUT_FOR_DELIVERY: ['info', 'scooter'], COMPLETED: ['ok', 'checkc'], CANCELLED: ['err', 'xc'] };
  const pad = n => String(n).padStart(2, '0');
  const dateStr = d => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
  const timeStr = d => d.toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' });
  const payChip = o => {
    const last = (o.payments || []).filter(p => !p.isRefund).slice(-1)[0];
    const tone = { PAID: 'ok', PARTIAL: 'warn', UNPAID: 'warn', REFUNDED: 'err' }[o.payStatus] || 'warn';
    return chip(o.payStatus === 'PAID' && last ? AR.method[last.method] : AR.pay[o.payStatus], tone, 'card');
  };
  async function act(fn) { try { await fn(); await load(true); } catch (e) { fail(e); } }
  function draw() {
    clear(list);
    const filtered = rows.filter(r => !type || r.type === type);
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE)); if (page > pages) page = pages;
    const slice = filtered.slice((page - 1) * PAGE, page * PAGE);
    const table = dataTable([
      { label: '#', render: r => r.number }, { label: 'المصدر', render: r => chip(AR.source[r.source], 'dark', 'store') },
      { label: 'النوع', render: r => h('span', { class: 'ic-line' }, icon(TYPE_ICO[r.type] || 'utensils', 18), AR.type[r.type] + (r.table ? ' - ' + r.table.number : '')) },
      { label: 'العميل', render: r => r.customerName || '-' },
      { label: 'الحالة', render: r => chip(AR.status[r.status], ST_CHIP[r.status][0], ST_CHIP[r.status][1]) }, { label: 'الدفع', render: r => payChip(r) },
      { label: 'الإجمالي', render: r => h('span', { class: 'ltr' }, money(r.total)) },
      { label: 'الوقت', render: r => { const d = new Date(r.scheduledFor || r.createdAt); return h('div', null, h('span', { class: 'ic-line ltr' }, icon('clock', 16), timeStr(d)), h('span', { class: 'sub ltr' }, dateStr(d)), r.scheduledFor ? chip('مجدول', 'warn') : null); } },
      { label: 'تفاصيل', render: r => h('div', { class: 'act-row' }, h('button', { class: 'btn detail', onclick: () => details(r.id) }, icon('eye', 18), 'تفاصيل'),
        NEXT(r) && can('orders.update') ? h('button', { class: 'btn next-btn', onclick: () => act(() => API.patch(`/orders/${r.id}/status`, { status: NEXT(r) })) }, AR.status[NEXT(r)]) : null,
        can('orders.update') ? h('button', { class: 'btn danger sm', title: 'حذف الطلب', onclick: () => deleteOrder(r) }, icon('xc', 16)) : null) }], slice, 'لا توجد طلبات', 'rt');
    list.append(h('div', { class: 'tbl-card' }, table, filtered.length ? pager(filtered.length, PAGE, page, n => { page = n; draw(); }, `إجمالي الطلبات: ${filtered.length} ${filtered.length === 1 ? 'طلب' : 'طلبات'}`) : null));
  }
  async function load(silent) {
    if (silent !== true) { clear(list); list.append(loading()); }
    try { rows = await API.get('/orders' + qs({ status, ...(days ? rangeBounds(days) : {}) })); draw(); }
    catch (e) { if (silent === true) return; clear(list); list.append(h('div', { class: 'card empty' }, e.message)); }
  }
  // Live updates: any status change made in the cashier or the kitchen refreshes this list by itself (no spinner), with polling as a fallback.
  let pend = null;
  const soon = () => { clearTimeout(pend); pend = setTimeout(() => load(true), 300); };
  // Delete an order for good: needs the password the owner set in Settings.
  function deleteOrder(o) {
    const pw = h('input', { type: 'password', placeholder: 'باسورد الحذف', autocomplete: 'off', required: true });
    const go = async e => {
      e.preventDefault(); if (!pw.value) return;
      try { await API.del('/orders/' + o.id, { password: pw.value }); m.close(); toast(`تم حذف الطلب #${o.number}`); load(true); }
      catch (err) { fail(err); pw.value = ''; pw.focus(); }
    };
    const m = modal(`حذف الطلب #${o.number}`, h('form', { onsubmit: go },
      h('p', null, 'سيُحذف الطلب نهائيًا من السجل وتُعاد كمية المخزون المخصومة. أدخل الباسورد الذي حدده المالك للمتابعة.'), pw,
      h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'btn danger', type: 'submit' }, 'حذف نهائي'), h('button', { class: 'btn secondary', type: 'button', onclick: () => m.close() }, 'إلغاء'))));
    setTimeout(() => pw.focus(), 50);
  }
  // Add items to an open order (server re-prices everything).
  async function addItems(o) {
    let prods;
    try { prods = (await API.get('/products')).filter(p => p.isAvailable); } catch (e) { return fail(e); }
    const cart = []; let term = '';
    const listBox = h('div', { style: 'max-height:260px;overflow:auto' }), cartBox = h('div');
    const unit = l => l.price + l.options.reduce((s, x) => s + x.price, 0);
    const drawCart = () => { clear(cartBox); cartBox.append(cart.length ? cart.map((l, i) => h('div', { class: 'cart-line' }, h('span', null, `${l.qty} × ${l.name}`, l.options.length ? h('small', { class: 'muted' }, ' (' + l.options.map(x => x.choice).join('، ') + ')') : null), h('span', null, money(unit(l) * l.qty), ' ', h('button', { class: 'btn sm secondary', onclick: () => { cart.splice(i, 1); drawCart(); } }, '✕')))) : h('div', { class: 'muted' }, 'لم تُضف أصناف بعد')); };
    const add = (p, options) => { const l = { productId: p.id, name: p.name, price: Number(p.price), options, qty: 1 }; const k = x => x.productId + JSON.stringify(x.options); const ex = cart.find(x => k(x) === k(l)); if (ex) ex.qty++; else cart.push(l); drawCart(); };
    const choose = p => {
      const groups = Array.isArray(p.options) ? p.options : []; if (!groups.length) return add(p, []);
      const sel = {};
      const mm = modal(p.name, h('div', null, groups.map(g => h('div', null, h('strong', null, g.name + (g.required ? ' *' : '')), g.choices.map(c => h('label', { style: 'display:block' }, h('input', { type: g.multi ? 'checkbox' : 'radio', name: 'g-' + g.name, onchange: e => { sel[g.name] = sel[g.name] || []; if (g.multi) { sel[g.name] = e.target.checked ? [...sel[g.name], c] : sel[g.name].filter(x => x !== c); } else sel[g.name] = [c]; } }), `${c.name} ${c.price ? '(+' + c.price + ')' : ''}`)))),
        h('button', { class: 'btn', onclick: () => { for (const g of groups) if (g.required && !(sel[g.name] || []).length) return toast('اختر ' + g.name, true); mm.close(); add(p, groups.flatMap(g => (sel[g.name] || []).map(c => ({ group: g.name, choice: c.name, price: Number(c.price || 0) })))); } }, 'إضافة')));
    };
    const drawList = () => { clear(listBox); prods.filter(p => !term || p.name.includes(term)).forEach(p => listBox.append(h('div', { class: 'cart-line', style: 'cursor:pointer', onclick: () => choose(p) }, h('span', null, p.name), h('span', { class: 'price' }, money(p.price))))); };
    const m = modal(`إضافة أصناف للطلب #${o.number}`, h('div', null, h('input', { placeholder: 'بحث...', oninput: e => { term = e.target.value; drawList(); } }), listBox, h('h3', null, 'الأصناف المضافة'), cartBox,
      h('button', { class: 'btn', style: 'margin-top:10px', onclick: async () => { if (!cart.length) return toast('أضف صنفًا واحدًا على الأقل', true);
        try { await API.post(`/orders/${o.id}/items`, { items: cart.map(l => ({ productId: l.productId, quantity: l.qty, options: l.options.map(x => ({ group: x.group, choice: x.choice })) })) }); m.close(); toast('تمت إضافة الأصناف'); await load(); details(o.id); } catch (e) { fail(e); } } }, 'تأكيد الإضافة')), { wide: true });
    drawList(); drawCart();
  }
  async function details(id) {
    try {
      const o = await API.get('/orders/' + id); const remaining = Number(o.total) - paid(o);
      const closed = ['COMPLETED', 'CANCELLED'].includes(o.status);
      const m = modal(`طلب #${o.number}`, h('div', null,
        h('div', { class: 'row' }, statusBadge(o.status), statusBadge(o.payStatus), h('span', { class: 'muted' }, `${AR.type[o.type]} - ${AR.source[o.source]}`)),
        o.customerName ? h('p', null, `${o.customerName} ${o.customerPhone || ''}`) : null, o.driver ? h('p', null, 'عامل التوصيل: ' + o.driver.name) : null, o.deliveryAddress ? h('p', null, 'العنوان: ' + o.deliveryAddress) : null, o.notes ? h('p', null, 'ملاحظات: ' + o.notes) : null,
        o.items.map(i => h('div', { class: 'cart-line' }, h('span', null, `${i.quantity} × ${i.name}`, Array.isArray(i.options) && i.options.length ? h('small', { class: 'muted' }, ' (' + i.options.map(x => x.choice).join('، ') + ')') : null), h('span', null, money(Number(i.unitPrice) * i.quantity)))),
        h('div', { class: 'totals' }, h('div', { class: 't' }, h('span', null, 'الإجمالي'), h('span', null, money(o.total))), h('div', null, h('span', null, 'المدفوع'), h('span', null, money(paid(o))))),
        o.payments.length ? h('div', { class: 'muted' }, o.payments.map(p => `${p.isRefund ? 'استرداد' : 'دفع'} ${AR.method[p.method]} ${money(p.amount)}`).join(' | ')) : null,
        h('div', { class: 'row', style: 'margin-top:12px' },
          ['NEW', 'CONFIRMED', 'PREPARING'].includes(o.status) && can('orders.update') && can('products.view') ? h('button', { class: 'btn secondary', onclick: () => { m.close(); addItems(o); } }, 'إضافة أصناف') : null,
          !closed && remaining > 0.005 && can('orders.update') ? h('button', { class: 'btn ok', onclick: async () => { const l = await collectPayment(remaining); if (l) { m.close(); act(async () => { await API.post(`/orders/${o.id}/pay`, { payments: l }); await sendToKitchen(o); }); } } }, 'تحصيل') : null,
          paid(o) > 0 && can('orders.refund') ? h('button', { class: 'btn secondary', onclick: () => { m.close(); formModal({ title: 'استرداد', fields: [{ name: 'amount', label: 'المبلغ', type: 'number', step: '0.01', required: true }, { name: 'method', label: 'الطريقة', type: 'select', options: Object.entries(AR.method).map(([value, label]) => ({ value, label })) }, { name: 'note', label: 'السبب' }], onSubmit: async d => { await API.post(`/orders/${o.id}/refund`, d); load(); } }); } }, 'استرداد') : null,
          !closed && can('orders.cancel') ? h('button', { class: 'btn danger', onclick: async () => { if (await confirmBox('إلغاء الطلب؟')) { m.close(); act(() => API.patch(`/orders/${o.id}/status`, { status: 'CANCELLED' })); } } }, 'إلغاء') : null,
          h('button', { class: 'btn secondary', onclick: async () => { if (!brand) brand = await API.get('/settings/branding').catch(() => null); printReceipt(o, brand); } }, 'طباعة'),
          can('orders.update') ? h('button', { class: 'btn danger', onclick: () => { m.close(); deleteOrder(o); } }, 'حذف') : null)), { wide: false });
    } catch (e) { fail(e); }
  }
  const PILLS = [['', 'الكل', 'grid'], ['NEW', 'جديد', 'dot', 'info'], ['CONFIRMED', 'مؤكد', 'checkc', 'info'], ['PREPARING', 'قيد التحضير', 'chef', 'warn'], ['READY', 'جاهز', 'checkc', 'ok'],
    ['OUT_FOR_DELIVERY', 'في الطريق', 'scooter', 'info'], ['COMPLETED', 'مكتمل', 'checkc', 'ok'], ['CANCELLED', 'ملغي', 'xc', 'err']];
  v.append(pageHead('سجل المبيعات', 'متابعة جميع طلبات ومبيعات مطعمك', 'bars'),
    h('div', { class: 'filters' },
      h('div', { class: 'grp' }, pillTabs(PILLS, k => { status = k; page = 1; load(); })),
      h('div', { class: 'grp' },
        selectPill('filter', [['', 'الكل'], ...Object.entries(AR.type)], type, k => { type = k; page = 1; draw(); }),
        selectPill('calendar', [[1, 'اليوم'], [7, 'آخر 7 أيام'], [30, 'آخر 30 يوم'], [0, 'كل الوقت']], days, k => { days = Number(k); page = 1; load(); }))),
    list);
  const sock = connectSocket({ 'order:new': () => { toast('طلب جديد'); soon(); }, 'order:status': soon });
  setInterval(() => { if (!document.hidden) load(true); }, 20000); // safety net if the socket drops (e.g. the server was asleep)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) soon(); });
  load();
  if (location.hash.length > 1) details(decodeURIComponent(location.hash.slice(1)));
})();
