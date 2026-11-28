// Backend URL (Render). For local development use http://localhost:4000/api and http://localhost:4000
window.APP_CONFIG = { API_URL: 'https://restora-api-59gg.onrender.com/api', SOCKET_URL: 'https://restora-api-59gg.onrender.com' };

// Wake the free-tier API + database as soon as any page opens, and keep them awake while a screen stays open.
(function () {
  const ping = () => { try { fetch(window.APP_CONFIG.API_URL + '/health?db=1', { cache: 'no-store' }).catch(() => {}); } catch (e) {} };
  ping(); setInterval(() => { if (!document.hidden) ping(); }, 4 * 60 * 1000);
})();
