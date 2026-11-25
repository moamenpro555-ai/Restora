(async () => {
  const v = await boot('لوحة التحكم', 'orders.view'); if (!v) return;
  v.append(loading());
  try {
    const { from, to } = rangeBounds(1);
    const d = await API.get('/reports/dashboard' + qs({ from, to }));
    clear(v);
    const delta = d.previous.revenue ? Math.round((d.revenue - d.previous.revenue) / d.previous.revenue * 100) + '% عن الأمس' : 'لا بيانات للأمس';
    v.append(h('div', { class: 'kpis' },
      kpi('إيراد اليوم', money(d.revenue), delta), kpi('عدد الطلبات', d.orders, `${d.completed} مكتمل`), kpi('متوسط الطلب', money(d.avgOrder)),
      kpi('المصروفات', money(d.expenses)),
      kpi('الربح الإجمالي', d.grossProfit == null ? '—' : money(d.grossProfit), d.grossProfit == null ? 'تكلفة بعض المنتجات غير مسجلة' : 'بعد التكلفة والمرتجعات')));
    const pay = h('canvas', { height: 180 });
    v.append(h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fit,minmax(300px,1fr))' },
      h('div', { class: 'card' }, h('h3', null, 'الأكثر مبيعًا'), d.bestSellers.length ? d.bestSellers.map(b => h('div', { class: 'cart-line' }, h('span', null, b.name), h('span', { class: 'muted' }, `${b.qty} × — ${money(b.revenue)}`))) : h('div', { class: 'empty' }, 'لا مبيعات بعد')),
      h('div', { class: 'card' }, h('h3', null, 'تنبيهات المخزون'), d.lowStock.length ? d.lowStock.map(i => h('div', { class: 'cart-line' }, h('span', null, i.name), h('span', { class: 'badge err' }, `${i.stock} ${i.unit}`))) : h('div', { class: 'empty' }, 'لا تنبيهات')),
      h('div', { class: 'card' }, h('h3', null, 'طرق الدفع'), pay),
      h('div', { class: 'card' }, h('h3', null, 'أداء الفروع'), d.branches.length ? d.branches.map(b => h('div', { class: 'cart-line' }, h('span', null, b.name), h('span', null, `${money(b.revenue)} (${b.orders})`))) : h('div', { class: 'empty' }, 'لا بيانات'))));
    if (window.Chart) new Chart(pay, { type: 'doughnut', data: { labels: Object.keys(d.payments).map(k => AR.method[k]), datasets: [{ data: Object.values(d.payments) }] } });
    v.append(h('h3', null, 'آخر الطلبات'), dataTable([
      { label: '#', render: r => r.number }, { label: 'المصدر', render: r => AR.source[r.source] }, { label: 'الحالة', render: r => statusBadge(r.status) },
      { label: 'الإجمالي', render: r => money(r.total) }, { label: 'الوقت', render: r => dt(r.createdAt) }], d.recent, 'لا طلبات اليوم'));
  } catch (e) { clear(v); v.append(h('div', { class: 'card empty' }, e.message)); }
})();
