function requireLogin() { if (!localStorage.getItem('token')) location.href = 'login.html'; }
function logout() { localStorage.removeItem('token'); location.href = 'login.html'; }
async function doLogin(e) {
  e.preventDefault();
  try {
    const r = await API.post('/auth/login', { email: e.target.email.value, password: e.target.password.value }, { auth: false });
    localStorage.setItem('token', r.token);
    location.href = r.kind === 'PLATFORM_ADMIN' ? 'admin.html' : 'dashboard.html';
  } catch (err) { fail(err); }
}
async function doRegister(e) {
  e.preventDefault();
  const f = e.target;
  try {
    const r = await API.post('/auth/register', { restaurantName: f.restaurantName.value, slug: f.slug.value.trim() || undefined, businessType: f.businessType.value,
      ownerName: f.ownerName.value, email: f.email.value, password: f.password.value }, { auth: false });
    localStorage.setItem('token', r.token);
    location.href = 'dashboard.html';
  } catch (err) { fail(err); }
}
