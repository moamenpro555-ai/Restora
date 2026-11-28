(async () => {
  const v = await boot('شاشة المطبخ', 'kitchen.view', { standalone: true }); if (!v) return;
  const can = p => ME.permissions.includes(p);
  let station = '', tab = 'all', orders = [], served = [], known = new Set(), first = true;
  const grid = h('div', { class: 'kds' });
  const sel = h('select', { onchange: e => { station = e.target.value; draw(); } }, h('option', { value: '' }, 'الكل'));
  // NEW/CONFIRMED/PREPARING all count as "in preparation"; READY waits for hand-over; COMPLETED is "served".
  const META = { NEW: ['info', 'جديد', 'dot'], CONFIRMED: ['info', 'مؤكد', 'checkc'], PREPARING: ['warn', 'قيد التحضير', 'flame'], READY: ['info', 'جاهز للتقديم', 'cloche'], COMPLETED: ['ok', 'تم التقديم', 'checkc'] };
  // READY -> hand-over depends on order type and payment: delivery goes out for delivery; others can only be handed over once paid (collected from the Orders screen).
  const nextOf = o => {
    if (!can('orders.update')) return null;
    if (o.status === 'READY') {
      if (o.type === 'DELIVERY') return ['OUT_FOR_DELIVERY', 'خرج للتوصيل', 'scooter', 'go'];
      return o.payStatus === 'PAID' ? ['COMPLETED', 'تم التقديم', 'cloche', 'serve'] : null;
    }
    return { NEW: ['CONFIRMED', 'قبول', 'check'], CONFIRMED: ['PREPARING', 'بدء التحضير', 'flame'], PREPARING: ['READY', 'جاهز', 'checkc'] }[o.status] || null;
  };
  const clock = d => new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  function beep() { try { const c = new (window.AudioContext || window.webkitAudioContext)(); const o = c.createOscillator(); o.connect(c.destination); o.frequency.value = 880; o.start(); setTimeout(() => { o.stop(); c.close(); }, 250); } catch {} }
  async function load() {
    try {
      orders = await API.get('/orders/kitchen');
      if (tab === 'served' && can('orders.view')) served = (await API.get('/orders' + qs({ status: 'COMPLETED', ...rangeBounds(1) })).catch(() => [])).slice(0, 12);
      const stations = [...new Set(orders.flatMap(o => o.items.map(i => i.product && i.product.station).filter(Boolean)))];
      const cur = sel.value; clear(sel); sel.append(h('option', { value: '' }, 'الكل'), stations.map(s => h('option', { value: s, selected: s === cur }, s)));
      const fresh = orders.filter(o => !known.has(o.id)); orders.forEach(o => known.add(o.id));
      if (!first && fresh.length) beep(); first = false;
      draw();
    } catch (e) { fail(e); }
  }
  async function move(o, status) {
    if (status === 'OUT_FOR_DELIVERY') { if (await dispatchOrder(o)) load(); return; } // choose the delivery worker first
    try { await API.patch(`/orders/${o.id}/status`, { status }); load(); } catch (e) { fail(e.code === 'UNPAID' ? new Error('يجب تحصيل الطلب من شاشة الطلبات قبل التسليم') : e); }
  }
  const timers = [];
  function card(o, isServed) {
    const [tone, label, ico] = META[o.status] || ['neutral', AR.status[o.status], 'dot'];
    const items = o.items.filter(i => isServed || !station || (i.product && i.product.station === station));
    const nx = isServed ? null : nextOf(o);
    let foot = null;
    if (isServed) foot = h('div', { class: 'kt-foot done' }, icon('checkc', 20), 'تم تسليم الطلب');
    else if (o.status !== 'READY') { const t = h('span'); timers.push([t, o]); foot = h('div', { class: 'kt-foot wait' }, icon('timer', 20), t); foot.dataset.o = o.id; timers[timers.length - 1].push(foot); }
    else if (!nx && can('orders.update')) foot = h('div', { class: 'kt-foot hold' }, icon('card', 18), 'بانتظار تحصيل المبلغ من شاشة الطلبات');
    return h('div', { class: 'kt s-' + o.status },
      h('div', { class: 'kt-top' }, chip(label, tone, ico)),
      h('div', { class: 'kt-meta' }, h('span', { class: 'kt-num' }, `#${o.number}`), h('span', { class: 'kt-time' }, icon('clock', 20), clock(o.createdAt))),
      h('div', { class: 'kt-sub' }, AR.type[o.type] + (o.table ? ' - طاولة ' + o.table.number : '')),
      h('div', { class: 'kt-items' }, items.map(i => h('div', { class: 'kt-line' }, h('span', { class: 'q' }, i.quantity), h('span', { class: 'x' }, '×'),
        h('span', null, i.name, Array.isArray(i.options) && i.options.length ? h('small', null, i.options.map(x => x.choice).join('، ')) : null, i.notes ? h('small', { class: 'note' }, i.notes) : null)))),
      o.notes ? h('div', { class: 'kt-note' }, 'ملاحظة: ' + o.notes) : null,
      foot,
      nx ? h('button', { class: 'btn kt-act ' + (nx[3] || ''), onclick: () => move(o, nx[0]) }, icon(nx[2] || 'check', 20), nx[1]) : null,
      !isServed && can('orders.cancel') && o.status !== 'READY' ? h('button', { class: 'kt-cancel', onclick: async () => { if (await confirmBox('إلغاء الطلب #' + o.number + '؟')) move(o, 'CANCELLED'); } }, 'إلغاء الطلب') : null);
  }
  function draw() {
    clear(grid); timers.length = 0;
    const base = tab === 'served' ? served : orders.filter(o => tab === 'all' || (tab === 'ready' ? o.status === 'READY' : o.status !== 'READY'));
    const list = tab === 'served' ? base : base.filter(o => !station || o.items.some(i => i.product && i.product.station === station));
    if (!list.length) grid.append(h('div', { class: 'card empty fullc' }, 'لا طلبات حاليًا'));
    for (const o of list) grid.append(card(o, tab === 'served'));
    tick();
  }
  function tick() {
    for (const [el, o, box] of timers) {
      const m = Math.floor((Date.now() - new Date(o.createdAt)) / 60000);
      el.textContent = m < 1 ? 'منذ لحظات' : m === 1 ? 'منذ دقيقة' : m === 2 ? 'منذ دقيقتين' : `منذ ${m} ${m <= 10 ? 'دقائق' : 'دقيقة'}`;
      if (box) box.className = 'kt-foot ' + (m > 15 ? 'late' : 'wait');
    }
  }
  setInterval(tick, 15000); setInterval(() => { if (!document.hidden) load(); }, 45000); // the socket pushes changes; this is only a safety net
  const TABS = [['all', 'كل الطلبات', 'utensils'], ['prep', 'قيد التحضير', 'chef'], ['ready', 'جاهز للتقديم', 'checkc'], ...(can('orders.view') ? [['served', 'تم التقديم', 'check']] : [])];
  v.append(pageHead('شاشة المطبخ', 'تابع الطلبات الجارية وحدّث حالتها لحظة بلحظة', 'chef'),
    h('div', { class: 'filters' },
      h('div', { class: 'grp' }, pillTabs(TABS, k => { tab = k; load(); })),
      h('div', { class: 'grp' },
        h('label', { class: 'selpill' }, icon('filter', 18), sel),
        h('button', { class: 'btn soft', onclick: load }, icon('refresh', 18), 'تحديث'),
        h('button', { class: 'btn soft', title: 'ملء الشاشة', onclick: () => document.documentElement.requestFullscreen && document.documentElement.requestFullscreen() }, icon('expand', 18)))),
    grid,
    h('div', { class: 'tip' }, h('span', { class: 'tip-art' }, icon('chef', 96)), h('div', null, h('h3', null, 'كيف تعمل شاشة المطبخ ؟'), h('p', null, 'تابع الطلبات الجارية، وقم بتحديث حالة الطلبات بسهولة وسرعة.')), h('span', { class: 'tip-bulb' }, icon('bulb', 34))));
  connectSocket({ 'order:new': load, 'order:status': load });
  load();
})();
