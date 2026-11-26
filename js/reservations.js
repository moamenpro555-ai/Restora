(async () => {
  const v = await boot('الحجوزات', 'reservations.manage'); if (!v) return;
  const list = h('div'); let day = new Date().toISOString().slice(0, 10), tables = [], branches = [];
  const ST = { PENDING: 'قيد الانتظار', CONFIRMED: 'مؤكد', SEATED: 'جلسوا', COMPLETED: 'منتهي', CANCELLED: 'ملغي', NO_SHOW: 'لم يحضر' };
  const bounds = () => { const f = new Date(day + 'T00:00:00'); return { from: f.toISOString(), to: new Date(f.getTime() + 864e5).toISOString() }; };
  async function load() {
    clear(list); list.append(loading());
    try {
      [tables, branches] = await Promise.all([API.get('/tables'), API.get('/branches')]);
      const rows = await API.get('/reservations' + qs(bounds())); clear(list);
      list.append(dataTable([{ label: 'الوقت', render: r => new Date(r.reservedAt).toLocaleTimeString('ar-EG-u-nu-latn', { timeStyle: 'short' }) }, { label: 'الاسم', key: 'customerName' }, { label: 'الهاتف', key: 'phone' }, { label: 'الأشخاص', key: 'guests' },
        { label: 'الطاولة', render: r => r.table ? r.table.number : '-' }, { label: 'الحالة', render: r => h('span', { class: 'badge ' + (['CANCELLED', 'NO_SHOW'].includes(r.status) ? 'err' : r.status === 'PENDING' ? 'warn' : 'ok') }, ST[r.status]) },
        { label: '', render: r => h('div', { class: 'row' }, h('button', { class: 'btn sm secondary', onclick: () => form(r) }, 'تعديل'),
          h('select', { onchange: async e => { await API.patch('/reservations/' + r.id, { status: e.target.value }).catch(fail); load(); } }, Object.entries(ST).map(([k, n]) => h('option', { value: k, selected: k === r.status }, n)))) }], rows, 'لا حجوزات في هذا اليوم'));
    } catch (e) { clear(list); list.append(h('div', { class: 'card empty' }, e.code === 'FEATURE_LOCKED' ? 'الحجوزات غير متاحة في باقتك' : e.message)); }
  }
  const local = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
  const form = r => formModal({ title: r ? 'تعديل حجز' : 'حجز جديد', values: r ? { ...r, reservedAt: local(r.reservedAt), tableId: r.tableId || '' } : { guests: 2, reservedAt: local(day + 'T20:00:00') },
    fields: [{ name: 'customerName', label: 'الاسم', required: true }, { name: 'phone', label: 'الهاتف', required: true }, { name: 'guests', label: 'عدد الأشخاص', type: 'number', required: true }, { name: 'reservedAt', label: 'الموعد', type: 'datetime-local', required: true },
      ...(!r && branches.length > 1 ? [{ name: 'branchId', label: 'الفرع', type: 'select', options: branches.map(b => ({ value: b.id, label: b.name })) }] : []),
      { name: 'tableId', label: 'الطاولة', type: 'select', options: [{ value: '', label: '—' }, ...tables.map(t => ({ value: t.id, label: `${t.number} (${t.seats})${branches.length > 1 ? ' - ' + t.branch.name : ''}` }))] }, { name: 'notes', label: 'ملاحظات', type: 'textarea' }],
    onSubmit: async d => { const b = { ...d, tableId: d.tableId || null }; if (r) await API.patch('/reservations/' + r.id, b); else await API.post('/reservations', b); load(); } });
  v.append(h('div', { class: 'toolbar' }, h('input', { type: 'date', value: day, onchange: e => { day = e.target.value; load(); } }), h('button', { class: 'btn', onclick: () => form() }, '+ حجز')), list);
  load();
})();
