(async () => {
  const v = await boot('الطلبات', 'orders.view'); if (!v) return;
  const can = p => ME.permissions.includes(p);
  let status = '', brand = null;
  const list = h('div');
  const NEXT = o => ({ NEW: 'CONFIRMED', CONFIRMED: 'PREPARING', PREPARING: 'READY', READY: o.type === 'DELIVERY' ? 'OUT_FOR_DELIVERY' : 'COMPLETED', OUT_FOR_DELIVERY: 'COMPLETED' }[o.status]);
  const paid = o => (o.payments || []).reduce((s, p) => s + (p.isRefund ? -1 : 1) * Number(p.amount), 0);
  async function act(fn) { try { await fn(); await load(); } catch (e) { fail(e); } }
  async function load() {
    clear(list); list.append(loading());
    try {
      const rows = await API.get('/orders' + qs({ status }));
      clear(list);
      list.append(dataTable([
        { label: '#', render: r => r.number }, { label: 'المصدر', render: r => AR.source[r.source] }, { label: 'النوع', render: r => AR.type[r.type] + (r.table ? ' - ' + r.table.number : '') },
        { label: 'العميل', render: r => r.customerName || '-' }, { label: 'الحالة', render: r => statusBadge(r.status) }, { label: 'الدفع', render: r => statusBadge(r.payStatus) },
        { label: 'الإجمالي', render: r => money(r.total) }, { label: 'الوقت', render: r => r.scheduledFor ? h('span', { class: 'badge warn' }, 'مجدول: ' + dt(r.scheduledFor)) : dt(r.createdAt) },
        { label: '', render: r => h('div', { class: 'row' }, h('button', { class: 'btn sm secondary', onclick: () => details(r.id) }, 'تفاصيل'),
          NEXT(r) && can('orders.update') ? h('button', { class: 'btn sm', onclick: () => act(() => API.patch(`/orders/${r.id}/status`, { status: NEXT(r) })) }, AR.status[NEXT(r)]) : null) }], rows, 'لا توجد طلبات'));
    } catch (e) { clear(list); list.append(h('div', { class: 'card empty' }, e.message)); }
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
        o.customerName ? h('p', null, `${o.customerName} ${o.customerPhone || ''}`) : null, o.deliveryAddress ? h('p', null, 'العنوان: ' + o.deliveryAddress) : null, o.notes ? h('p', null, 'ملاحظات: ' + o.notes) : null,
        o.items.map(i => h('div', { class: 'cart-line' }, h('span', null, `${i.quantity} × ${i.name}`, Array.isArray(i.options) && i.options.length ? h('small', { class: 'muted' }, ' (' + i.options.map(x => x.choice).join('، ') + ')') : null), h('span', null, money(Number(i.unitPrice) * i.quantity)))),
        h('div', { class: 'totals' }, h('div', { class: 't' }, h('span', null, 'الإجمالي'), h('span', null, money(o.total))), h('div', null, h('span', null, 'المدفوع'), h('span', null, money(paid(o))))),
        o.payments.length ? h('div', { class: 'muted' }, o.payments.map(p => `${p.isRefund ? 'استرداد' : 'دفع'} ${AR.method[p.method]} ${money(p.amount)}`).join(' | ')) : null,
        h('div', { class: 'row', style: 'margin-top:12px' },
          ['NEW', 'CONFIRMED', 'PREPARING'].includes(o.status) && can('orders.update') && can('products.view') ? h('button', { class: 'btn secondary', onclick: () => { m.close(); addItems(o); } }, 'إضافة أصناف') : null,
          !closed && remaining > 0.005 && can('orders.update') ? h('button', { class: 'btn ok', onclick: async () => { const l = await collectPayment(remaining); if (l) { m.close(); act(() => API.post(`/orders/${o.id}/pay`, { payments: l })); } } }, 'تحصيل') : null,
          paid(o) > 0 && can('orders.refund') ? h('button', { class: 'btn secondary', onclick: () => { m.close(); formModal({ title: 'استرداد', fields: [{ name: 'amount', label: 'المبلغ', type: 'number', step: '0.01', required: true }, { name: 'method', label: 'الطريقة', type: 'select', options: Object.entries(AR.method).map(([value, label]) => ({ value, label })) }, { name: 'note', label: 'السبب' }], onSubmit: async d => { await API.post(`/orders/${o.id}/refund`, d); load(); } }); } }, 'استرداد') : null,
          !closed && can('orders.cancel') ? h('button', { class: 'btn danger', onclick: async () => { if (await confirmBox('إلغاء الطلب؟')) { m.close(); act(() => API.patch(`/orders/${o.id}/status`, { status: 'CANCELLED' })); } } }, 'إلغاء') : null,
          h('button', { class: 'btn secondary', onclick: async () => { if (!brand) brand = await API.get('/settings/branding').catch(() => null); printReceipt(o, brand); } }, 'طباعة'))), { wide: false });
    } catch (e) { fail(e); }
  }
  v.append(tabs([['', 'الكل'], ...Object.entries(AR.status)], k => { status = k; load(); }), list);
  connectSocket({ 'order:new': () => { toast('طلب جديد'); load(); }, 'order:status': load });
  load();
  if (location.hash.length > 1) details(decodeURIComponent(location.hash.slice(1)));
})();
