// Element.append/prepend turn null/false into the text "null"/"false" and arrays into "[object ...]".
// Make them skip empty values and flatten arrays, so `el.append(cond ? node : null, list.map(...))` is always safe.
(() => {
  const flat = a => a.flatMap(x => (Array.isArray(x) ? flat(x) : x == null || x === false ? [] : [x]));
  for (const k of ['append', 'prepend']) { const o = Element.prototype[k]; Element.prototype[k] = function (...a) { return o.apply(this, flat(a)); }; }
})();
// Tiny DOM toolkit. All user data goes through textContent (no innerHTML) => XSS-safe by construction.
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (['value', 'checked', 'disabled', 'selected'].includes(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = k => { if (k == null || k === false) return; if (Array.isArray(k)) return k.forEach(add); el.append(k.nodeType ? k : document.createTextNode(String(k))); };
  kids.forEach(add);
  return el;
}
const $ = (s, r = document) => r.querySelector(s);
const clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
const money = n => ('' + Number(n || 0).toLocaleString('ar-EG-u-nu-latn', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + ((window.ME && ME.tenant && ME.tenant.currency) || 'EGP') + '\u2069').replace(/^/, '\u2066');
const dt = d => d ? new Date(d).toLocaleString('ar-EG-u-nu-latn', { dateStyle: 'short', timeStyle: 'short' }) : '-';
const AR = {
  status: { NEW: 'جديد', CONFIRMED: 'مؤكد', PREPARING: 'قيد التحضير', READY: 'جاهز', OUT_FOR_DELIVERY: 'في الطريق', COMPLETED: 'مكتمل', CANCELLED: 'ملغي' },
  type: { DINE_IN: 'داخل المطعم', TAKEAWAY: 'استلام', DELIVERY: 'توصيل' },
  source: { POS: 'كاشير', QR: 'QR', ONLINE: 'أونلاين', MANUAL: 'يدوي' },
  pay: { UNPAID: 'غير مدفوع', PARTIAL: 'مدفوع جزئيًا', PAID: 'مدفوع', REFUNDED: 'مسترد' },
  method: { CASH: 'نقدي', CARD: 'بطاقة', OTHER: 'أخرى' }
};
const statusBadge = s => h('span', { class: 'badge ' + ({ COMPLETED: 'ok', CANCELLED: 'err', NEW: 'info', READY: 'ok', PAID: 'ok', UNPAID: 'warn', PARTIAL: 'warn', REFUNDED: 'err' }[s] || 'warn') }, AR.status[s] || AR.pay[s] || s);

function toast(msg, err) {
  const t = h('div', { class: 'toast' + (err ? ' err' : '') }, msg);
  document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
}
const fail = e => toast(e && e.message ? e.message : 'خطأ', true);

function modal(title, body, { wide = false } = {}) {
  const close = () => ov.remove();
  const ov = h('div', { class: 'overlay', onclick: e => { if (e.target === ov) close(); } },
    h('div', { class: 'modal' + (wide ? ' wide' : '') }, h('div', { class: 'row spread' }, h('h2', null, title), h('button', { class: 'btn secondary sm', onclick: close }, '✕')), body));
  document.body.appendChild(ov);
  return { close, el: ov };
}
function confirmBox(msg) {
  return new Promise(res => {
    const m = modal('تأكيد', h('div', null, h('p', null, msg),
      h('div', { class: 'row' }, h('button', { class: 'btn danger', onclick: () => { m.close(); res(true); } }, 'تأكيد'), h('button', { class: 'btn secondary', onclick: () => { m.close(); res(false); } }, 'إلغاء'))));
  });
}
// Shrinks a picked image in the browser (max side px, WebP/JPEG) so uploads stay small (< ~380 KB).
async function compressImage(file, max = 900) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('اختر صورة JPG أو PNG أو WebP');
  const bmp = await createImageBitmap(file).catch(() => { throw new Error('تعذر قراءة الصورة'); });
  let side = max;
  for (let i = 0; i < 5; i++) {
    const k = Math.min(1, side / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/webp', 0.85));
    if (blob && blob.size <= 380 * 1024) return blob;
    side = Math.round(side * 0.75);
  }
  throw new Error('الصورة كبيرة جدًا، اختر صورة أصغر');
}
// Device-only image picker. Keeps the uploaded URL in a hidden input (name) and exposes it as .value on the wrapper.
function imageUploader(name, value) {
  const isOurs = u => typeof u === 'string' && /\/api\/media\/[a-z0-9]+$/.test(u);
  const hidden = h('input', { type: 'hidden', name, value: isOurs(value) ? value : '' });
  const img = h('img', { alt: '', style: 'max-width:140px;max-height:100px;border-radius:8px;object-fit:cover;display:none' });
  const status = h('small', { class: 'muted' });
  const show = () => { if (hidden.value) { img.src = hidden.value; img.style.display = 'block'; } else img.style.display = 'none'; rm.style.display = hidden.value ? '' : 'none'; };
  const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', onchange: async e => {
    const f = e.target.files[0]; if (!f) return;
    status.textContent = 'جارٍ الرفع...';
    try { hidden.value = await API.upload(await compressImage(f)); status.textContent = 'تم رفع الصورة'; show(); }
    catch (err) { status.textContent = ''; fail(err); }
    file.value = '';
  } });
  const rm = h('button', { type: 'button', class: 'btn secondary sm', onclick: () => { hidden.value = ''; status.textContent = ''; show(); } }, 'إزالة الصورة');
  const wrap = h('div', null, img, file, rm, status, hidden);
  Object.defineProperty(wrap, 'value', { get: () => hidden.value });
  show();
  return wrap;
}
// fields: {name,label,type(image|text|number|password|email|date|datetime-local|textarea|select|checkbox|multicheck),options:[{value,label}],required,step,hint}
function formModal({ title, fields, values = {}, submitText = 'حفظ', onSubmit, wide }) {
  const inputs = {};
  const form = h('form', { class: 'two', onsubmit: async e => {
    e.preventDefault();
    const out = {};
    for (const f of fields) {
      const el = inputs[f.name];
      if (f.type === 'checkbox') out[f.name] = el.checked;
      else if (f.type === 'multicheck') out[f.name] = [...el.querySelectorAll('input:checked')].map(i => i.value);
      else if (f.type === 'number') out[f.name] = el.value === '' ? undefined : Number(el.value);
      else if (f.type === 'datetime-local') out[f.name] = el.value ? new Date(el.value).toISOString() : undefined;
      else out[f.name] = el.value === '' ? undefined : el.value;
    }
    btn.disabled = true;
    try { await onSubmit(out); m.close(); } catch (err) { fail(err); btn.disabled = false; }
  } });
  for (const f of fields) {
    const v = values[f.name];
    let el;
    if (f.type === 'image') el = imageUploader(f.name, v);
    else if (f.type === 'textarea') el = h('textarea', { value: v ?? '' });
    else if (f.type === 'select') el = h('select', null, f.options.map(o => h('option', { value: o.value, selected: String(o.value) === String(v ?? '') }, o.label)));
    else if (f.type === 'checkbox') el = h('input', { type: 'checkbox', checked: !!v });
    else if (f.type === 'multicheck') el = h('div', null, f.options.map(o => h('label', { style: 'display:block' }, h('input', { type: 'checkbox', value: o.value, checked: (v || []).includes(o.value) }), o.label)));
    else el = h('input', { type: f.type || 'text', value: v ?? '', step: f.step, min: f.min });
    if (f.required && el.required !== undefined) el.required = true;
    inputs[f.name] = el;
    const full = ['textarea', 'multicheck'].includes(f.type) || f.full;
    form.appendChild(h('div', { style: full ? 'grid-column:1/-1' : '' }, f.type === 'checkbox' ? h('label', null, el, f.label) : [h('label', null, f.label), el], f.hint ? h('small', { class: 'muted' }, f.hint) : null));
  }
  const btn = h('button', { class: 'btn', style: 'grid-column:1/-1' }, submitText);
  form.appendChild(btn);
  const m = modal(title, form, { wide });
  return m;
}
function dataTable(cols, rows, emptyMsg = 'لا توجد بيانات', cls = '') {
  if (!rows || !rows.length) return h('div', { class: 'card empty' }, emptyMsg);
  return h('div', { class: 'table-wrap' + (cls ? ' ' + cls : '') }, h('table', null,
    h('thead', null, h('tr', null, cols.map(c => h('th', { class: c.cls || '' }, c.label)))),
    h('tbody', null, rows.map(r => h('tr', null, cols.map(c => h('td', { class: c.cls || '' }, c.render ? c.render(r) : (r[c.key] ?? '-'))))))));
}
function tabs(items, onChange, active) {
  const wrap = h('div', { class: 'tabs' });
  const draw = cur => { clear(wrap); items.forEach(([k, label]) => wrap.appendChild(h('button', { class: k === cur ? 'on' : '', onclick: () => { draw(k); onChange(k); } }, label))); };
  draw(active || items[0][0]); return wrap;
}
const loading = () => h('div', { class: 'skeleton' });
function kpi(label, value, sub) { return h('div', { class: 'card kpi' }, h('div', { class: 'l' }, label), h('div', { class: 'v' }, value), sub ? h('small', { class: 'muted' }, sub) : null); }
function rangeBounds(days) { // local-day aligned bounds as ISO strings
  const to = new Date(); const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - (days - 1));
  return { from: from.toISOString(), to: new Date(to.getTime() + 1000).toISOString() };
}
const tzOffset = () => -new Date().getTimezoneOffset();
function download(name, blob) { const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.appendChild(a); a.click(); a.remove(); }

// Line icons (24x24, stroke = currentColor). icon('cart') returns an <svg> element.
const ICONS = {
  home: 'M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6',
  pos: 'M4 7h16l-1 4a3 3 0 01-6 0 3 3 0 01-6 0L4 7zM5 12v8h14v-8M9 20v-4h6v4',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  chef: 'M6 14a4 4 0 01-1-7.7A5 5 0 0112 4a5 5 0 017 2.3A4 4 0 0118 14v6H6v-6zM6 17h12',
  table: 'M4 9h16M6 9v10M18 9v10M3 9l1-4h16l1 4',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  tag: 'M3 12V4h8l10 10-8 8L3 12zM7.5 8.5h.01',
  box: 'M12 3l9 5v8l-9 5-9-5V8l9-5zM3 8l9 5 9-5M12 13v8',
  users: 'M16 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9.5 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 20v-2a4 4 0 00-3-3.9M16 3.1a3.5 3.5 0 010 6.8',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4',
  store: 'M4 9l1-5h14l1 5M4 9a2.5 2.5 0 005 0 2.5 2.5 0 006 0 2.5 2.5 0 005 0M5 12v8h14v-8M10 20v-5h4v5',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  bars: 'M5 20V10M12 20V4M19 20v-7',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  crown: 'M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8z',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  support: 'M4 13v-1a8 8 0 0116 0v1M4 13h3v5H5a1 1 0 01-1-1v-4zM20 13h-3v5h2a1 1 0 001-1v-4zM17 18v1a2 2 0 01-2 2h-2',
  bell: 'M6 9a6 6 0 1112 0c0 6 2 7 2 8H4c0-1 2-2 2-8zM10 21h4',
  moon: 'M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z',
  sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5',
  cart: 'M3 4h2l2.5 11h10l2-8H6.5M9 20h.01M17 20h.01',
  plus: 'M12 5v14M5 12h14',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  cup: 'M6 4h12l-1.5 16h-9L6 4zM6.5 9h11',
  cake: 'M4 20h16v-6a4 4 0 00-4-4H8a4 4 0 00-4 4v6zM12 10V6M12 6c-1-1-1-2 0-3 1 1 1 2 0 3zM4 15c2 2 4-2 8 0s6-2 8 0',
  cloche: 'M3 18h18M5 18a7 7 0 0114 0M12 8V6M10.5 6h3',
  play: 'M7 5l12 7-12 7V5z',
  card: 'M3 6h18v12H3zM3 10h18M7 15h3',
  chevron: 'M6 9l6 6 6-6',
  logout: 'M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4M16 8l4 4-4 4M20 12H9',
  stop: 'M7 7h10v10H7z',
  note: 'M5 4h14v12H9l-4 4V4z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  filter: 'M3 5h18l-7 8v6l-4-2v-4L3 5z',
  check: 'M5 12l5 5 9-10',
  checkc: 'M12 21a9 9 0 100-18 9 9 0 000 18zM8 12l3 3 5-6',
  xc: 'M12 21a9 9 0 100-18 9 9 0 000 18zM9 9l6 6M15 9l-6 6',
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z',
  utensils: 'M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10M17 3c-2 1-3 4-3 7h3v11M17 3v18',
  scooter: 'M5 19a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM19 19a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM7.5 16.5H13l2-8h3M12 8.5h3M8 5h3',
  bag: 'M5 8h14l-1 12H6L5 8zM9 8a3 3 0 016 0',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  doc: 'M7 3h7l4 4v14H7V3zM14 3v4h4M10 12h5M10 16h5',
  chevl: 'M15 6l-6 6 6 6',
  chevr: 'M9 6l6 6-6 6',
  dchevl: 'M11 6l-6 6 6 6M19 6l-6 6 6 6',
  dchevr: 'M13 6l6 6-6 6M5 6l6 6-6 6',
  arrowl: 'M19 12H5M11 6l-6 6 6 6',
  arrowr: 'M5 12h14M13 6l6 6-6 6',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0012 3z',
  timer: 'M12 21a8 8 0 100-16 8 8 0 000 16zM12 9v4l2 2M9 2h6',
  refresh: 'M20 11a8 8 0 10-2 6M20 4v7h-7',
  db: 'M4 6c0-1.5 3.6-3 8-3s8 1.5 8 3-3.6 3-8 3-8-1.5-8-3zM4 6v6c0 1.5 3.6 3 8 3s8-1.5 8-3V6M4 12v6c0 1.5 3.6 3 8 3s8-1.5 8-3v-6',
  dots: 'M12 5h.01M12 12h.01M12 19h.01',
  menu: 'M4 6h16M4 12h16M4 18h16',
  person: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  x: 'M6 6l12 12M18 6L6 18',
  alert: 'M12 3l10 18H2L12 3zM12 10v5M12 18h.01',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'
};
function icon(name, size = 20) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'ico' })) svg.setAttribute(k, v);
  const path = document.createElementNS(NS, 'path'); path.setAttribute('d', ICONS[name] || ICONS.grid); svg.appendChild(path);
  return svg;
}

// ---- Restora shared UI helpers ----
// Page header: orange icon + bold title + muted subtitle on the start side, actions on the end side.
function pageHead(title, sub, ico, actions) {
  return h('div', { class: 'ph' },
    h('div', { class: 'ph-t' }, h('h1', null, h('span', { class: 'ph-ico' }, icon(ico || 'grid', 28)), title), sub ? h('p', { class: 'muted' }, sub) : null),
    actions ? h('div', { class: 'ph-act' }, actions) : null);
}
// Rounded status chip with an optional leading icon or dot. tone: ok|warn|err|info|neutral|dark
function chip(label, tone, ico) {
  return h('span', { class: 'chip ' + (tone || 'neutral') }, ico === 'dot' ? h('i', { class: 'dot' }) : ico ? icon(ico, 15) : null, label);
}
// Filter pill (orders / tables / kitchen). `on` marks the active pill; `ico` is an icon name, 'dot' or null.
function pill(label, { on = false, ico = null, tone = '', onclick } = {}) {
  return h('button', { type: 'button', class: 'fpill' + (on ? ' on' : '') + (tone ? ' t-' + tone : ''), onclick }, ico === 'dot' ? h('i', { class: 'dot' }) : ico ? icon(ico, 17) : null, label);
}
// Row of filter pills that keeps its own active state. items: [[key,label,ico,tone]]
function pillTabs(items, onChange, active) {
  const wrap = h('div', { class: 'fpills' });
  const draw = cur => { clear(wrap); items.forEach(([k, label, ico, tone]) => wrap.append(pill(label, { on: k === cur, ico, tone, onclick: () => { draw(k); onChange(k); } }))); };
  draw(active === undefined ? items[0][0] : active); return wrap;
}
// Select styled as a rounded dropdown pill with a leading icon.
function selectPill(ico, options, value, onChange) {
  const sel = h('select', { onchange: e => onChange(e.target.value) }, options.map(([v, l]) => h('option', { value: v, selected: String(v) === String(value) }, l)));
  return h('label', { class: 'selpill' }, ico ? icon(ico, 18) : null, sel);
}
// Search box with a trailing magnifier.
function searchBox(placeholder, onInput) {
  return h('label', { class: 'searchbox' }, h('input', { type: 'search', placeholder, oninput: e => onInput(e.target.value) }), icon('search', 20));
}
// Summary stat card (reservations / products). tone: blue|green|orange|red|purple
function statCard(tone, ico, label, value) {
  const wave = '<svg viewBox="0 0 120 30" preserveAspectRatio="none"><path d="M0 24 C20 8 35 26 60 16 S100 6 120 14 L120 30 L0 30Z" fill="currentColor" fill-opacity=".12"/><path d="M0 24 C20 8 35 26 60 16 S100 6 120 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const w = h('span', { class: 'st-wave' }); w.innerHTML = wave; // static markup, no user data
  return h('div', { class: 'stat ' + tone }, h('div', { class: 'st-tx' }, h('div', { class: 'st-l' }, label), h('div', { class: 'st-v' }, value)), h('span', { class: 'st-ic' }, icon(ico, 28)), w);
}
// Pager laid out left-to-right like the design: [‹] 1 2 3 [›]. Calls onPage(n).
function pager(total, size, page, onPage, label) {
  const pages = Math.max(1, Math.ceil(total / size));
  const nums = []; for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
  const btn = (on, ic, to, off) => h('button', { type: 'button', class: 'pg' + (on ? ' on' : ''), disabled: off, onclick: () => onPage(to) }, ic ? icon(ic, 18) : String(to));
  const out = [btn(false, 'dchevl', 1, page <= 1)];
  let prev = 0; for (const n of nums) { if (n - prev > 1) out.push(h('span', { class: 'pg-gap' }, '…')); out.push(btn(n === page, null, n)); prev = n; }
  out.push(btn(false, 'dchevr', pages, page >= pages));
  return h('div', { class: 'pager' }, h('div', { class: 'pg-info' }, icon('db', 18), label), h('div', { class: 'pg-btns' }, out));
}
