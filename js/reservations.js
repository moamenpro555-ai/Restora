(async () => {
  const v = await boot('الحجوزات', 'reservations.manage', { tagline: 'إدارة سهلة للحجوزات .. وتجربة أفضل لعملائك' }); if (!v) return;
  const statsBox = h('div', { class: 'stats' }), list = h('div');
  let day = new Date().toISOString().slice(0, 10), tables = [], branches = [], all = [], fStatus = '', fTable = '', term = '', page = 1;
  const PAGE = 8;
  const ST = { PENDING: 'قيد الانتظار', CONFIRMED: 'مؤكد', SEATED: 'جلسوا', COMPLETED: 'منتهي', CANCELLED: 'ملغي', NO_SHOW: 'لم يحضر' };
  const ST_CHIP = { CONFIRMED: ['ok', 'checkc'], PENDING: ['warn', 'clock'], SEATED: ['info', 'users'], COMPLETED: ['ok', 'checkc'], CANCELLED: ['err', 'xc'], NO_SHOW: ['err', 'xc'] };
  const pad = n => String(n).padStart(2, '0');
  const bounds = () => { const f = new Date(day + 'T00:00:00'); return { from: f.toISOString(), to: new Date(f.getTime() + 864e5).toISOString() }; };
  const timeStr = d => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = d => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
  function statusMenu(btn, r) {
    document.querySelectorAll('.menu-pop').forEach(x => x.remove());
    const rc = btn.getBoundingClientRect();
    const pop = h('div', { class: 'menu-pop', style: `top:${rc.bottom + window.scrollY + 4}px;left:${Math.max(8, rc.left + window.scrollX)}px` },
      Object.entries(ST).map(([k, n]) => h('button', { class: k === r.status ? 'cur' : '', onclick: async () => { pop.remove(); await API.patch('/reservations/' + r.id, { status: k }).catch(fail); load(); } }, n)));
    document.body.append(pop); setTimeout(() => document.addEventListener('click', () => pop.remove(), { once: true }), 0);
  }
  function draw() {
    clear(statsBox); clear(list);
    const n = ss => all.filter(r => ss.includes(r.status)).length;
    statsBox.append(statCard('green', 'checkc', 'مؤكدة', n(['CONFIRMED', 'SEATED', 'COMPLETED'])), statCard('orange', 'clock', 'قيد الانتظار', n(['PENDING'])), statCard('red', 'xc', 'ملغاة', n(['CANCELLED', 'NO_SHOW'])), statCard('purple', 'calendar', 'إجمالي الحجوزات', all.length));
    const t = term.trim().toLowerCase();
    const rows = all.filter(r => (!fStatus || r.status === fStatus) && (!fTable || r.tableId === fTable) && (!t || r.customerName.toLowerCase().includes(t) || String(r.phone).includes(t)));
    const pages = Math.max(1, Math.ceil(rows.length / PAGE)); if (page > pages) page = pages;
    const slice = rows.slice((page - 1) * PAGE, page * PAGE);
    list.append(h('div', { class: 'tbl-card' }, dataTable([
      { label: '#', render: r => rows.indexOf(r) + 1 }, { label: 'اسم العميل', key: 'customerName' },
      { label: 'رقم الهاتف', render: r => h('span', { class: 'ic-line ltr' }, r.phone, icon('phone', 16)) },
      { label: 'الطاولة', render: r => r.table ? chip('طاولة ' + r.table.number) : '-' },
      { label: 'عدد الأشخاص', render: r => h('span', { class: 'ic-line' }, r.guests, icon('users', 18)) },
      { label: 'التاريخ والوقت', render: r => { const d = new Date(r.reservedAt); return h('div', null, h('span', { class: 'ic-line ltr' }, timeStr(d), icon('clock', 16)), h('span', { class: 'sub ltr' }, dateStr(d))); } },
      { label: 'الحالة', render: r => chip(ST[r.status], ST_CHIP[r.status][0], ST_CHIP[r.status][1]) },
      { label: 'الإجراءات', render: r => h('div', { class: 'act-row' }, h('button', { class: 'ibtn', title: 'تعديل', onclick: () => form(r) }, icon('eye', 18)), h('button', { class: 'ibtn', title: 'تغيير الحالة', onclick: e => { e.stopPropagation(); statusMenu(e.currentTarget, r); } }, icon('dots', 18))) }],
      slice, 'لا حجوزات في هذا اليوم', 'rt'), rows.length ? pager(rows.length, PAGE, page, k => { page = k; draw(); }, `عرض ${slice.length} من ${rows.length} حجز`) : null));
  }
  async function load() {
    clear(list); list.append(loading());
    try {
      [tables, branches] = await Promise.all([API.get('/tables'), API.get('/branches')]);
      all = await API.get('/reservations' + qs(bounds()));
      tblSel.replaceChildren(h('option', { value: '' }, 'كل الطاولات'), ...tables.map(x => h('option', { value: x.id, selected: x.id === fTable }, 'طاولة ' + x.number)));
      draw();
    } catch (e) { clear(statsBox); clear(list); list.append(h('div', { class: 'card empty' }, e.code === 'FEATURE_LOCKED' ? 'الحجوزات غير متاحة في باقتك' : e.message)); }
  }
  const local = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
  const form = r => formModal({ title: r ? 'تعديل حجز' : 'حجز جديد', values: r ? { ...r, reservedAt: local(r.reservedAt), tableId: r.tableId || '' } : { guests: 2, reservedAt: local(day + 'T20:00:00') },
    fields: [{ name: 'customerName', label: 'الاسم', required: true }, { name: 'phone', label: 'الهاتف', required: true }, { name: 'guests', label: 'عدد الأشخاص', type: 'number', required: true }, { name: 'reservedAt', label: 'الموعد', type: 'datetime-local', required: true },
      ...(!r && branches.length > 1 ? [{ name: 'branchId', label: 'الفرع', type: 'select', options: branches.map(b => ({ value: b.id, label: b.name })) }] : []),
      { name: 'tableId', label: 'الطاولة', type: 'select', options: [{ value: '', label: '—' }, ...tables.map(t => ({ value: t.id, label: `${t.number} (${t.seats})${branches.length > 1 ? ' - ' + t.branch.name : ''}` }))] }, { name: 'notes', label: 'ملاحظات', type: 'textarea' }],
    onSubmit: async d => { const b = { ...d, tableId: d.tableId || null }; if (r) await API.patch('/reservations/' + r.id, b); else await API.post('/reservations', b); load(); } });
  const tblSel = h('select', { onchange: e => { fTable = e.target.value; page = 1; draw(); } }, h('option', { value: '' }, 'كل الطاولات'));
  v.append(pageHead('الحجوزات', 'إدارة حجوزات الطاولات ومتابعة حالتها', 'calendar', h('button', { class: 'btn lg', onclick: () => form() }, icon('plus', 20), 'حجز جديد')),
    statsBox,
    h('div', { class: 'filters' },
      h('div', { class: 'grp' },
        h('label', { class: 'selpill' }, icon('calendar', 18), h('input', { type: 'date', value: day, onchange: e => { if (!e.target.value) return; day = e.target.value; page = 1; load(); } })),
        selectPill('filter', [['', 'كل الحالات'], ...Object.entries(ST)], fStatus, k => { fStatus = k; page = 1; draw(); }),
        h('label', { class: 'selpill' }, icon('table', 18), tblSel)),
      searchBox('بحث بالاسم أو رقم الهاتف...', x => { term = x; page = 1; draw(); })),
    list);
  load();
})();
