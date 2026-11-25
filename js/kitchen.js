(async () => {
  const v = await boot('شاشة المطبخ', 'kitchen.view'); if (!v) return;
  let station = '', orders = [], known = new Set(), first = true;
  const grid = h('div', { class: 'kds' });
  const sel = h('select', { onchange: e => { station = e.target.value; draw(); } }, h('option', { value: '' }, 'كل المحطات'));
  const can = p => ME.permissions.includes(p);
  // READY -> hand-over depends on order type and payment: delivery goes out for delivery; others can only be handed over once paid (collected from the Orders screen).
  const nextOf = o => {
    if (!can('orders.update')) return null;
    if (o.status === 'READY') {
      if (o.type === 'DELIVERY') return ['OUT_FOR_DELIVERY', 'خرج للتوصيل'];
      return o.payStatus === 'PAID' ? ['COMPLETED', 'تسليم'] : null;
    }
    return { NEW: ['CONFIRMED', 'قبول'], CONFIRMED: ['PREPARING', 'بدء التحضير'], PREPARING: ['READY', 'جاهز'] }[o.status] || null;
  };
  function beep() { try { const c = new (window.AudioContext || window.webkitAudioContext)(); const o = c.createOscillator(); o.connect(c.destination); o.frequency.value = 880; o.start(); setTimeout(() => { o.stop(); c.close(); }, 250); } catch {} }
  async function load() {
    try {
      orders = await API.get('/orders/kitchen');
      const stations = [...new Set(orders.flatMap(o => o.items.map(i => i.product && i.product.station).filter(Boolean)))];
      const cur = sel.value; clear(sel); sel.append(h('option', { value: '' }, 'كل المحطات'), stations.map(s => h('option', { value: s, selected: s === cur }, s)));
      const fresh = orders.filter(o => !known.has(o.id)); orders.forEach(o => known.add(o.id));
      if (!first && fresh.length) beep(); first = false;
      draw();
    } catch (e) { fail(e); }
  }
  async function move(o, status) {
    try { await API.patch(`/orders/${o.id}/status`, { status }); load(); } catch (e) { fail(e.code === 'UNPAID' ? new Error('يجب تحصيل الطلب من شاشة الطلبات قبل التسليم') : e); }
  }
  const timers = [];
  function draw() {
    clear(grid); timers.length = 0;
    const list = orders.filter(o => !station || o.items.some(i => i.product && i.product.station === station));
    if (!list.length) grid.append(h('div', { class: 'card empty' }, 'لا طلبات حاليًا'));
    for (const o of list) {
      const t = h('span', { class: 'timer' }); timers.push([t, o]);
      const items = o.items.filter(i => !station || (i.product && i.product.station === station));
      const nx = nextOf(o);
      grid.append(h('div', { class: 'card ticket s-' + o.status },
        h('div', { class: 'row spread' }, h('strong', null, `#${o.number}`), t),
        h('div', { class: 'row' }, statusBadge(o.status), h('span', { class: 'muted' }, AR.type[o.type] + (o.table ? ' - طاولة ' + o.table.number : ''))),
        items.map(i => h('div', { class: 'cart-line' }, h('strong', null, `${i.quantity} ×`), h('span', null, i.name, Array.isArray(i.options) && i.options.length ? h('div', { class: 'muted' }, i.options.map(x => x.choice).join('، ')) : null, i.notes ? h('div', { class: 'price' }, i.notes) : null))),
        o.notes ? h('p', { class: 'price' }, 'ملاحظة: ' + o.notes) : null,
        nx ? h('button', { class: 'btn', style: 'width:100%', onclick: () => move(o, nx[0]) }, nx[1])
          : (o.status === 'READY' && o.type !== 'DELIVERY' && can('orders.update') ? h('div', { class: 'badge warn' }, 'بانتظار تحصيل المبلغ من شاشة الطلبات') : null),
        can('orders.cancel') && o.status !== 'READY' ? h('button', { class: 'btn secondary sm', onclick: async () => { if (await confirmBox('إلغاء الطلب #' + o.number + '؟')) move(o, 'CANCELLED'); } }, 'إلغاء') : null));
    }
    tick();
  }
  function tick() { for (const [el, o] of timers) { const s = Math.floor((Date.now() - new Date(o.createdAt)) / 1000); el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; el.className = 'timer' + (s > 900 ? ' late' : ''); } }
  setInterval(tick, 1000); setInterval(load, 20000);
  v.append(h('div', { class: 'toolbar' }, sel, h('button', { class: 'btn secondary', onclick: () => document.documentElement.requestFullscreen && document.documentElement.requestFullscreen() }, 'ملء الشاشة')), grid);
  connectSocket({ 'order:new': load, 'order:status': load });
  load();
})();
