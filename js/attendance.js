(async () => {
  const v = await boot('الحضور والانصراف', null); if (!v) return;
  const isMgr = ['employees.manage', 'orders.create'].some(x => ME.permissions.includes(x)); // cashier + manager use the tiles
  const mine = h('div'), all = h('div'), board = h('div');
  const dur = m => m == null ? 'مفتوح' : `${Math.floor(m / 60)}س ${m % 60}د`;
  async function load() {
    clear(mine); clear(all);
    if (isMgr) { loadBoard(); return; }
    try {
      const r = await API.get('/attendance/me');
      mine.append(h('div', { class: 'card' }, r.open ? [h('p', null, 'حضور منذ ' + dt(r.open.checkInAt)), h('button', { class: 'btn danger', onclick: async () => { await API.post('/attendance/check-out').catch(fail); load(); } }, 'تسجيل انصراف')]
        : [h('p', { class: 'muted' }, 'لا يوجد تسجيل حضور مفتوح'), h('button', { class: 'btn ok', onclick: async () => { await API.post('/attendance/check-in').catch(fail); load(); } }, 'تسجيل حضور')]),
        h('h3', null, 'آخر تسجيلاتي'), dataTable([{ label: 'حضور', render: a => dt(a.checkInAt) }, { label: 'انصراف', render: a => dt(a.checkOutAt) }], r.recent, 'لا سجلات'));
    } catch (e) { mine.append(h('div', { class: 'card empty' }, e.message)); }
    if (!isMgr) return;
  }
  // ---- manager: one tile per person (staff without account + account users) with a live work timer ----
  const pad = n => String(n).padStart(2, '0');
    const hms = ms => { const t = Math.max(0, Math.floor(ms / 1000)); return `${pad(Math.floor(t / 3600))}:${pad(Math.floor(t % 3600 / 60))}:${pad(t % 60)}`; };
  let ticker = null, offset = 0, people = [];
  async function act(p, what) {
    try { await API.post('/attendance/board/' + what, { kind: p.kind, id: p.id }); if (what === 'check-out') toast('تم تسجيل الانصراف'); await loadBoard(); } catch (e) { fail(e); }
  }
  function drawBoard() {
    clear(board);
    if (!people.length) { board.append(h('div', { class: 'card empty' }, 'لا يوجد موظفون — أضفهم من صفحة الموظفين')); return; }
    board.append(h('div', { class: 'att-grid' }, people.map(p => {
      const on = !!p.open, timer = h('div', { class: 'att-timer', 'data-in': on ? p.open.checkInAt : '' }, on ? hms(Date.now() + offset - new Date(p.open.checkInAt)) : '00:00:00');
      return h('div', { class: 'att-tile' + (on ? ' on' : '') },
        h('div', { class: 'att-top' }, h('span', { class: 'att-av' }, p.name.trim().charAt(0)), h('div', { class: 'att-nm' }, h('strong', null, p.name), h('small', null, p.sub)), h('span', { class: 'att-st' }, on ? 'حاضر' : 'غير حاضر')),
        timer,
        on ? h('button', { class: 'btn danger att-btn', onclick: () => act(p, 'check-out') }, icon('stop', 18), 'انصراف') : h('button', { class: 'btn ok att-btn', onclick: () => act(p, 'check-in') }, icon('play', 18), 'حضور'));
    })));
  }
  function tick() { board.querySelectorAll('.att-timer[data-in]').forEach(el => { if (el.dataset.in) el.textContent = hms(Date.now() + offset - new Date(el.dataset.in)); }); }
  async function loadBoard() {
    try { const r = await API.get('/attendance/board'); offset = new Date(r.now) - Date.now(); people = r.people; drawBoard(); }
    catch (e) { clear(board); board.append(h('div', { class: 'card empty' }, e.message)); }
    if (!ticker) ticker = setInterval(tick, 1000);
  }
  if (isMgr) v.append(pageHead('الحضور والانصراف', 'اضغط «حضور» ليبدأ عدّاد الموظف و«انصراف» لإيقافه', 'clock'), board);
  else v.append(mine, all);
  load();
})();
