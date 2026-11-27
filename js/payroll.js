(async () => {
  const v = await boot('رواتب الموظفين', 'employees.manage'); if (!v) return;
  const now = new Date(); let month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const body = h('div');
  const hm = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; // hours:minutes
  const setRate = p => formModal({ title: 'سعر الساعة: ' + p.name, values: { rate: p.rate == null ? '' : p.rate },
    fields: [{ name: 'rate', label: 'سعر الساعة', type: 'number', step: '0.01', min: '0', required: true }],
    onSubmit: async d => { await API.patch('/payroll/rate', { kind: p.kind, id: p.id, rate: Number(d.rate) }); load(); } });
  // Printed pay slip (same card look as the sales receipt): shifts, total hours, hourly rate and total pay.
  async function printSlip(p, monthLabel) {
    let shifts = [], brand = null;
    try { [shifts, brand] = await Promise.all([API.get('/payroll/shifts' + qs({ kind: p.kind, id: p.id, month })), API.get('/settings/branding').catch(() => null)]); } catch (e) { return fail(e); }
    const t = (ME && ME.tenant) || {}, cur = t.currency || 'EGP', n = x => Number(x || 0).toFixed(2) + ' ' + cur;
    const row = (a, b) => h('div', { class: 'r-row' }, h('span', null, a), h('span', null, b));
    const day = d => new Date(d).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'numeric' });
    const tm = d => d ? new Date(d).toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'مفتوح';
    const pa = $('#print-area'); clear(pa);
    pa.append(h('div', { class: 'rcpt' }, h('div', { class: 'r-corner' }), h('div', { class: 'r-body' },
      h('div', { class: 'r-head' }, h('div', { class: 'r-info' }, h('span', { class: 'r-badge' }, 'إيصال مرتب'), h('div', { style: 'margin-top:4px' }, 'شهر ' + monthLabel)),
        h('div', { class: 'r-brand' }, h('div', null, h('h1', { class: 'r-name' }, t.name || '')), brand && brand.logoUrl ? h('img', { class: 'r-logo', src: brand.logoUrl, alt: '' }) : h('div', { class: 'r-logo' }, icon('chef', 40)))),
      h('div', { class: 'r-chips' }, h('span', null, 'الموظف: ' + p.name), h('span', null, p.sub)),
      shifts.length ? h('table', null, h('thead', null, h('tr', null, h('th', { class: 'c-n' }, 'اليوم'), h('th', null, 'حضور'), h('th', null, 'انصراف'), h('th', null, 'المدة'))),
        h('tbody', null, shifts.map(s => h('tr', null, h('td', null, day(s.checkInAt)), h('td', { class: 'num' }, tm(s.checkInAt)), h('td', { class: 'num' }, tm(s.checkOutAt)), h('td', { class: 'num' }, hm(s.minutes)))))) : null,
      h('div', { class: 'r-sums' }, row('عدد الساعات', hm(p.minutes) + ' ساعة'), row('سعر الساعة', p.rate == null ? '-' : n(p.rate))),
      h('div', { class: 'r-total' }, h('span', null, 'إجمالي المرتب'), h('span', null, p.rate == null ? '-' : n(p.pay))),
      h('div', { class: 'r-thanks' }, 'شكراً لجهودك في ' + (t.name || '')), h('div', { class: 'r-heart' }, h('i'), h('span', null, '♥'), h('i'))),
      h('div', { class: 'r-bar' }, 'توقيع الموظف: ____________________')));
    const old = document.title; document.title = (t.name || old) + ' - ' + p.name;
    const back = () => { document.title = old; window.removeEventListener('afterprint', back); }; window.addEventListener('afterprint', back);
    setTimeout(() => window.print(), 150);
  }
  async function load() {
    clear(body); body.append(loading());
    try {
      const r = await API.get('/payroll' + qs({ month })); clear(body);
      body.append(h('div', { class: 'stats' }, statCard('blue', 'clock', 'إجمالي الساعات', h('span', { class: 'ltr' }, hm(r.totalMinutes)), 'ساعة:دقيقة'), statCard('green', 'wallet', 'إجمالي الرواتب', money(r.totalPay), 'عن شهر ' + r.month)),
        h('div', { class: 'tbl-card' }, dataTable([
          { label: 'الموظف', cls: 'start', render: p => h('div', null, h('strong', null, p.name), h('div', { class: 'muted' }, p.sub)) },
          { label: 'عدد الساعات', render: p => h('b', { class: 'ltr' }, hm(p.minutes)) },
          { label: 'سعر الساعة', render: p => p.rate == null ? h('span', { class: 'muted' }, 'غير محدد') : h('span', { class: 'ltr' }, money(p.rate)) },
          { label: 'المرتب', render: p => h('b', { class: 'ltr' }, p.rate == null ? '-' : money(p.pay)) },
          { label: 'إجراءات', render: p => h('div', { class: 'act-row' }, h('button', { class: 'ibtn orange', title: 'تحديد سعر الساعة', onclick: () => setRate(p) }, icon('edit', 18)), h('button', { class: 'ibtn blue', title: 'طباعة إيصال المرتب', onclick: () => printSlip(p, r.month) }, icon('printer', 18))) }],
          r.people, 'لا يوجد موظفون', 'rt')));
    } catch (e) { clear(body); body.append(h('div', { class: 'card empty' }, e.message)); }
  }
  const mi = h('input', { type: 'month', value: month, onchange: e => { if (e.target.value) { month = e.target.value; load(); } } });
  v.append(pageHead('رواتب الموظفين', 'ساعات كل موظف وسعر ساعته ومرتبه عن الشهر المختار (المرتب = الساعات × سعر الساعة)', 'wallet', h('div', { class: 'grp' }, mi)), body);
  load();
})();
