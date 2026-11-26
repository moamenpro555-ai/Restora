(async () => {
  const v = await boot('الاشتراك', 'subscription.manage', {
    tagline: 'إدارة اشتراكك بكل سهولة', support: true,
    foot: { text: '© 2025 Restora. جميع الحقوق محفوظة', icon: 'heart', side: 'معاً .. لنجعل أكثر' }
  });
  if (!v) return;
  let cycle = 'MONTHLY', data = null;
  const body = h('div');
  const SS = { TRIAL: 'تجريبي', ACTIVE: 'نشط', GRACE: 'فترة سماح', EXPIRED: 'منتهي', CANCELLED: 'ملغي' };
  const PS = { PENDING: 'قيد المراجعة', VERIFIED: 'مؤكد', REJECTED: 'مرفوض' };
  const PLAN_ICON = { STARTER: 'rocket', PROFESSIONAL: 'gem', ENTERPRISE: 'briefcase' };
  const FEATURE_AR = { pos: 'الكاشير', menu: 'المنيو', inventory: 'المخزون والوصفات', crm: 'إدارة العملاء', reservations: 'الحجوزات', finance: 'المالية', reports: 'التقارير' };
  const LEVEL_AR = { basic: 'أساسية', advanced: 'متقدمة', priority: 'ذو أولوية' };

  // date + time as separate LTR-isolated pieces so the bidi algorithm can't scramble them
  const dateOnly = d => new Date(d).toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeOnly = d => new Date(d).toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' });
  const priceOf = p => cycle === 'ANNUAL' ? p.priceAnnual : p.priceMonthly;
  const fmtPrice = n => {
    const cur = (window.ME && ME.tenant && ME.tenant.currency) || 'EGP';
    return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + cur;
  };

  function featureLines(p) {
    const f = p.features || {};
    const lines = [`حتى ${p.maxBranches} فرع`, `حتى ${p.maxEmployees} ${p.maxEmployees <= 10 ? 'موظفين' : 'موظف'}`];
    if (f.all) lines.push('جميع المميزات');
    else {
      const names = Object.keys(f).filter(k => FEATURE_AR[k] && f[k]).map(k => FEATURE_AR[k] + (typeof f[k] === 'string' && LEVEL_AR[f[k]] ? ` (${LEVEL_AR[f[k]]})` : ''));
      if (names.length) lines.push(names.join('، '));
    }
    if (f.support) lines.push('دعم فني ' + (LEVEL_AR[f.support] || 'متاح'));
    return lines;
  }

  function planCard(p, s, featured) {
    const current = p.id === s.planId;
    const isAnnual = cycle === 'ANNUAL';
    return h('div', { class: 'plan-card' + (featured ? ' featured' : '') + (current ? ' current' : '') },
      featured ? h('span', { class: 'plan-ribbon' }, icon('star', 14), 'الأكثر طلباً') : null,
      h('span', { class: 'plan-ic' }, icon(PLAN_ICON[p.code] || 'crown', 30)),
      h('h3', null, p.name),
      h('div', { class: 'plan-price' }, h('b', { class: 'ltr' }, fmtPrice(priceOf(p))), h('span', null, isAnnual ? '/ سنة' : '/ شهر')),
      h('ul', { class: 'plan-feats' }, featureLines(p).map(t => h('li', null, icon('check', 18), h('span', null, t)))),
      h('button', { class: 'plan-btn', onclick: () => request(p) }, current ? [icon('refresh', 18), 'تجديد'] : [icon('card', 18), 'اشترك / غيّر الباقة']));
  }

  function paymentsSection(s) {
    const head = h('h3', null, icon('doc', 22), 'سجل المدفوعات');
    if (!s.payments || !s.payments.length) {
      return h('div', { class: 'sect pay-sect' }, head,
        h('div', { class: 'pay-empty' }, icon('doc', 80), h('strong', null, 'لا توجد معاملات حالياً'), h('small', null, 'ستظهر معاملاتك هنا بعد الاشتراك')));
    }
    return h('div', { class: 'sect pay-sect' }, head, h('div', { class: 'tbl-card' }, dataTable([
      { label: 'التاريخ', render: p => h('span', { class: 'ltr' }, dateOnly(p.createdAt) + ' ' + timeOnly(p.createdAt)) },
      { label: 'المبلغ', render: p => h('span', { class: 'ltr' }, fmtPrice(p.amount)) },
      { label: 'الطريقة', key: 'method' },
      { label: 'المرجع', render: p => p.reference || '-' },
      { label: 'الحالة', render: p => chip(PS[p.status] || p.status, p.status === 'VERIFIED' ? 'ok' : p.status === 'REJECTED' ? 'err' : 'warn', 'dot') },
      { label: '', render: p => p.status === 'VERIFIED' ? h('button', { class: 'btn detail', onclick: () => invoice(p.id) }, icon('doc', 16), 'فاتورة') : '' }
    ], s.payments, 'لا مدفوعات', 'rt')));
  }

  function render() {
    const d = data, s = d.subscription;
    clear(body);
    const left = Math.ceil((new Date(s.expiresAt) - Date.now()) / 864e5);
    const expired = left < 0;
    const curPlan = d.plans.find(p => p.id === s.planId) || s.plan;
    const planName = h('span', null, s.plan.name, s.status !== 'ACTIVE' ? h('span', { style: 'margin-inline-start:8px;font-size:.9rem;vertical-align:middle' }, chip(SS[s.status] || s.status, s.status === 'EXPIRED' || s.status === 'CANCELLED' ? 'err' : 'warn')) : null);
    const renewBtn = h('button', { type: 'button', class: 'st-link', onclick: () => request(curPlan) }, icon('refresh', 15), 'تجديد');
    const expSub = h('span', { class: expired ? 'bad' : 'good' }, icon('clock', 15), expired ? `منتهي منذ ${-left} يوم (سماح ${d.graceDays} أيام للمدفوع)` : `تبقى ${left} يوم`);
    const expVal = h('span', { class: 'exp-val' }, h('span', { class: 'ltr' }, dateOnly(s.expiresAt)), h('span', { class: 'exp-sep' }, '-'), h('span', { class: 'ltr' }, timeOnly(s.expiresAt)));

    const stats = h('div', { class: 'stats sub' },
      statCard('orange', 'crown', 'الباقة الحالية', planName, renewBtn),
      statCard('blue', 'calendar', 'تاريخ الانتهاء', expVal, expSub),
      statCard('green', 'store', 'الفروع', `${d.usage.branches} / ${s.plan.maxBranches}`),
      statCard('indigo', 'users', 'الموظفون', `${d.usage.employees} / ${s.plan.maxEmployees}`));

    const cycleBar = h('div', { class: 'filters' }, h('div', { class: 'grp' },
      selectPill('calendar', [['MONTHLY', 'شهري'], ['ANNUAL', 'سنوي']], cycle, c => { cycle = c; render(); })));

    const featuredId = d.plans.length > 1 ? d.plans[d.plans.length - 1].id : null;
    const plans = h('div', { class: 'plans' }, d.plans.map(p => planCard(p, s, p.id === featuredId)));

    body.append(stats, cycleBar, plans, paymentsSection(s));
  }

  async function load() {
    clear(body); body.append(loading());
    try { data = await API.get('/subscription'); render(); }
    catch (e) { clear(body); body.append(h('div', { class: 'card empty' }, e.message)); }
  }

  const request = p => formModal({
    title: `طلب اشتراك: ${p.name}`, values: { method: 'تحويل/إنستاباي' },
    fields: [
      { name: 'method', label: 'طريقة الدفع', required: true },
      { name: 'reference', label: 'رقم العملية / المرجع', required: true, hint: 'لن يُفعَّل الاشتراك إلا بعد تأكيد الدفع من إدارة المنصة.' }
    ],
    submitText: 'إرسال طلب الدفع',
    onSubmit: async d => { await API.post('/subscription/request', { planCode: p.code, cycle, ...d }); toast('تم إرسال الطلب وهو قيد المراجعة'); load(); }
  });

  async function invoice(id) {
    try {
      const i = await API.get('/subscription/invoice/' + id);
      modal('فاتورة ' + i.invoiceNo, h('div', null, h('p', null, 'التاريخ: ' + dt(i.date)), h('p', null, 'المطعم: ' + i.restaurant), h('p', null, `الباقة: ${i.plan} (${i.cycle === 'ANNUAL' ? 'سنوي' : 'شهري'})`), h('p', null, `المبلغ: ${Number(i.amount).toFixed(2)} ${i.currency}`), h('p', null, `الدفع: ${i.method} ${i.reference || ''}`), h('button', { class: 'btn', onclick: () => window.print() }, 'طباعة')));
    } catch (e) { fail(e); }
  }

  v.append(body); load();
})();
