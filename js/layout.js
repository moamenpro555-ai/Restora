// App shell: sidebar (filtered by permissions), topbar, theme, notifications, branding, live socket.
const NAV = [
  ['dashboard.html', 'لوحة التحكم', 'orders.view'], ['pos.html', 'الكاشير', 'orders.create'], ['orders.html', 'الطلبات', 'orders.view'],
  ['kitchen.html', 'المطبخ (KDS)', 'kitchen.view'], ['tables.html', 'الطاولات', 'tables.manage'], ['reservations.html', 'الحجوزات', 'reservations.manage'],
  ['products.html', 'المنتجات والتصنيفات', 'products.view'], ['inventory.html', 'المخزون والوصفات', 'inventory.manage'],
  ['customers.html', 'العملاء', 'customers.manage'], ['employees.html', 'الموظفون والصلاحيات', 'employees.manage'], ['branches.html', 'الفروع', 'branches.manage'],
  ['finance.html', 'المالية', 'finance.view'], ['reports.html', 'التقارير', 'reports.view'], ['settings.html', 'الإعدادات والهوية', 'settings.manage'],
  ['subscriptions.html', 'الاشتراك', 'subscription.manage'], ['attendance.html', 'الحضور والانصراف', null], ['support.html', 'الدعم الفني', null]
];
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

  const nav = (isAdmin ? ADMIN_NAV : NAV).filter(n => !n[2] || ME.permissions.includes(n[2]));
  const here = location.pathname.split('/').pop();
  const side = h('aside', { class: 'sidebar' },
    h('div', { class: 'brand' }, branding && branding.logoUrl ? h('img', { src: branding.logoUrl, alt: '' }) : null, h('span', null, isAdmin ? 'إدارة المنصة' : ME.tenant.name)),
    nav.map(([href, label]) => h('a', { href, class: href === here ? 'active' : '' }, label)));
  const bell = h('button', { class: 'btn secondary bell', onclick: showNotifs }, '🔔');
  const bar = h('header', { class: 'topbar' },
    h('button', { class: 'btn secondary menu-btn', onclick: () => side.classList.toggle('open') }, '☰'), h('h1', null, title),
    isAdmin ? null : bell,
    h('button', { class: 'btn secondary', title: 'الوضع الليلي', onclick: () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; localStorage.setItem('theme', t); } }, '◐'),
    h('span', { class: 'muted' }, ME.name), h('button', { class: 'btn secondary', onclick: logout }, 'خروج'));
  const view = h('main', { id: 'view' });
  const st = ME.tenant && ME.tenant.status;
  const banner = st === 'EXPIRED' ? h('div', { class: 'banner' }, 'اشتراكك منتهي. ', h('a', { href: 'subscriptions.html' }, 'جدّد الآن')) : st === 'SUSPENDED' ? h('div', { class: 'banner' }, 'الحساب موقوف. تواصل مع الدعم.') : null;
  clear(document.body);
  document.body.append(h('div', { class: 'app' }, side, h('div', { class: 'main' }, bar, banner, view)), h('div', { id: 'print-area' }));
  if (perm && !ME.permissions.includes(perm)) {
    // a role without dashboard access lands on the first page it is allowed to use
    const first = nav.find(n => n[0] !== here);
    if (here === 'dashboard.html' && first) { location.replace(first[0]); return null; }
    view.append(h('div', { class: 'card empty' }, 'لا تملك صلاحية الوصول لهذه الصفحة')); return null; }
  if (!isAdmin) { refreshBell(bell); setInterval(() => refreshBell(bell), 60000); }
  return view;
}
async function refreshBell(bell) {
  try { const r = await API.get('/notifications'); bell.dataset.unread = r.unread; clear(bell); bell.append('🔔', r.unread ? h('span', { class: 'n' }, r.unread) : null); } catch {}
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
