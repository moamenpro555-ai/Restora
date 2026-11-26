(async () => {
  const v = await boot('التقارير', 'reports.view', { foot: { text: '© 2025 Restora. جميع الحقوق محفوظة', icon: 'heart', side: 'معاً .. لنجاح أكبر' } }); if (!v) return;
  let days = 30, branchId = '', branches = [];
  const out = h('div'); const charts = [];
  const q = () => ({ ...rangeBounds(days), tz: tzOffset(), branchId: branchId || undefined });
  async function load() {
    clear(out); out.append(loading()); charts.splice(0).forEach(c => c.destroy());
    try {
      const r = await API.get('/reports/sales' + qs(q())); clear(out);
      const dl = r.previous.revenue ? Math.round((r.summary.revenue - r.previous.revenue) / r.previous.revenue * 100) + '% مقارنة بالفترة السابقة' : 'لا بيانات للفترة السابقة';
      const c1 = h('canvas', { height: 120 }), c2 = h('canvas', { height: 120 });
      const T = (title, rows, label = 'القيمة') => h('div', { class: 'sect' }, h('h3', null, icon('bars', 22), title), h('div', { class: 'tbl-card' }, dataTable([{ label: 'البند', cls: 'start', render: x => AR.source[x.key] || AR.type[x.key] || AR.method[x.key] || x.key }, { label: 'الإيراد', render: x => money(x.revenue) }, { label: 'العدد', key: 'count' }], rows, 'لا بيانات', 'rt')));
      out.append(h('div', { class: 'stats' }, statCard('orange', 'trend', 'الإيراد', money(r.summary.revenue), dl), statCard('blue', 'cart', 'الطلبات', r.summary.orders, `مكتمل: ${r.summary.completed}`), statCard('green', 'wallet', 'متوسط الطلب', money(r.summary.avgOrder)), statCard('purple', 'box', 'خصومات', money(r.summary.discounts))),
        h('div', { class: 'sect' }, h('h3', null, icon('bars', 24), 'المبيعات اليومية'), h('div', { class: 'legend' }, h('i'), 'الإيراد'), c1),
        h('div', { class: 'sect' }, h('h3', null, icon('bars', 24), 'أفضل المنتجات'), c2),
        h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fit,minmax(340px,1fr));align-items:start' }, T('حسب المصدر', r.bySource), T('حسب نوع الطلب', r.byType), T('طرق الدفع (صافي)', r.byPayment), T('حسب الفرع', r.byBranch), T('حسب التصنيف', r.byCategory), T('أداء الموظفين', r.byEmployee), T('أداء المنتجات', r.byProduct)));
      if (window.Chart) {
        charts.push(new Chart(c1, { type: 'line', data: { labels: r.daily.map(d => d.date), datasets: [{ label: 'الإيراد', data: r.daily.map(d => d.revenue), borderColor: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(), backgroundColor: 'rgba(249,115,22,.12)', fill: true, tension: .35 }] }, options: { plugins: { legend: { display: false } } } }));
        charts.push(new Chart(c2, { type: 'bar', data: { labels: r.byProduct.slice(0, 10).map(p => p.key), datasets: [{ label: 'الإيراد', data: r.byProduct.slice(0, 10).map(p => p.revenue) }] } }));
      }
    } catch (e) { clear(out); out.append(h('div', { class: 'card empty' }, e.message)); }
  }
  async function csv() { try { download('sales.csv', await API.req('/reports/sales' + qs({ ...q(), format: 'csv' }), { blob: true })); } catch (e) { fail(e); } }
  async function inv() {
    try { const rows = await API.get('/reports/inventory' + qs(q())); modal('تقرير المخزون والهدر', dataTable([{ label: 'المكون', key: 'name' }, { label: 'المخزون', render: i => `${Number(i.stock)} ${i.unit}` }, { label: 'الهدر (الفترة)', render: i => i.waste }, { label: 'القيمة', render: i => i.value == null ? '—' : money(i.value) }, { label: 'منخفض', render: i => i.low ? 'نعم' : '-' }], rows), { wide: true }); } catch (e) { fail(e); }
  }
  try { branches = await API.get('/branches'); } catch {}
  v.append(h('div', { class: 'filters' }, h('div', { class: 'grp' },
    selectPill('calendar', [[1, 'اليوم'], [7, '7 أيام'], [30, '30 يومًا'], [90, '90 يومًا'], [365, 'سنة']], days, d => { days = Number(d); load(); }),
    branches.length > 1 ? selectPill('store', [['', 'كل الفروع'], ...branches.map(b => [b.id, b.name])], branchId, k => { branchId = k; load(); }) : null,
    h('button', { class: 'btn detail', onclick: csv }, icon('download', 18), 'تصدير CSV'), h('button', { class: 'btn detail', onclick: () => window.print() }, icon('printer', 18), 'طباعة / حفظ PDF'), h('button', { class: 'btn detail', onclick: inv }, icon('box', 18), 'تقرير المخزون'))), out);
  load();
})();
