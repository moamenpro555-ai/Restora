// App shell: sidebar (filtered by permissions), topbar, theme, notifications, branding, live socket.
const NAV = [
  ['dashboard.html', 'لوحة التحكم', 'orders.view'], ['pos.html', 'الكاشير', 'orders.create'], ['orders.html', 'الطلبات', 'orders.view'],
  ['kitchen.html', 'المطبخ (KDS)', 'kitchen.view'], ['tables.html', 'الطاولات', 'tables.manage'], ['reservations.html', 'الحجوزات', 'reservations.manage'],
  ['products.html', 'المنتجات والتصنيفات', 'products.view'], ['inventory.html', 'المخزون والوصفات', 'inventory.manage'],
  ['customers.html', 'العملاء', 'customers.manage'], ['employees.html', 'الموظفون والصلاحيات', 'employees.manage'], ['branches.html', 'الفروع', 'branches.manage'],
  ['finance.html', 'المالية', 'finance.view'], ['reports.html', 'التقارير', 'reports.view'], ['settings.html', 'الإعدادات والواجهة', 'settings.manage'],
  ['subscriptions.html', 'الاشتراكات', 'subscription.manage'], ['attendance.html', 'الحضور والانصراف', null], ['support.html', 'الدعم الفني', null]
];
const NAV_ICON = { 'dashboard.html': 'home', 'pos.html': 'pos', 'orders.html': 'list', 'kitchen.html': 'chef', 'tables.html': 'table', 'reservations.html': 'calendar', 'products.html': 'tag',
  'inventory.html': 'box', 'customers.html': 'users', 'employees.html': 'shield', 'branches.html': 'store', 'finance.html': 'trend', 'reports.html': 'bars', 'settings.html': 'gear',
  'subscriptions.html': 'crown', 'attendance.html': 'clock', 'support.html': 'support', 'admin.html': 'crown' };
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
  const logoImg = branding && branding.logoUrl ? h('img', { src: branding.logoUrl, alt: '', class: 'logo-img' }) : null;
  const side = h('aside', { class: 'sidebar', id: 'sidebar' },
    h('div', { class: 'side-head' }, logoImg || h('span', { class: 'side-logo' }, icon('store', 24)), h('span', { class: 'side-name' }, isAdmin ? 'إدارة المنصة' : ME.tenant.name), icon('chevron', 16)),
    h('nav', null, nav.map(([href, label]) => h('a', { href, class: href === here ? 'active' : '' }, icon(NAV_ICON[href] || 'grid', 20), h('span', null, label)))));
  if (opts.support) side.append(h('div', { class: 'side-support' }, h('div', { class: 'ss-top' }, icon('support', 34), h('div', null, h('strong', null, 'دعم فني'), h('small', null, 'متاح دائمًا لمساعدتك'))), h('a', { class: 'ss-btn', href: 'support.html' }, 'تواصل معنا', icon('arrowl', 18))));
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
  const bar = h('header', { class: 'topbar' },
    h('button', { class: 'icon-btn menu-btn', onclick: () => side.classList.toggle('open'), title: 'القائمة' }, icon('menu', 24)),
    h('div', { class: 'brand-top' }, h('span', { class: 'brand-ico' }, icon('chef', 38)), h('div', null, h('strong', null, 'Restora'), h('small', null, 'Multi-Restaurant Platform'))),
    h('div', { class: 'tagline' }, h('span', { class: 'tg-deco' + (opts.deco ? ' ' + opts.deco : '') }), h('span', { class: 'tg-text' }, tagline)),
    h('div', { id: 'bar-slot', class: 'bar-slot' }),
    themeBtn, isAdmin ? null : bell, h('div', { class: 'user-wrap' }, userBtn, userMenu));
  const view = h('main', { id: 'view' });
  const st = ME.tenant && ME.tenant.status;
  const banner = st === 'EXPIRED' ? h('div', { class: 'banner' }, 'اشتراكك منتهي. ', h('a', { href: 'subscriptions.html' }, 'جدّد الآن')) : st === 'SUSPENDED' ? h('div', { class: 'banner' }, 'الحساب موقوف. تواصل مع الدعم.') : null;
  document.title = title + ' | Restora';
  const foot = opts.foot ? h('footer', { class: 'app-foot' },
    h('div', { class: 'foot-pill' }, h('span', null, opts.foot.text), icon(opts.foot.icon || 'heart', 20)),
    opts.foot.side ? h('div', { class: 'foot-side' }, opts.foot.side) : null,
    opts.foot.brand ? h('div', { class: 'foot-brand' }, icon('chef', 46), h('div', null, h('strong', null, 'Restora'), h('small', null, 'Smart Restaurant Platform'))) : null) : null;
  clear(document.body);
  document.body.append(h('div', { class: 'app' }, bar, banner, h('div', { class: 'shell' }, side, h('div', { class: 'main-col' }, view, foot))), h('div', { id: 'print-area' }));
  if (perm && !ME.permissions.includes(perm)) {
    // a role without dashboard access lands on the first page it is allowed to use
    const first = nav.find(n => n[0] !== here);
    if (here === 'dashboard.html' && first) { location.replace(first[0]); return null; }
    view.append(h('div', { class: 'card empty' }, 'لا تملك صلاحية الوصول لهذه الصفحة')); return null; }
  if (!isAdmin) { refreshBell(bell); setInterval(() => refreshBell(bell), 60000); }
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
