(async () => {
  const v = await boot('لوحة التحكم', 'orders.view'); if (!v) return;
  v.classList.add('dash');
  v.append(loading());
  const num = n => Number(n || 0).toLocaleString('en-US');
  const SVGNS = 'http://www.w3.org/2000/svg';

  // Small area sparkline (inline SVG) from a numeric series.
  function spark(vals, color) {
    const W = 140, H = 46, max = Math.max(...vals, 1), step = vals.length > 1 ? W / (vals.length - 1) : W;
    const pts = vals.map((x, i) => [i * step, H - 4 - (x / max) * (H - 10)]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('class', 'spark');
    svg.innerHTML = `<path d="${line} L${W} ${H} L0 ${H}Z" fill="${color}" fill-opacity=".18"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    return svg;
  }
  const pct = (cur, prev) => prev ? Math.round((cur - prev) / prev * 100) : null;
  const delta = p => p == null ? h('span', { class: 'delta muted' }, 'لا بيانات للمقارنة') : h('span', { class: 'delta ' + (p >= 0 ? 'up' : 'down') }, h('span', { class: 'ltr pc' }, (p >= 0 ? '↑ +' : '↓ ') + p + '%'), h('small', null, ' عن الأمس'));
  function stat(cls, ico, label, value, sub, sp) {
    return h('div', { class: 'card dk ' + cls }, h('div', { class: 'dk-top' }, h('span', { class: 'dk-ic' }, icon(ico, 26)), h('div', { class: 'dk-tx' }, h('div', { class: 'l' }, label), h('div', { class: 'big' }, value))),
      h('div', { class: 'dk-bot' }, sub, sp || null));
  }

  try {
    const { from, to } = rangeBounds(1);
    const d = await API.get('/reports/dashboard' + qs({ from, to }));
    let trend = await API.get('/reports/trend' + qs({ range: 'week', tz: tzOffset() })).catch(() => ({ points: [] }));
    clear(v);

    const week = trend.points || [];
    const sRev = week.map(p => p.revenue), sOrd = week.map(p => p.orders), sAvg = week.map(p => p.orders ? p.revenue / p.orders : 0);
    const today = new Date().toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    v.append(h('div', { class: 'dash-head' },
      h('div', null, h('h1', null, h('span', { class: 'hi' }, icon('bars', 30)), 'لوحة التحكم'), h('p', { class: 'muted' }, 'نظرة عامة على أداء مطعمك')),
      h('div', { class: 'date-chip' }, icon('calendar', 18), today)));

    v.append(h('div', { class: 'dk-grid' },
      stat('c-blue', 'card', 'إيراد اليوم', money(d.revenue), delta(pct(d.revenue, d.previous.revenue)), spark(sRev, '#3b82f6')),
      stat('c-orange', 'list', 'عدد الطلبات', num(d.orders), h('span', null, delta(pct(d.orders, d.previous.orders)), h('small', { class: 'muted block' }, `${num(d.completed)} مكتمل`)), spark(sOrd, '#f97316')),
      stat('c-purple', 'bars', 'متوسط الطلب', money(d.avgOrder), delta(pct(d.avgOrder, d.previous.avgOrder)), spark(sAvg, '#8b5cf6')),
      stat('c-green', 'trend', 'الربح الإجمالي', d.grossProfit == null ? '—' : money(d.grossProfit),
        h('span', null, h('small', { class: 'muted block' }, d.grossProfit == null ? 'تكلفة بعض المنتجات غير مسجلة' : 'بعد التكلفة والمرتجعات'), h('small', { class: 'muted block' }, 'المصروفات: ' + money(d.expenses))))));

    // ---- order status donut ----
    const sc = d.statusCounts || {}, total = Object.values(sc).reduce((a, b) => a + b, 0);
    const done = sc.COMPLETED || 0, cancelled = sc.CANCELLED || 0, active = total - done - cancelled;
    const share = n => total ? Math.round(n / total * 100) : 0;
    const donut = h('canvas', { width: 190, height: 190 });
    const statusCard = h('div', { class: 'card dk-status' }, h('h3', null, h('span', { class: 'hi sm' }, icon('list', 20)), 'حالة الطلبات'),
      total ? h('div', { class: 'status-body' },
        h('div', { class: 'donut' }, donut, h('div', { class: 'donut-c' }, h('b', null, num(total)), h('span', null, 'طلب اليوم'))),
        h('ul', { class: 'legend' },
          h('li', null, h('i', { style: 'background:#16a34a' }), 'مكتملة', h('b', null, share(done) + '%')),
          h('li', null, h('i', { style: 'background:#f59e0b' }), 'قيد التنفيذ', h('b', null, share(active) + '%')),
          h('li', null, h('i', { style: 'background:#ef4444' }), 'ملغية', h('b', null, share(cancelled) + '%'))))
        : h('div', { class: 'empty' }, 'لا طلبات اليوم'));

    // ---- weekly/monthly/yearly performance chart ----
    const chartCv = h('canvas', { height: 240 });
    let chart = null, cur = 'week';
    const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const label = (k, r) => { if (r === 'year') return new Date(k + '-01T00:00:00Z').toLocaleDateString('ar-EG-u-nu-latn', { month: 'short', timeZone: 'UTC' });
      const dt0 = new Date(k + 'T00:00:00Z'); return r === 'week' ? DAYS[dt0.getUTCDay()] : dt0.getUTCDate() + '/' + (dt0.getUTCMonth() + 1); };
    const titles = { week: 'أداء الأسبوع', month: 'أداء الشهر', year: 'أداء السنة' };
    const chartTitle = h('span', null, titles.week);
    function drawChart(points, range) {
      if (!window.Chart) return;
      const ctx = chartCv.getContext('2d'), g = ctx.createLinearGradient(0, 0, 0, 260); g.addColorStop(0, 'rgba(249,115,22,.35)'); g.addColorStop(1, 'rgba(249,115,22,0)');
      const data = { labels: points.map(p => label(p.key, range)), datasets: [{ data: points.map(p => p.revenue), borderColor: '#f97316', backgroundColor: g, fill: true, tension: .4, borderWidth: 3, pointRadius: range === 'month' ? 2 : 5, pointBackgroundColor: '#f97316', pointBorderColor: '#fff', pointBorderWidth: 2, pointHoverRadius: 7 }] };
      if (chart) { chart.data = data; chart.update(); return; }
      chart = new Chart(chartCv, { type: 'line', data, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false }, tooltip: { rtl: true, displayColors: false, callbacks: { label: c => money(c.parsed.y) + ' — ' + num(points[c.dataIndex].orders) + ' طلب' } } },
        scales: { y: { beginAtZero: true, grid: { color: 'rgba(148,163,184,.25)' }, ticks: { callback: x => x >= 1000 ? (x / 1000) + 'k' : x } }, x: { grid: { display: false } } } } });
    }
    async function setRange(r) {
      cur = r; chartTitle.textContent = titles[r];
      try { const t = r === 'week' ? trend : await API.get('/reports/trend' + qs({ range: r, tz: tzOffset() })); drawChart(t.points, r); } catch (e) { fail(e); }
    }
    const chartCard = h('div', { class: 'card dk-chart' }, h('div', { class: 'dk-chart-h' }, h('h3', null, h('span', { class: 'hi sm' }, icon('bars', 20)), chartTitle),
      tabs([['week', 'أسبوعي'], ['month', 'شهري'], ['year', 'سنوي']], setRange, 'week')), h('div', { class: 'chart-box' }, chartCv));
    v.append(h('div', { class: 'dk-mid' }, statusCard, chartCard));
    drawChart(week, 'week');
    if (window.Chart && total) new Chart(donut, { type: 'doughnut', data: { datasets: [{ data: [done, active, cancelled], backgroundColor: ['#16a34a', '#f59e0b', '#ef4444'], borderWidth: 0 }] },
      options: { cutout: '72%', plugins: { legend: { display: false }, tooltip: { enabled: false } }, events: [] } });

    // ---- recent orders ----
    const rows = d.recent || [];
    v.append(h('div', { class: 'card dk-recent' }, h('h3', null, h('span', { class: 'hi sm' }, icon('list', 20)), 'أحدث الطلبات'),
      rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'dk-table' },
        h('thead', null, h('tr', null, ['رقم الطلب', 'الوقت', 'المنتجات', 'الحالة', 'المبلغ', ''].map(t => h('th', null, t)))),
        h('tbody', null, rows.map(r => h('tr', null,
          h('td', { class: 'ltr b' }, '#' + r.number),
          h('td', { class: 'ltr' }, new Date(r.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })),
          h('td', null, r.items || '—'), h('td', null, statusBadge(r.status)), h('td', { class: 'ltr b' }, money(r.total)),
          h('td', null, h('a', { class: 'btn sm secondary', href: 'orders.html#' + r.id }, 'عرض التفاصيل'))))))) : h('div', { class: 'empty' }, 'لا طلبات اليوم')));

    // ---- extra insight cards (best sellers, low stock, payments, branches) ----
    const pay = h('canvas', { height: 180 });
    v.append(h('div', { class: 'dk-extra' },
      h('div', { class: 'card' }, h('h3', null, 'الأكثر مبيعًا'), d.bestSellers.length ? d.bestSellers.map(b => h('div', { class: 'cart-line' }, h('span', null, b.name), h('span', { class: 'muted ltr' }, `${num(b.qty)} × — ${money(b.revenue)}`))) : h('div', { class: 'empty' }, 'لا مبيعات بعد')),
      h('div', { class: 'card' }, h('h3', null, 'تنبيهات المخزون'), d.lowStock.length ? d.lowStock.map(i => h('div', { class: 'cart-line' }, h('span', null, i.name), h('span', { class: 'badge err' }, `${i.stock} ${i.unit}`))) : h('div', { class: 'empty' }, 'لا تنبيهات')),
      h('div', { class: 'card' }, h('h3', null, 'طرق الدفع'), pay),
      h('div', { class: 'card' }, h('h3', null, 'أداء الفروع'), d.branches.length ? d.branches.map(b => h('div', { class: 'cart-line' }, h('span', null, b.name), h('span', { class: 'ltr' }, `${money(b.revenue)} (${num(b.orders)})`))) : h('div', { class: 'empty' }, 'لا بيانات'))));
    if (window.Chart) new Chart(pay, { type: 'doughnut', data: { labels: Object.keys(d.payments).map(k => AR.method[k]), datasets: [{ data: Object.values(d.payments) }] } });
  } catch (e) { clear(v); v.append(h('div', { class: 'card empty' }, e.message)); }
})();
