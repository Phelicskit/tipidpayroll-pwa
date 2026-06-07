// TipidPayroll service worker — offline-first PWA channel.
// Strategy: pre-cache the app shell on install; cache-first for same-origin
// GETs with background refresh (stale-while-revalidate). The payroll math is
// 100% client-side, so once cached the app is fully functional with zero
// signal — the PH job-site reality.
// Bump VERSION on every release (CI stamps it via the release script).
const VERSION = 'tipidpayroll-v0.1.1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(e.request);
      const refresh = fetch(e.request)
        .then((res) => {
          if (res && res.ok) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => undefined);
      // Navigation fallback: serve the shell when offline.
      if (cached) { void refresh; return cached; }
      const fresh = await refresh;
      if (fresh) return fresh;
      if (e.request.mode === 'navigate') {
        const shell = await cache.match('./index.html');
        if (shell) return shell;
      }
      return new Response('offline', { status: 503 });
    })
  );
});
