(async () => {
  const v = await boot('التقارير', 'reports.view'); if (!v) return;
  let days = 30, branchId = '', branches = [];
  const out = h('div'); const charts = [];
  const q = () => ({ ...rangeBounds(days), tz: tzOffset(), branchId: branchId || undefined });
  async function load() {
    clear(out); out.append(loading()); charts.splice(0).forEach(c => c.destroy());
    try {
      const r = await API.get('/reports/sales' + qs(q())); clear(out);
      const dl = r.previous.revenue ? Math.round((r.summary.revenue - r.previous.revenue) / r.previous.revenue * 100) + '% مقارنة بالفترة السابقة' : 'لا بيانات للفترة السابقة';
      const c1 = h('canvas', { height: 120 }), c2 = h('canvas', { height: 120 });
      const T = (title, rows, label = 'القيمة') => h('div', null, h('h3', null, title), dataTable([{ label: 'البند', render: x => AR.source[x.key] || AR.type[x.key] || AR.method[x.key] || x.key }, { label: 'الإيراد', render: x => money(x.revenue) }, { label: 'العدد', key: 'count' }], rows));
      out.append(h('div', { class: 'kpis' }, kpi('الإيراد', money(r.summary.revenue), dl), kpi('الطلبات', r.summary.orders, `مكتمل: ${r.summary.completed}`), kpi('متوسط الطلب', money(r.summary.avgOrder)), kpi('خصومات', money(r.summary.discounts))),
        h('div', { class: 'card' }, h('h3', null, 'المبيعات اليومية'), c1), h('div', { class: 'card', style: 'margin-top:12px' }, h('h3', null, 'أفضل المنتجات'), c2),
        h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fit,minmax(340px,1fr));margin-top:12px' }, T('حسب المصدر', r.bySource), T('حسب نوع الطلب', r.byType), T('طرق الدفع (صافي)', r.byPayment), T('حسب الفرع', r.byBranch), T('حسب التصنيف', r.byCategory), T('أداء الموظفين', r.byEmployee), T('أداء المنتجات', r.byProduct)));
      if (window.Chart) {
        charts.push(new Chart(c1, { type: 'line', data: { labels: r.daily.map(d => d.date), datasets: [{ label: 'الإيراد', data: r.daily.map(d => d.revenue), borderColor: getComputedStyle(document.documentElement).getPropertyValue('--primary') }] } }));
        charts.push(new Chart(c2, { type: 'bar', data: { labels: r.byProduct.slice(0, 10).map(p => p.key), datasets: [{ label: 'الإيراد', data: r.byProduct.slice(0, 10).map(p => p.revenue) }] } }));
      }
    } catch (e) { clear(out); out.append(h('div', { class: 'card empty' }, e.message)); }
  }
  async function csv() { try { download('sales.csv', await API.req('/reports/sales' + qs({ ...q(), format: 'csv' }), { blob: true })); } catch (e) { fail(e); } }
  async function inv() {
    try { const rows = await API.get('/reports/inventory' + qs(q())); modal('تقرير المخزون والهدر', dataTable([{ label: 'المكون', key: 'name' }, { label: 'المخزون', render: i => `${Number(i.stock)} ${i.unit}` }, { label: 'الهدر (الفترة)', render: i => i.waste }, { label: 'القيمة', render: i => i.value == null ? '—' : money(i.value) }, { label: 'منخفض', render: i => i.low ? 'نعم' : '-' }], rows), { wide: true }); } catch (e) { fail(e); }
  }
  try { branches = await API.get('/branches'); } catch {}
  v.append(h('div', { class: 'toolbar' }, h('select', { onchange: e => { days = Number(e.target.value); load(); } }, [[1, 'اليوم'], [7, '7 أيام'], [30, '30 يومًا'], [90, '90 يومًا'], [365, 'سنة']].map(([d, n]) => h('option', { value: d, selected: d === days }, n))),
    branches.length > 1 ? h('select', { onchange: e => { branchId = e.target.value; load(); } }, h('option', { value: '' }, 'كل الفروع'), branches.map(b => h('option', { value: b.id }, b.name))) : null,
    h('button', { class: 'btn secondary', onclick: csv }, 'تصدير CSV'), h('button', { class: 'btn secondary', onclick: () => window.print() }, 'طباعة / حفظ PDF'), h('button', { class: 'btn secondary', onclick: inv }, 'تقرير المخزون')), out);
  load();
})();
