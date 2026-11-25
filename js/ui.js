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
const money = n => Number(n || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + ((window.ME && ME.tenant && ME.tenant.currency) || 'EGP');
const dt = d => d ? new Date(d).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : '-';
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
// fields: {name,label,type(text|number|password|email|date|datetime-local|textarea|select|checkbox|multicheck),options:[{value,label}],required,step,hint}
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
    if (f.type === 'textarea') el = h('textarea', { value: v ?? '' });
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
function dataTable(cols, rows, emptyMsg = 'لا توجد بيانات') {
  if (!rows || !rows.length) return h('div', { class: 'card empty' }, emptyMsg);
  return h('div', { class: 'table-wrap' }, h('table', null,
    h('thead', null, h('tr', null, cols.map(c => h('th', null, c.label)))),
    h('tbody', null, rows.map(r => h('tr', null, cols.map(c => h('td', null, c.render ? c.render(r) : (r[c.key] ?? '-'))))))));
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
