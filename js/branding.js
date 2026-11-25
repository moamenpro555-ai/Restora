// Applies a restaurant's branding (from the API) as CSS variables. Uses textContent only (no HTML injection).
function applyBranding(b) {
  if (!b) return;
  const s = document.documentElement.style;
  if (b.primary) s.setProperty('--primary', b.primary);
  if (b.secondary) s.setProperty('--secondary', b.secondary);
  if (b.accent) s.setProperty('--accent', b.accent);
}
