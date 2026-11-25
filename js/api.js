const API = {
  token: () => localStorage.getItem('token'),
  async req(path, { method = 'GET', body, auth = true, blob = false } = {}) {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (auth && API.token()) headers.Authorization = 'Bearer ' + API.token();
    let r;
    try { r = await fetch(window.APP_CONFIG.API_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined }); }
    catch { throw new Error('تعذر الاتصال بالخادم'); }
    if (r.ok && blob) return r.blob();
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && auth) { localStorage.removeItem('token'); location.href = 'login.html'; }
    if (!r.ok) throw Object.assign(new Error(data.error || 'خطأ'), { status: r.status, code: data.code, data });
    return data;
  },
  get: (p, o) => API.req(p, o),
  post: (p, body, o) => API.req(p, { method: 'POST', body: body || {}, ...o }),
  patch: (p, body) => API.req(p, { method: 'PATCH', body }),
  put: (p, body) => API.req(p, { method: 'PUT', body }),
  del: p => API.req(p, { method: 'DELETE' })
};
const qs = o => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(o || {})) if (v !== undefined && v !== null && v !== '') p.set(k, v); const s = p.toString(); return s ? '?' + s : ''; };
