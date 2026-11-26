(async () => {
  const v = await boot('الإعدادات والهوية', 'settings.manage', { support: true, foot: { text: '© 2025 Restora. جميع الحقوق محفوظة', icon: 'heart', side: 'معاً .. لننجح أكثر' } }); if (!v) return;
  const sbox = document.getElementById('bar-slot');
  if (sbox) sbox.append(h('label', { class: 'searchbox' }, h('input', { type: 'search', placeholder: 'ابحث في الإعدادات ...', oninput: e => { const t = e.target.value.trim(); document.querySelectorAll('.acc').forEach(a => { a.hidden = !!t && !a.textContent.includes(t); }); } }), icon('search', 20)));
  const acc = (ic, title, sub, kids, open) => {
    const el = h('section', { class: 'acc' + (open ? ' open' : '') },
      h('button', { type: 'button', class: 'acc-head', onclick: () => el.classList.toggle('open') }, h('span', { class: 'acc-ic' }, icon(ic, 28)), h('span', { class: 'acc-t' }, h('strong', null, title), h('small', null, sub)), icon('chevron', 20)),
      h('div', { class: 'acc-body' }, kids));
    return el;
  };
  let b, g;
  try { [b, g] = await Promise.all([API.get('/settings/branding'), API.get('/settings/general')]); } catch (e) { v.append(h('div', { class: 'card empty' }, e.message)); return; }
  const m = g.modules || {}; const soc = b.social || {};
  const live = (k, val) => applyBranding({ [k]: val });
  const brandForm = h('form', { class: 'card two', onsubmit: async e => {
    e.preventDefault(); const f = e.target; const val = n => f[n].value.trim();
    const social = {}; ['instagram', 'facebook', 'whatsapp'].forEach(k => { if (val(k)) social[k] = val(k); });
    try { await API.put('/settings/branding', { primary: val('primary'), secondary: val('secondary'), accent: val('accent'), fontFamily: val('fontFamily'), logoUrl: val('logoUrl') || null, coverUrl: val('coverUrl') || null,
      phone: val('phone') || null, address: val('address') || null, receiptFooter: val('receiptFooter') || null, social, openingHours: { text: val('hours'), ...(val('open') ? { open: val('open') } : {}), ...(val('close') ? { close: val('close') } : {}) } }); toast('تم حفظ الهوية'); } catch (err) { fail(err); }
  } },
    h('h3', { style: 'grid-column:1/-1' }, 'هوية المطعم'),
    ...[['primary', 'اللون الأساسي'], ['secondary', 'اللون الثانوي'], ['accent', 'لون التمييز']].map(([k, l]) => h('div', null, h('label', null, l), h('input', { name: k, type: 'color', value: b[k], oninput: e => live(k, e.target.value) }))),
    h('div', null, h('label', null, 'الخط'), h('select', { name: 'fontFamily' }, ['Cairo', 'Tajawal'].map(x => h('option', { selected: x === b.fontFamily }, x)))),
    h('div', null, h('label', null, 'شعار المطعم (من جهازك)'), imageUploader('logoUrl', b.logoUrl)), h('div', null, h('label', null, 'صورة الغلاف (من جهازك)'), imageUploader('coverUrl', b.coverUrl)),
    h('div', null, h('label', null, 'الهاتف'), h('input', { name: 'phone', value: b.phone || '' })), h('div', null, h('label', null, 'العنوان'), h('input', { name: 'address', value: b.address || '' })),
    h('div', null, h('label', null, 'مواعيد العمل (نص)'), h('input', { name: 'hours', value: (b.openingHours && b.openingHours.text) || '' })), h('div', null, h('label', null, 'يفتح (ساعة)'), h('input', { name: 'open', type: 'time', value: (b.openingHours && b.openingHours.open) || '' })), h('div', null, h('label', null, 'يغلق (ساعة) — فارغان = مفتوح دائمًا'), h('input', { name: 'close', type: 'time', value: (b.openingHours && b.openingHours.close) || '' })),
    h('div', null, h('label', null, 'تذييل الإيصال'), h('input', { name: 'receiptFooter', value: b.receiptFooter || '' })),
    ...['instagram', 'facebook', 'whatsapp'].map(k => h('div', null, h('label', null, k + ' (رابط)'), h('input', { name: k, value: soc[k] || '' }))),
    h('button', { class: 'btn', style: 'grid-column:1/-1' }, 'حفظ الهوية'));
  const chk = (n, l, d = true) => h('label', { style: 'display:block' }, h('input', { type: 'checkbox', name: n, checked: m[n] !== undefined ? m[n] : d }), l);
  const genForm = h('form', { class: 'card two', onsubmit: async e => {
    e.preventDefault(); const f = e.target; const c = n => f[n].checked; const nu = n => Number(f[n].value || 0);
    try { await API.put('/settings/general', { name: f.name.value, slug: f.slug.value, currency: f.currency.value.toUpperCase(),
      modules: { tables: c('tables'), delivery: c('delivery'), online: c('online'), qrOrdering: c('qrOrdering'), reservations: c('reservations'), preventNegativeStock: c('preventNegativeStock'),
        taxRate: nu('taxRate'), deliveryFee: nu('deliveryFee'), minOrder: nu('minOrder'), loyaltyRate: nu('loyaltyRate'), deductOn: f.deductOn.value, timezone: f.timezone.value || 'Africa/Cairo' } }); toast('تم الحفظ'); setTimeout(() => location.reload(), 600); } catch (err) { fail(err); }
  } },
    h('h3', { style: 'grid-column:1/-1' }, 'العملة والضريبة والتشغيل'),
    h('div', null, h('label', null, 'اسم المطعم'), h('input', { name: 'name', value: g.name })), h('div', null, h('label', null, 'المعرّف في الرابط (slug)'), h('input', { name: 'slug', value: g.slug, pattern: '[a-z0-9-]{3,40}' })),
    h('div', null, h('label', null, 'العملة (3 أحرف)'), h('input', { name: 'currency', value: g.currency, maxlength: 3 })), h('div', null, h('label', null, 'ضريبة % '), h('input', { name: 'taxRate', type: 'number', step: '0.01', value: m.taxRate || 0 })),
    h('div', null, h('label', null, 'رسوم التوصيل'), h('input', { name: 'deliveryFee', type: 'number', step: '0.01', value: m.deliveryFee || 0 })), h('div', null, h('label', null, 'الحد الأدنى للطلب أونلاين'), h('input', { name: 'minOrder', type: 'number', step: '0.01', value: m.minOrder || 0 })),
    h('div', null, h('label', null, 'نقاط الولاء: كل كم جنيه = نقطة (0 = معطّل)'), h('input', { name: 'loyaltyRate', type: 'number', min: '0', value: m.loyaltyRate || 0 })),
    h('div', null, h('label', null, 'المنطقة الزمنية (لمواعيد العمل)'), h('input', { name: 'timezone', value: m.timezone || 'Africa/Cairo' })),
    h('div', null, h('label', null, 'خصم المخزون عند'), h('select', { name: 'deductOn' }, [['CONFIRMED', 'تأكيد الطلب'], ['PREPARING', 'بدء التحضير'], ['COMPLETED', 'اكتمال الطلب']].map(([k, n]) => h('option', { value: k, selected: (m.deductOn || 'COMPLETED') === k }, n)))),
    h('div', { style: 'grid-column:1/-1' }, chk('tables', 'إدارة الطاولات', false), chk('delivery', 'التوصيل'), chk('online', 'الطلب أونلاين (استلام/توصيل)'), chk('qrOrdering', 'الطلب عبر QR من الطاولة'), chk('reservations', 'الحجوزات', false), chk('preventNegativeStock', 'منع المخزون السالب (يرفض إتمام الطلب)', false)),
    h('button', { class: 'btn', style: 'grid-column:1/-1' }, 'حفظ الإعدادات'));
  const link = location.href.replace(/[^/]*$/, '') + 'menu.html?restaurant=' + encodeURIComponent(g.slug); const qrBox = h('div');
  const pw = h('form', { class: 'card', onsubmit: async e => { e.preventDefault(); try { await API.post('/auth/change-password', { current: e.target.cur.value, next: e.target.nxt.value }); toast('تم تغيير كلمة المرور'); e.target.reset(); } catch (err) { fail(err); } } },
    h('h3', null, 'تغيير كلمة المرور'), h('input', { name: 'cur', type: 'password', placeholder: 'الحالية', required: true }), h('input', { name: 'nxt', type: 'password', placeholder: 'الجديدة (8+)', minlength: 8, required: true }), h('button', { class: 'btn' }, 'تغيير'));
  const zbox = h('div');
  async function loadZones() {
    clear(zbox);
    try {
      const rows = await API.get('/delivery-zones');
      zbox.append(dataTable([{ label: 'المنطقة', key: 'name' }, { label: 'الرسوم', render: z => money(z.fee) }, { label: 'حد أدنى', render: z => money(z.minOrder) }, { label: 'نشطة', render: z => z.isActive ? 'نعم' : 'لا' },
        { label: '', render: z => h('div', { class: 'row' }, h('button', { class: 'btn sm secondary', onclick: () => zform(z) }, 'تعديل'), h('button', { class: 'btn sm danger', onclick: async () => { if (await confirmBox('حذف المنطقة؟')) { await API.del('/delivery-zones/' + z.id).catch(fail); loadZones(); } } }, 'حذف')) }], rows, 'لا مناطق: تُستخدم رسوم التوصيل الافتراضية'));
    } catch (e) { zbox.append(h('div', { class: 'empty' }, e.message)); }
  }
  const zform = z => formModal({ title: z ? 'تعديل منطقة' : 'منطقة توصيل', values: z || { isActive: true, minOrder: 0 }, fields: [{ name: 'name', label: 'الاسم', required: true }, { name: 'fee', label: 'رسوم التوصيل', type: 'number', step: '0.01', required: true }, { name: 'minOrder', label: 'الحد الأدنى للطلب', type: 'number', step: '0.01' }, { name: 'isActive', label: 'نشطة', type: 'checkbox' }],
    onSubmit: async d => { if (z) await API.patch('/delivery-zones/' + z.id, d); else await API.post('/delivery-zones', d); loadZones(); } });
  const zonesCard = h('div', { class: 'card' }, h('h3', null, 'مناطق التوصيل'), h('button', { class: 'btn sm', onclick: () => zform() }, '+ منطقة'), zbox);
  loadZones();
  const linkCard = h('div', { class: 'card' }, h('h3', null, 'رابط المنيو وQR'), h('a', { href: link, target: '_blank' }, link), qrBox, h('p', { class: 'muted' }, 'GitHub Pages لا يدعم دومينًا مستقلًا لكل مطعم؛ راجع docs في الدليل للدومينات المخصصة.'));
  const go = (href, t) => h('a', { class: 'btn', href }, t);
  v.append(h('div', { class: 'set-panel' },
    h('div', { class: 'ph' }, h('div', null, h('h1', null, h('span', { class: 'ph-ico' }, icon('gear', 40)), 'الإعدادات العامة'), h('p', { class: 'muted' }, 'قم بتخصيص إعدادات منصتك بكل سهولة'))),
    h('div', { class: 'acc-grid' },
      acc('store', 'إعدادات المطاعم', 'إدارة بيانات المطاعم والفروع', [zonesCard, go('branches.html', 'إدارة الفروع')]),
      acc('shield', 'إعدادات الأمان', 'إدارة أمان حسابك وكلمات المرور', [pw]),
      acc('eye', 'إعدادات المظهر', 'تغيير شكل ومظهر المنصة', [brandForm]),
      acc('bell', 'إعدادات الإشعارات', 'تخصيص طريقة استلام الإشعارات', [h('button', { class: 'btn', type: 'button', onclick: showNotifs }, 'عرض الإشعارات')]),
      acc('card', 'إعدادات الفواتير والمدفوعات', 'إدارة فواتير العملاء وطرق الدفع', [genForm], true),
      acc('bars', 'إعدادات التقارير', 'تخصيص التقارير والإحصائيات', [go('reports.html', 'فتح التقارير')]),
      acc('filter', 'إعدادات متقدمة', 'خيارات متقدمة للمطورين', [linkCard]))));
  if (window.QRCode) new QRCode(qrBox, { text: link, width: 160, height: 160 });
})();
