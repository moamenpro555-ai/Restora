(async () => {
  const P = new URLSearchParams(location.search); const slug = P.get('restaurant'); const table = P.get('table'); const qrBranch = P.get('branch'); const trackId = P.get('track');
  const root = document.getElementById('root'); clear(root);
  if (!slug) { root.append(h('div', { class: 'empty' }, 'رابط غير صحيح')); return; }
  let data;
  try { data = await API.get(`/public/${encodeURIComponent(slug)}/menu`, { auth: false }); } catch (e) { root.append(h('div', { class: 'empty' }, e.message)); return; }
  const R = data.restaurant, br = R.branding || {}, mods = R.modules;
  applyBranding(br); document.title = R.name;
  if (br.fontFamily) document.documentElement.style.setProperty('--font', `'${br.fontFamily}','Cairo',system-ui,sans-serif`);
  const fmt = n => ('\u2066' + Number(n || 0).toLocaleString('ar-EG-u-nu-latn', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + R.currency + '\u2069');
  const KEY = 'cart:' + slug;
  let cart = []; try { cart = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch {} };
  const canOrder = table ? mods.qrOrdering : mods.online;
  const unit = l => l.price + l.options.reduce((s, o) => s + o.price, 0);
  const sub = () => cart.reduce((s, l) => s + unit(l) * l.qty, 0);

  // Order tracking view
  if (trackId) {
    const box = h('div', { class: 'card', style: 'max-width:480px;margin:24px auto;text-align:center' });
    root.append(h('div', { class: 'container' }, h('h2', { style: 'text-align:center' }, R.name), box));
    const flow = ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'];
    const poll = async () => {
      try { const o = await API.get(`/public/${encodeURIComponent(slug)}/orders/${encodeURIComponent(trackId)}`, { auth: false }); clear(box);
        box.append(h('h3', null, `طلب #${o.number}`), h('div', { class: 'steps' }, flow.map(s => h('span', { class: flow.indexOf(s) <= flow.indexOf(o.status) && o.status !== 'CANCELLED' ? 'on' : '' }, AR.status[s]))),
          h('p', null, o.status === 'CANCELLED' ? 'تم إلغاء الطلب' : AR.status[o.status]), h('strong', null, fmt(o.total)), h('p', { class: 'muted' }, 'يتحدث تلقائيًا'),
          h('a', { class: 'btn secondary', href: `menu.html?restaurant=${encodeURIComponent(slug)}` }, 'العودة للمنيو'));
        if (!['COMPLETED', 'CANCELLED'].includes(o.status)) setTimeout(poll, 10000);
      } catch (e) { clear(box); box.append(h('div', { class: 'empty' }, e.message)); }
    };
    poll(); return;
  }

  const q = h('input', { placeholder: 'ابحث في المنيو...', oninput: () => drawMenu() }); const menuBox = h('div'); const nav = h('div', { class: 'catnav' }); const fab = h('button', { class: 'btn cart-fab', onclick: openCart });
  function drawFab() { clear(fab); fab.style.display = cart.length && canOrder ? 'flex' : 'none'; fab.append(h('span', null, `🛒 السلة (${cart.reduce((s, l) => s + l.qty, 0)})`), h('strong', null, fmt(sub()))); }
  function drawMenu() {
    clear(menuBox); clear(nav); const term = q.value.trim();
    for (const c of data.categories) {
      const items = c.products.filter(p => !term || p.name.includes(term) || (p.description || '').includes(term)); if (!items.length) continue;
      nav.append(h('a', { href: '#c-' + c.id }, c.name));
      menuBox.append(h('h2', { id: 'c-' + c.id }, c.name), h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(280px,1fr))' }, items.map(p => h('div', { class: 'card mitem', style: p.isAvailable ? '' : 'opacity:.5', onclick: () => p.isAvailable && canOrder && pick(p) },
        p.imageUrl ? h('img', { src: p.imageUrl, alt: '' }) : null, h('div', null, h('strong', null, p.name), p.description ? h('div', { class: 'muted' }, p.description) : null, h('div', { class: 'price' }, fmt(p.price)), p.isAvailable ? null : h('small', null, 'غير متاح'))))));
    }
    if (!menuBox.children.length) menuBox.append(h('div', { class: 'empty' }, 'لا توجد نتائج'));
  }
  function add(p, options) { const l = { productId: p.id, name: p.name, price: Number(p.price), options, qty: 1 }; const k = x => x.productId + JSON.stringify(x.options); const ex = cart.find(x => k(x) === k(l)); if (ex) ex.qty++; else cart.push(l); save(); drawFab(); toast('أُضيف إلى السلة'); }
  function pick(p) {
    const groups = Array.isArray(p.options) ? p.options : []; if (!groups.length) return add(p, []);
    const sel = {};
    const m = modal(p.name, h('div', null, groups.map(g => h('div', null, h('strong', null, g.name + (g.required ? ' *' : '')), g.choices.map(c => h('label', { style: 'display:block' }, h('input', { type: g.multi ? 'checkbox' : 'radio', name: 'g-' + g.name, onchange: e => { sel[g.name] = sel[g.name] || []; if (g.multi) { sel[g.name] = e.target.checked ? [...sel[g.name], c] : sel[g.name].filter(x => x !== c); } else sel[g.name] = [c]; } }), `${c.name} ${c.price ? '(+' + c.price + ')' : ''}`)))),
      h('button', { class: 'btn', onclick: () => { for (const g of groups) if (g.required && !(sel[g.name] || []).length) return toast('اختر ' + g.name, true); m.close(); add(p, groups.flatMap(g => (sel[g.name] || []).map(c => ({ group: g.name, choice: c.name, price: Number(c.price || 0) })))); } }, 'أضف للسلة')));
  }
  function openCart() {
    const branches = R.branches || [];
    const st = { type: table ? 'DINE_IN' : 'TAKEAWAY', name: '', phone: '', addr: '', notes: '', zoneId: '', sched: '', branchId: qrBranch || (branches[0] && branches[0].id) || '' };
    const zones = R.zones || [];
    const box = h('div'), fee = () => { const z = zones.find(x => x.id === st.zoneId); return st.type === 'DELIVERY' ? (z ? Number(z.fee) : mods.deliveryFee) : 0; };
    const draw = () => {
      clear(box);
      cart.forEach((l, i) => box.append(h('div', { class: 'cart-line' }, h('div', null, h('strong', null, l.name), l.options.length ? h('div', { class: 'muted' }, l.options.map(o => o.choice).join('، ')) : null, h('small', { class: 'price' }, fmt(unit(l) * l.qty))),
        h('div', { class: 'qty' }, h('button', { onclick: () => { l.qty--; if (l.qty < 1) cart.splice(i, 1); save(); drawFab(); cart.length ? draw() : m.close(); } }, '−'), h('span', null, l.qty), h('button', { onclick: () => { l.qty++; save(); drawFab(); draw(); } }, '+')))));
      const s = sub(), tax = s * mods.taxRate / 100;
      box.append(!table && branches.length > 1 ? h('div', null, h('label', null, 'الفرع'), h('select', { onchange: e => { st.branchId = e.target.value; } }, branches.map(b => h('option', { value: b.id, selected: b.id === st.branchId }, b.name + (b.address ? ' - ' + b.address : ''))))) : null,
        table ? h('p', { class: 'badge info' }, 'طاولة ' + table) : h('select', { onchange: e => { st.type = e.target.value; draw(); } }, h('option', { value: 'TAKEAWAY', selected: st.type === 'TAKEAWAY' }, 'استلام من المطعم'), mods.delivery ? h('option', { value: 'DELIVERY', selected: st.type === 'DELIVERY' }, 'توصيل') : null),
        h('input', { placeholder: 'الاسم', value: st.name, oninput: e => { st.name = e.target.value; } }), h('input', { placeholder: 'رقم الهاتف', type: 'tel', value: st.phone, oninput: e => { st.phone = e.target.value; } }),
        st.type === 'DELIVERY' ? h('input', { placeholder: 'عنوان التوصيل', value: st.addr, oninput: e => { st.addr = e.target.value; } }) : null,
        st.type === 'DELIVERY' && zones.length ? h('select', { onchange: e => { st.zoneId = e.target.value; draw(); } }, h('option', { value: '' }, 'اختر منطقة التوصيل'), zones.map(z => h('option', { value: z.id, selected: z.id === st.zoneId }, `${z.name} - ${fmt(z.fee)}`))) : null,
        st.type !== 'DINE_IN' ? h('div', null, h('label', null, 'جدولة الطلب لوقت لاحق (اختياري)'), h('input', { type: 'datetime-local', value: st.sched, onchange: e => { st.sched = e.target.value; } })) : null, h('input', { placeholder: 'ملاحظات (اختياري)', value: st.notes, oninput: e => { st.notes = e.target.value; } }),
        h('div', { class: 'totals' }, h('div', null, h('span', null, 'المجموع'), h('span', null, fmt(s))), tax ? h('div', null, h('span', null, 'ضريبة'), h('span', null, fmt(tax))) : null, fee() ? h('div', null, h('span', null, 'توصيل'), h('span', null, fmt(fee()))) : null, h('div', { class: 't' }, h('span', null, 'الإجمالي'), h('span', null, fmt(s + tax + fee()))),
          mods.minOrder && st.type !== 'DINE_IN' ? h('small', { class: 'muted' }, 'الحد الأدنى للطلب ' + fmt(mods.minOrder)) : null),
        h('p', { class: 'muted' }, 'الدفع عند الاستلام/في المطعم.'), h('button', { class: 'btn', style: 'width:100%', onclick: send }, 'تأكيد الطلب'));
    };
    async function send() {
      if (st.name.trim().length < 2 || st.phone.trim().length < 7) return toast('اكتب الاسم ورقم الهاتف', true);
      if (st.type === 'DELIVERY' && !st.addr.trim()) return toast('اكتب العنوان', true);
      if (st.type === 'DELIVERY' && zones.length && !st.zoneId) return toast('اختر منطقة التوصيل', true);
      try {
        const o = await API.post(`/public/${encodeURIComponent(slug)}/orders`, { type: st.type, customerName: st.name.trim(), customerPhone: st.phone.trim(), deliveryAddress: st.addr.trim() || undefined, notes: st.notes.trim() || undefined, tableNumber: table || undefined, branchId: st.branchId || undefined, zoneId: st.zoneId || undefined, scheduledFor: st.sched ? new Date(st.sched).toISOString() : undefined,
          items: cart.map(l => ({ productId: l.productId, quantity: l.qty, options: l.options.map(x => ({ group: x.group, choice: x.choice })) })) }, { auth: false });
        cart = []; save(); drawFab(); m.close();
        modal('تم استلام طلبك ✅', h('div', null, h('p', null, `رقم الطلب #${o.number} — الإجمالي ${fmt(o.total)}`), h('a', { class: 'btn', href: `menu.html?restaurant=${encodeURIComponent(slug)}&track=${encodeURIComponent(o.id)}` }, 'تتبّع الطلب')));
      } catch (e) { fail(e); }
    }
    const m = modal('سلة الطلب', box); draw();
  }
  const socials = Object.entries(br.social || {}).map(([k, u]) => h('a', { href: u, target: '_blank', rel: 'noopener noreferrer' }, k));
  root.append((() => { const hero = h('div', { class: 'hero' }); if (br.coverUrl) hero.style.backgroundImage = 'url(' + JSON.stringify(br.coverUrl) + ')'; return hero; })(),
    h('div', { class: 'container' }, h('div', { class: 'rest-head' }, br.logoUrl ? h('img', { class: 'logo', src: br.logoUrl, alt: '' }) : null, h('div', null, h('h1', { style: 'margin:0' }, R.name), br.openingHours && br.openingHours.text ? h('div', { class: 'muted' }, '🕒 ' + br.openingHours.text) : null, br.phone ? h('div', { class: 'muted' }, '📞 ' + br.phone) : null, br.address ? h('div', { class: 'muted' }, '📍 ' + br.address) : null)),
      h('div', { class: 'row', style: 'margin-top:8px' }, socials), table ? h('p', { class: 'badge info' }, 'أنت تطلب من طاولة ' + table) : null,
      R.isOpen === false && !table ? h('div', { class: 'banner', style: 'border-radius:10px;margin-top:10px' }, 'المطعم مغلق حاليًا — يمكنك جدولة طلب لوقت لاحق أثناء مواعيد العمل') : null,
      canOrder ? null : h('div', { class: 'banner', style: 'border-radius:10px;margin-top:10px' }, 'الطلب عبر الإنترنت غير متاح حاليًا — المنيو للعرض فقط'),
      h('div', { style: 'margin-top:12px' }, q), nav, menuBox, h('div', { style: 'height:90px' })), fab);
  drawMenu(); drawFab();
})();
