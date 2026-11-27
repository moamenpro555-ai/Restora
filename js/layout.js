// App shell: sidebar (filtered by permissions), topbar, theme, notifications, branding, live socket.
const NAV = [
  ['dashboard.html', 'لوحة التحكم', 'orders.view'], ['pos.html', 'الكاشير', 'orders.create'], ['orders.html', 'سجل المبيعات', 'orders.view'],
  ['tables.html', 'الطاولات', 'tables.manage'], ['reservations.html', 'الحجوزات', 'reservations.manage'],
  ['products.html', 'المنتجات والتصنيفات', 'products.view'], ['inventory.html', 'المخزون والوصفات', 'inventory.manage'],
  ['customers.html', 'العملاء', 'customers.manage'], ['employees.html', 'الموظفون والصلاحيات', 'employees.manage'], ['branches.html', 'الفروع', 'branches.manage'],
  ['finance.html', 'المالية', 'finance.view'], ['shifts.html', 'الورديات', 'finance.view'], ['reports.html', 'التقارير', 'reports.view'], ['settings.html', 'الإعدادات والواجهة', 'settings.manage'],
  ['subscriptions.html', 'الاشتراكات', 'subscription.manage'], ['attendance.html', 'الحضور والانصراف', null], ['payroll.html', 'رواتب الموظفين', 'employees.manage'], ['support.html', 'الدعم الفني', null]
];
const NAV_ICON = { 'dashboard.html': 'home', 'pos.html': 'pos', 'orders.html': 'list', 'kitchen.html': 'chef', 'tables.html': 'table', 'reservations.html': 'calendar', 'products.html': 'tag',
  'inventory.html': 'box', 'customers.html': 'users', 'employees.html': 'shield', 'branches.html': 'store', 'finance.html': 'trend', 'shifts.html': 'clock', 'reports.html': 'bars', 'settings.html': 'gear',
  'subscriptions.html': 'crown', 'attendance.html': 'clock', 'payroll.html': 'wallet', 'support.html': 'support', 'admin.html': 'crown' };
const ADMIN_NAV = [['admin.html', 'لوحة المنصة', null]];
let ME = null;

async function boot(title, perm, opts = {}) {
  requireLogin();
  try { window.ME = ME = await API.get('/auth/me'); } catch (e) { return null; }
  const isAdmin = ME.kind === 'PLATFORM_ADMIN';
  if (isAdmin !== !!opts.admin) { location.href = isAdmin ? 'admin.html' : 'dashboard.html'; return null; }
  document.documentElement.dataset.theme = localStorage.getItem('theme') || 'light';
  let branding = null;
  if (!isAdmin) { try { branding = await API.get('/settings/branding'); applyBranding(branding); } catch {} }
  document.documentElement.style.setProperty('--font', `'${(branding && branding.fontFamily) || 'Cairo'}','Cairo',system-ui,sans-serif`);

  const resOn = !!(ME.tenant && (ME.tenant.modules || {}).reservationsEnabled);
  const nav = (isAdmin ? ADMIN_NAV : NAV).filter(n => (!n[2] || ME.permissions.includes(n[2])) && (n[0] !== 'reservations.html' || resOn));
  const here = location.pathname.split('/').pop();
  const logoImg = branding && branding.logoUrl ? h('img', { src: branding.logoUrl, alt: '', class: 'logo-img' }) : null;
  const side = h('aside', { class: 'sidebar', id: 'sidebar' },
    h('div', { class: 'side-head' }, logoImg || h('span', { class: 'side-logo' }, icon('store', 24)), h('span', { class: 'side-name' }, isAdmin ? 'إدارة المنصة' : ME.tenant.name), icon('chevron', 16)),
    h('nav', null, nav.map(([href, label]) => h('a', { href, class: href === here ? 'active' : '' }, icon(NAV_ICON[href] || 'grid', 20), h('span', null, label)))));
  if (opts.support) side.append(h('div', { class: 'side-support' }, h('div', { class: 'ss-top' }, icon('support', 34), h('div', null, h('strong', null, 'دعم فني'), h('small', null, 'متاح دائمًا لمساعدتك'))), h('a', { class: 'ss-btn', href: 'support.html' }, 'تواصل معنا', icon('arrowl', 18))));
  const kdsBtn = !isAdmin && KDS.allowed() ? KDS.button() : null;
  const dlvBtn = !isAdmin && DLV.allowed() ? DLV.button() : null;
  const kdsPage = !isAdmin && ME.permissions.includes('kitchen.view') ? KDS.pageLink(false) : null;
  const bell = h('button', { class: 'icon-btn bell', title: 'الإشعارات', onclick: showNotifs }, icon('bell'));
  const themeBtn = h('button', { class: 'icon-btn', title: 'الوضع الليلي' });
  const paintTheme = () => { clear(themeBtn); themeBtn.append(icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon')); };
  themeBtn.addEventListener('click', () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; localStorage.setItem('theme', t); paintTheme(); });
  paintTheme();
  const userMenu = h('div', { class: 'user-menu', hidden: true }, h('div', { class: 'muted', style: 'padding:6px 10px' }, ME.email || ''), h('button', { class: 'um-item', onclick: logout }, icon('logout', 18), h('span', null, 'تسجيل الخروج')));
  const chipName = ME.name;
  const avatar = branding && branding.logoUrl ? h('img', { class: 'avatar', src: branding.logoUrl, alt: '' }) : h('span', { class: 'avatar' }, (chipName || '?').trim().charAt(0).toUpperCase());
  const userBtn = h('button', { class: 'user-chip', onclick: e => { e.stopPropagation(); userMenu.hidden = !userMenu.hidden; } }, avatar, h('span', { class: 'uname' }, chipName), icon('chevron', 16));
  document.addEventListener('click', () => { userMenu.hidden = true; });
  const tagline = opts.tagline || 'إدارة أذكى .. لمطعم أكثر نجاحاً';
  // The menu button shows/hides the sidebar (remembered; the POS starts with it hidden to give the product cards more room).
  const sbKey = 'sbHide:' + (here === 'pos.html' ? 'pos' : 'all');
  const sbHidden = () => { try { const v = localStorage.getItem(sbKey); return v === null ? here === 'pos.html' : v === '1'; } catch { return here === 'pos.html'; } };
  function toggleSide() {
    if (window.innerWidth <= 900) return side.classList.toggle('open');
    const app = document.querySelector('.app'), hide = !app.classList.contains('sb-hidden');
    app.classList.toggle('sb-hidden', hide); try { localStorage.setItem(sbKey, hide ? '1' : '0'); } catch {}
  }
  const standalone = !!opts.standalone;
  const fsBtn = h('button', { class: 'icon-btn', title: 'ملء الشاشة', onclick: () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen && document.documentElement.requestFullscreen() }, icon('expand', 22));
  const bar = standalone ? h('header', { class: 'topbar' },
    h('div', { class: 'brand-top' }, h('span', { class: 'brand-ico' }, icon('chef', 38)), h('div', null, h('strong', { style: 'direction:rtl' }, 'شاشة المطبخ'), h('small', null, ME.tenant.name))),
    h('div', { class: 'tagline' }), fsBtn, themeBtn, h('div', { class: 'user-wrap' }, userBtn, userMenu)) : h('header', { class: 'topbar' },
    h('button', { class: 'icon-btn menu-btn', onclick: toggleSide, title: 'القائمة' }, icon('menu', 24)),
    h('div', { class: 'brand-top' }, h('span', { class: 'brand-ico' }, icon('chef', 38)), h('div', null, h('strong', null, 'Restora'), h('small', null, 'Multi-Restaurant Platform'))),
    h('div', { class: 'tagline' }, h('span', { class: 'tg-deco' + (opts.deco ? ' ' + opts.deco : '') }), h('span', { class: 'tg-text' }, tagline)),
    h('div', { id: 'bar-slot', class: 'bar-slot' }),
    themeBtn, kdsPage, dlvBtn, kdsBtn, isAdmin ? null : bell, h('div', { class: 'user-wrap' }, userBtn, userMenu));
  const view = h('main', { id: 'view' });
  const st = ME.tenant && ME.tenant.status;
  const banner = st === 'EXPIRED' ? h('div', { class: 'banner' }, 'اشتراكك منتهي. ', h('a', { href: 'subscriptions.html' }, 'جدّد الآن')) : st === 'SUSPENDED' ? h('div', { class: 'banner' }, 'الحساب موقوف. تواصل مع الدعم.') : null;
  document.title = standalone ? title + ' | ' + ME.tenant.name : title + ' | Restora';
  const foot = opts.foot ? h('footer', { class: 'app-foot' },
    h('div', { class: 'foot-pill' }, h('span', null, opts.foot.text), icon(opts.foot.icon || 'heart', 20)),
    opts.foot.side ? h('div', { class: 'foot-side' }, opts.foot.side) : null,
    opts.foot.brand ? h('div', { class: 'foot-brand' }, icon('chef', 46), h('div', null, h('strong', null, 'Restora'), h('small', null, 'Smart Restaurant Platform'))) : null) : null;
  clear(document.body);
  document.body.append(h('div', { class: 'app' + (standalone ? ' standalone' : '') }, bar, banner, h('div', { class: 'shell' }, standalone ? null : side, h('div', { class: 'main-col' }, view, foot))), h('div', { id: 'print-area' }));
  if (here === 'reservations.html' && !isAdmin && !resOn) { view.append(h('div', { class: 'card empty' }, 'خدمة الحجوزات غير مفعّلة لحسابك. تواصل مع الدعم لتفعيلها.')); return null; }
  if (perm && !ME.permissions.includes(perm)) {
    // a role without dashboard access lands on the first page it is allowed to use
    const first = nav.find(n => n[0] !== here) || (ME.permissions.includes('kitchen.view') && here !== 'kitchen.html' ? ['kitchen.html'] : null);
    if (here === 'dashboard.html' && first) { location.replace(first[0]); return null; }
    view.append(h('div', { class: 'card empty' }, 'لا تملك صلاحية الوصول لهذه الصفحة')); return null; }
  if (sbHidden()) document.querySelector('.app').classList.add('sb-hidden');
  if (!isAdmin && !standalone && KDS.allowed()) KDS.start();
  if (!isAdmin && !standalone && DLV.allowed()) DLV.start();
  if (!isAdmin && !standalone) { refreshBell(bell); setInterval(() => refreshBell(bell), 60000); }
  return view;
}
async function refreshBell(bell) {
  try { const r = await API.get('/notifications'); bell.dataset.unread = r.unread; clear(bell); bell.append(icon('bell'), r.unread ? h('span', { class: 'n' }, r.unread) : null); } catch {}
}
async function showNotifs() {
  try {
    const r = await API.get('/notifications');
    const m = modal('الإشعارات', h('div', null, r.items.length ? r.items.map(n => h('div', { class: 'cart-line' }, h('div', null, h('strong', null, n.title), n.body ? h('div', { class: 'muted' }, n.body) : null), h('small', { class: 'muted' }, dt(n.createdAt)))) : h('div', { class: 'empty' }, 'لا إشعارات'),
      h('button', { class: 'btn secondary', onclick: async () => { await API.post('/notifications/read-all'); m.close(); document.querySelectorAll('.bell').forEach(refreshBell); } }, 'تعليم الكل كمقروء')));
  } catch (e) { fail(e); }
}
// Live updates: rooms are assigned server-side from the verified token.
function connectSocket(handlers) {
  if (!window.io) return null;
  const s = io(window.APP_CONFIG.SOCKET_URL, { auth: { token: API.token() } });
  for (const [ev, fn] of Object.entries(handlers)) s.on(ev, fn);
  return s;
}

// ---- Live kitchen orders: top-bar button (with a count) + a list that can be pinned beside the POS cart ----
// Orders placed in the POS reach the kitchen at once (they are CONFIRMED on creation); every status change made here is the same API call the
// kitchen screen uses, and both screens refresh through the tenant socket room (polling as a fallback).
// Opens the kitchen screen as its own page (separate tab/window); a second click focuses the same one instead of opening another.
function openKitchen(e) {
  if (e) e.preventDefault();
  const w = window.open('kitchen.html', 'restora-kitchen'); if (w) w.focus();
}
const KDS = (() => {
  const subs = new Set(); let orders = [], loaded = false, started = false, sock = null, seen = new Set(), pend = null;
  const can = p => ME.permissions.includes(p);
  const META = { NEW: ['info', 'جديد'], CONFIRMED: ['info', 'مؤكد'], PREPARING: ['warn', 'قيد التحضير'], READY: ['ok', 'جاهز'] };
  const paidSum = o => (o.payments || []).reduce((s, p) => s + (p.isRefund ? -1 : 1) * Number(p.amount), 0);
  const allowed = () => can('kitchen.view') || can('orders.view');
  const pinned = () => { try { return localStorage.getItem('kdsPin') === '1'; } catch { return false; } };
  function setPinned(on) { try { localStorage.setItem('kdsPin', on ? '1' : '0'); } catch {} window.dispatchEvent(new Event('kdspin')); }
  // READY -> delivery goes out; other types can only be handed over once paid.
  function nextOf(o) {
    if (!can('orders.update')) return null;
    if (o.status === 'READY') return o.type === 'DELIVERY' ? ['OUT_FOR_DELIVERY', 'خرج للتوصيل', 'scooter'] : o.payStatus === 'PAID' ? ['COMPLETED', 'تم التقديم', 'cloche'] : null;
    return { NEW: ['CONFIRMED', 'قبول', 'check'], CONFIRMED: ['PREPARING', 'بدء التحضير', 'flame'], PREPARING: ['READY', 'جاهز', 'checkc'] }[o.status] || null;
  }
  async function refresh() {
    try {
      const list = await API.get('/orders/kitchen');
      const fresh = loaded ? list.filter(o => !seen.has(o.id)) : [];
      list.forEach(o => seen.add(o.id)); orders = list; loaded = true;
      if (fresh.length && !/kitchen\.html$/.test(location.pathname)) toast(fresh.length === 1 ? `طلب جديد #${fresh[0].number} وصل المطبخ` : `${fresh.length} طلبات جديدة وصلت المطبخ`);
    } catch {}
    subs.forEach(f => f(orders));
  }
  const soon = () => { clearTimeout(pend); pend = setTimeout(refresh, 250); };
  function start() {
    if (started) return; started = true; refresh();
    sock = connectSocket({ 'order:new': soon, 'order:status': soon });
    setInterval(refresh, sock ? 60000 : 15000);
    setInterval(() => subs.forEach(f => f(orders)), 30000); // keep the "since" labels fresh
  }
  async function move(o, status) {
    if (status === 'OUT_FOR_DELIVERY') { await dispatchOrder(o); refresh(); return; } // choose the delivery worker first
    try { await API.patch(`/orders/${o.id}/status`, { status }); } catch (e) { fail(e.code === 'UNPAID' ? new Error('حصّل المبلغ أولًا قبل التسليم') : e); }
    refresh();
  }
  async function collect(o) {
    const remaining = Number(o.total) - paidSum(o); if (remaining <= 0.005 || typeof collectPayment !== 'function') return;
    const lines = await collectPayment(remaining); if (!lines) return;
    try { await API.post(`/orders/${o.id}/pay`, { payments: lines }); toast('تم التحصيل'); } catch (e) { fail(e); }
    refresh();
  }
  const ago = d => { const m = Math.max(0, Math.floor((Date.now() - new Date(d)) / 60000)); return m < 1 ? 'الآن' : m < 60 ? `منذ ${m} دقيقة` : `منذ ${Math.floor(m / 60)} س ${m % 60} د`; };
  function item(o) {
    const [tone, label] = META[o.status] || ['neutral', AR.status[o.status]];
    const nx = nextOf(o), late = Date.now() - new Date(o.createdAt) > 15 * 60000 && o.status !== 'READY';
    const unpaid = o.payStatus !== 'PAID' && can('orders.update') && typeof collectPayment === 'function';
    const lines = o.items.map(i => `${i.quantity}× ${i.name}`).join('، ');
    return h('div', { class: 'kl s-' + o.status },
      h('div', { class: 'kl-top' }, h('b', { class: 'kl-n' }, '#' + o.number), chip(label, tone), h('span', { class: 'kl-t' + (late ? ' late' : '') }, icon('timer', 15), ago(o.createdAt))),
      h('div', { class: 'kl-sub' }, AR.type[o.type] + (o.table ? ' - طاولة ' + o.table.number : '') + (o.payStatus === 'PAID' ? ' • مدفوع' : ' • غير مدفوع')),
      h('div', { class: 'kl-lines' }, lines),
      h('div', { class: 'kl-act' },
        nx ? h('button', { class: 'btn sm', onclick: () => move(o, nx[0]) }, icon(nx[2], 16), nx[1]) : null,
        unpaid ? h('button', { class: 'btn sm secondary', onclick: () => collect(o) }, icon('card', 16), 'تحصيل') : null,
        can('orders.cancel') && o.status !== 'READY' ? h('button', { class: 'btn sm danger', onclick: async () => { if (await confirmBox('إلغاء الطلب #' + o.number + '؟')) move(o, 'CANCELLED'); } }, icon('x', 16)) : null));
  }
  // A live list. opts.pinnedView: shown beside the POS cart (unpin button); otherwise the dropdown (pin button + link to the kitchen screen).
  function view(opts = {}) {
    const count = h('span', { class: 'kv-c' }), body = h('div', { class: 'kv-b' });
    const pinBtn = h('button', { class: 'icon-btn kv-pin' + (opts.pinnedView ? ' on' : ''), title: opts.pinnedView ? 'إلغاء التثبيت' : 'تثبيت بجانب السلة في الكاشير', onclick: () => setPinned(!pinned()) }, icon('pin', 18));
    const head = h('div', { class: 'kv-h' }, icon('chef', 22), h('b', null, 'طلبات المطبخ الحالية'), count, h('span', { style: 'flex:1' }), pinBtn);
    const foot = !opts.pinnedView && can('kitchen.view') ? h('a', { class: 'kv-f', href: 'kitchen.html', onclick: openKitchen }, 'فتح شاشة المطبخ', icon('arrowl', 16)) : null;
    const el = h('div', { class: 'kv' + (opts.pinnedView ? ' kv-side' : '') }, head, body, foot);
    const paint = list => { count.textContent = list.length; clear(body); body.append(list.length ? list.map(item) : h('div', { class: 'empty' }, 'لا توجد طلبات في المطبخ حاليًا')); };
    const off = subscribe(paint);
    return { el, destroy: off };
  }
  function subscribe(fn) { subs.add(fn); if (loaded) fn(orders); return () => subs.delete(fn); }
  // Top-bar button with a count badge; opens the dropdown list.
  function button() {
    const badge = h('span', { class: 'n kds-n' }), btn = h('button', { class: 'icon-btn kds-btn', title: 'طلبات المطبخ' }, icon('chef', 22), badge);
    const wrap = h('div', { class: 'kds-wrap' }, btn); let open = null;
    const close = () => { if (open) { open.destroy(); open.el.remove(); open = null; } };
    btn.addEventListener('click', e => {
      e.stopPropagation(); if (open) return close();
      if (pinned() && document.querySelector('.pos.with-kds')) return; // already shown beside the cart - don't open a second copy
      const lv = view(); const pop = h('div', { class: 'kds-pop', onclick: ev => ev.stopPropagation() }, lv.el);
      wrap.append(pop); open = { destroy: lv.destroy, el: pop };
    });
    document.addEventListener('click', close);
    window.addEventListener('kdspin', close); // pinning/unpinning closes the dropdown so only one list is left
    subscribe(list => { badge.textContent = list.length; badge.style.display = list.length ? '' : 'none'; btn.classList.toggle('has', list.length > 0); });
    badge.style.display = 'none';
    return wrap;
  }
  // Separate top-bar icon that opens the kitchen screen itself (kitchen.html) as a normal page.
  function pageLink(active) {
    return h('a', { class: 'icon-btn kds-page' + (active ? ' active' : ''), href: 'kitchen.html', target: 'restora-kitchen', title: 'شاشة المطبخ (صفحة منفصلة)', onclick: openKitchen }, icon('cloche', 22));
  }
  return { allowed, start, view, button, pageLink, pinned, setPinned, refresh, subscribe };
})();

// Cashier (POS) orders wait in NEW until they are paid or explicitly sent; this releases one to the kitchen (CONFIRMED).
async function sendToKitchen(order) {
  if (!order || order.status !== 'NEW' || order.source !== 'POS') return;
  try { await API.patch(`/orders/${order.id}/status`, { status: 'CONFIRMED' }); } catch {}
}

// ---------------- Delivery: workers + orders that are out ----------------
// A delivery order leaves with a worker (chosen here); a worker may carry several orders at once. "Busy" = has at least one order out;
// busy workers sink below the free ones in the list. When the order arrives it is marked delivered (payment is collected first if still due).
const DLV = (() => {
  const subs = new Set(); let data = { drivers: [], ready: [] }, loaded = false, started = false, offset = 0, pend = null;
  const can = p => ME.permissions.includes(p);
  const allowed = () => can('orders.view') && ((ME.tenant && ME.tenant.modules) || {}).delivery !== false;
  const pad = n => String(n).padStart(2, '0');
  const hms = ms => { const t = Math.max(0, Math.floor(ms / 1000)); return `${pad(Math.floor(t / 3600))}:${pad(Math.floor(t % 3600 / 60))}:${pad(t % 60)}`; };
  async function refresh() {
    try { const r = await API.get('/drivers/board'); offset = new Date(r.now) - Date.now(); data = r; loaded = true; } catch {}
    subs.forEach(f => f(data));
  }
  const soon = () => { clearTimeout(pend); pend = setTimeout(refresh, 250); };
  function start() { if (started) return; started = true; refresh(); connectSocket({ 'order:new': soon, 'order:status': soon }); setInterval(refresh, 30000); }
  const subscribe = fn => { subs.add(fn); if (loaded) fn(data); return () => subs.delete(fn); };
  // free workers first (by name); busy ones below, fewer orders first, then the one that left earliest
  const sorted = list => [...list].sort((a, b) => (a.orders.length > 0) - (b.orders.length > 0) || (a.orders.length && b.orders.length ? a.orders.length - b.orders.length || new Date(a.orders[0].dispatchedAt) - new Date(b.orders[0].dispatchedAt) : 0) || (a.unassigned ? 1 : 0) - (b.unassigned ? 1 : 0) || a.name.localeCompare(b.name, 'ar'));
  async function arrive(o) {
    if (o.remaining > 0.005 && can('orders.update') && typeof collectPayment === 'function') {
      const lines = await collectPayment(o.remaining); if (!lines) return;
      try { await API.post(`/orders/${o.id}/pay`, { payments: lines }); } catch (e) { return fail(e); }
    }
    try { await API.patch(`/orders/${o.id}/status`, { status: 'COMPLETED' }); toast(`وصل الطلب #${o.number} — استغرق ${Math.max(1, Math.round((Date.now() + offset - new Date(o.dispatchedAt)) / 60000))} دقيقة`); } catch (e) { fail(e.code === 'UNPAID' ? new Error('حصّل المبلغ أولًا') : e); }
    refresh(); if (typeof KDS !== 'undefined') KDS.refresh();
  }
  // Delivery workers are picked from the employees (with or without an account) — nothing is typed in by hand.
  const driverForm = d => { if (d) return formModal({ title: 'تعديل عامل', values: d, fields: [{ name: 'name', label: 'الاسم', required: true }, { name: 'phone', label: 'الهاتف' }],
    onSubmit: async f => { await API.patch('/drivers/' + d.id, { name: f.name, phone: f.phone || null }); refresh(); } }); return pickEmployee(); };
  async function pickEmployee() {
    let cands; try { cands = await API.get('/drivers/candidates'); } catch (e) { return fail(e); }
    // people whose job title says delivery come first
    const isDel = c => /توصيل|دليفري|ديليفري|delivery/i.test(c.sub || ''); cands.sort((x, y) => isDel(y) - isDel(x));
    const list = h('div', { class: 'dl-pick' }), inp = h('input', { class: 'input', placeholder: 'ابحث باسم الموظف...', style: 'margin-bottom:10px' });
    const m = modal('اختر الموظف ليكون عامل توصيل', h('div', null, cands.length > 6 ? inp : null, list));
    const add = async c => { try { await API.post('/drivers', c.kind === 'staff' ? { staffId: c.id } : { userId: c.id }); m.close(); toast('تمت إضافة ' + c.name + ' لعمال التوصيل'); refresh(); } catch (e) { fail(e); } };
    const paint = () => { const t = inp.value.trim().toLowerCase(); clear(list); const rows = cands.filter(c => !t || c.name.toLowerCase().includes(t) || (c.sub || '').toLowerCase().includes(t));
      list.append(...(rows.length ? rows.map(c => h('button', { class: 'dl-pick-r', onclick: () => add(c) }, h('span', { class: 'dl-av' }, c.name.trim().charAt(0)), h('strong', null, c.name), h('small', { class: 'muted' }, c.sub || ''), h('span', { style: 'flex:1' }), icon('plus', 16)))
        : [h('p', { class: 'muted' }, cands.length ? 'لا نتائج مطابقة' : 'كل الموظفين مضافون بالفعل، أو لا يوجد موظفون — أضف موظفًا من صفحة «الموظفون والصلاحيات» أولًا.')])); };
    inp.addEventListener('input', paint); paint();
  }
  function view() {
    const count = h('span', { class: 'kv-c' }), body = h('div', { class: 'kv-b dl-b' });
    const head = h('div', { class: 'kv-h' }, icon('scooter', 22), h('b', null, 'التوصيل'), count, h('span', { style: 'flex:1' }),
      can('orders.update') ? h('button', { class: 'btn sm', onclick: () => driverForm() }, icon('plus', 16), 'عامل') : null);
    const el = h('div', { class: 'kv dl' }, head, body);
    const orderRow = o => h('div', { class: 'dl-o' },
      h('div', { class: 'dl-o-t' }, h('b', null, '#' + o.number), h('span', { class: 'dl-o-n' }, o.customerName || '-'), h('span', { class: 'dl-timer ltr', 'data-t': o.dispatchedAt }, hms(Date.now() + offset - new Date(o.dispatchedAt)))),
      h('div', { class: 'dl-o-a' }, icon('pin', 14), [o.deliveryAddress, o.zoneName].filter(Boolean).join(' — ') || '-'),
      h('div', { class: 'dl-o-f' }, o.remaining > 0.005 ? h('span', { class: 'dl-due' }, 'يحصّل ', h('b', { class: 'ltr' }, money(o.remaining))) : chip('مدفوع', 'ok'),
        can('orders.update') ? h('button', { class: 'btn sm ok', onclick: () => arrive(o) }, icon('checkc', 16), 'وصل') : null));
    const readyRow = o => h('div', { class: 'dl-o' },
      h('div', { class: 'dl-o-t' }, h('b', null, '#' + o.number), h('span', { class: 'dl-o-n' }, o.customerName || '-'), h('b', { class: 'ltr' }, money(o.total))),
      h('div', { class: 'dl-o-a' }, icon('pin', 14), [o.deliveryAddress, o.zoneName].filter(Boolean).join(' — ') || '-'),
      can('orders.update') ? h('div', { class: 'dl-o-f' }, h('button', { class: 'btn sm', onclick: () => dispatchOrder(o).then(refresh) }, icon('scooter', 16), 'خرج للتوصيل')) : null);
    const driverCard = d => {
      const busy = d.orders.length > 0;
      return h('div', { class: 'dl-d' + (busy ? ' busy' : '') },
        h('div', { class: 'dl-d-h' }, h('span', { class: 'dl-av' }, d.name.trim().charAt(0)), h('div', { class: 'dl-d-n' }, h('strong', null, d.name), d.phone ? h('small', { class: 'ltr' }, d.phone) : null),
          d.unassigned ? chip('بدون عامل', 'warn') : busy ? chip(`مشغول (${d.orders.length})`, 'warn', 'dot') : chip('متاح', 'ok', 'dot'),
          !d.unassigned && !busy && can('orders.update') ? h('div', { class: 'act-row' }, d.linked ? null : h('button', { class: 'ibtn orange sm', title: 'تعديل', onclick: () => driverForm(d) }, icon('edit', 14)),
            h('button', { class: 'ibtn red sm', title: 'إزالة من التوصيل', onclick: async () => { if (await confirmBox('إزالة ' + d.name + ' من عمال التوصيل؟ (لن يُحذف من الموظفين)')) { try { await API.del('/drivers/' + d.id); refresh(); } catch (e) { fail(e); } } } }, icon('trash', 14))) : null),
        busy ? h('div', { class: 'dl-d-o' }, d.orders.map(orderRow)) : null);
    };
    const paint = r => {
      count.textContent = r.ready.length + r.drivers.reduce((t, d) => t + d.orders.length, 0); clear(body);
      body.append(h('div', { class: 'dl-sec' }, 'جاهز للخروج (' + r.ready.length + ')'), r.ready.length ? r.ready.map(readyRow) : h('div', { class: 'empty sm' }, 'لا توجد طلبات توصيل جاهزة'),
        h('div', { class: 'dl-sec' }, 'عمال التوصيل'), r.drivers.length ? sorted(r.drivers).map(driverCard) : h('div', { class: 'empty sm' }, 'لم تُضف عمال توصيل بعد — اضغط «+ عامل» واختر من الموظفين'));
    };
    const off = subscribe(paint), tk = setInterval(() => el.querySelectorAll('.dl-timer[data-t]').forEach(t => { t.textContent = hms(Date.now() + offset - new Date(t.dataset.t)); }), 1000);
    return { el, destroy: () => { off(); clearInterval(tk); } };
  }
  function button() {
    const badge = h('span', { class: 'n kds-n' }), btn = h('button', { class: 'icon-btn kds-btn dlv-btn', title: 'التوصيل وعمال الدليفيري' }, icon('scooter', 22), badge);
    const wrap = h('div', { class: 'kds-wrap' }, btn); let open = null;
    const close = () => { if (open) { open.destroy(); open.el.remove(); open = null; } };
    btn.addEventListener('click', e => {
      e.stopPropagation(); if (open) return close();
      document.body.click(); // close any other dropdown
      const v = view(), pop = h('div', { class: 'kds-pop dlv-pop', onclick: ev => ev.stopPropagation() }, v.el); wrap.append(pop); open = { destroy: v.destroy, el: pop };
    });
    document.addEventListener('click', close);
    subscribe(r => { const n = r.ready.length + r.drivers.reduce((t, d) => t + d.orders.length, 0); badge.textContent = n; badge.style.display = n ? '' : 'none'; btn.classList.toggle('has', n > 0); });
    badge.style.display = 'none';
    return wrap;
  }
  return { allowed, start, button, refresh, subscribe, sorted };
})();

// Choose the delivery worker for an order that is leaving, then mark it OUT_FOR_DELIVERY. Resolves true when it went out.
async function dispatchOrder(o) {
  let board; try { board = await API.get('/drivers/board'); } catch (e) { fail(e); return false; }
  const list = DLV.sorted(board.drivers.filter(d => !d.unassigned));
  return new Promise(res => {
    let done = false; const finish = v => { if (!done) { done = true; res(v); } };
    const go = async d => {
      try { await API.patch(`/orders/${o.id}/status`, { status: 'OUT_FOR_DELIVERY', ...(d ? { driverId: d.id } : {}) }); m.close(); toast(`الطلب #${o.number} خرج للتوصيل${d ? ' مع ' + d.name : ''}`); finish(true); if (typeof KDS !== 'undefined') KDS.refresh(); DLV.refresh(); } catch (e) { fail(e); }
    };
    const body = h('div', { class: 'dl-pick' }, list.length ? list.map(d => h('button', { class: 'dl-pick-r' + (d.orders.length ? ' busy' : ''), onclick: () => go(d) },
      h('span', { class: 'dl-av' }, d.name.trim().charAt(0)), h('strong', null, d.name), h('span', { style: 'flex:1' }), d.orders.length ? chip(`مشغول (${d.orders.length})`, 'warn', 'dot') : chip('متاح', 'ok', 'dot')))
      : [h('p', { class: 'muted' }, 'لا يوجد عمال توصيل. أضف عاملًا من قائمة التوصيل في الأعلى (يُختار من الموظفين)، أو أخرج الطلب بدون تحديد عامل.'), h('button', { class: 'btn secondary', onclick: () => go(null) }, 'خروج بدون عامل')]);
    const m = modal(`مع أي عامل يخرج الطلب #${o.number}؟`, body);
    m.el.addEventListener('click', e => { if (e.target === m.el) finish(false); });
  });
}
