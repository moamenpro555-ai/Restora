(async () => {
  const v = await boot('الحضور والانصراف', null); if (!v) return;
  const mine = h('div'), all = h('div');
  const dur = m => m == null ? 'مفتوح' : `${Math.floor(m / 60)}س ${m % 60}د`;
  async function load() {
    clear(mine); clear(all);
    try {
      const r = await API.get('/attendance/me');
      mine.append(h('div', { class: 'card' }, r.open ? [h('p', null, 'حضور منذ ' + dt(r.open.checkInAt)), h('button', { class: 'btn danger', onclick: async () => { await API.post('/attendance/check-out').catch(fail); load(); } }, 'تسجيل انصراف')]
        : [h('p', { class: 'muted' }, 'لا يوجد تسجيل حضور مفتوح'), h('button', { class: 'btn ok', onclick: async () => { await API.post('/attendance/check-in').catch(fail); load(); } }, 'تسجيل حضور')]),
        h('h3', null, 'آخر تسجيلاتي'), dataTable([{ label: 'حضور', render: a => dt(a.checkInAt) }, { label: 'انصراف', render: a => dt(a.checkOutAt) }], r.recent, 'لا سجلات'));
    } catch (e) { mine.append(h('div', { class: 'card empty' }, e.message)); }
    if (ME.permissions.includes('employees.manage')) {
      try {
        const { from, to } = rangeBounds(7); const rows = await API.get('/attendance' + qs({ from, to }));
        all.append(h('h3', null, 'سجل الفريق - آخر 7 أيام'), dataTable([{ label: 'الموظف', key: 'userName' }, { label: 'حضور', render: a => dt(a.checkInAt) }, { label: 'انصراف', render: a => dt(a.checkOutAt) }, { label: 'المدة', render: a => dur(a.minutes) }], rows, 'لا سجلات'));
      } catch (e) { all.append(h('div', { class: 'card empty' }, e.message)); }
    }
  }
  v.append(mine, all); load();
})();
