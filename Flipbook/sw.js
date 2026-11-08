// Flipbook service worker: makes the app load offline after the first visit.
// Bump VERSION whenever you change any file so users get the update.
const VERSION = 'flipbook-v19';
const APP_FILES = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'ai-engine.js',
  'ocr-engine.js',
  'manifest.webmanifest',
  'vendor/pdfjs/pdf.min.js',
  'vendor/pdfjs/pdf.worker.min.mjs',
  'fonts/inter-latin-wght-normal.woff2',
  'fonts/literata-latin-opsz-normal.woff2',
  'fonts/literata-latin-opsz-italic.woff2',
  'fonts/fraunces-latin-opsz-normal.woff2',
  'fonts/fraunces-latin-opsz-italic.woff2',
  'icons/favicon.svg',
  'icons/favicon-32.png',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', e => {
  // cache:'reload' matters. A bare addAll() reads through the browser's own HTTP cache, and
  // GitHub Pages serves these files with a ten-minute max-age — so a worker installing shortly
  // after a deploy precaches the OLD files under the NEW version name, and bumping VERSION
  // silently ships nothing. Forcing a network read makes a bump mean what it says.
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(APP_FILES.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin !== location.origin) return;

  // Pages: try the network first (so updates show up), fall back to cache offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      // only refresh the offline copy from a successful load of the app itself (never from a 404 or another page)
      const scope = new URL(self.registration.scope).pathname;
      if (res.ok && (url.pathname === scope || url.pathname === scope + 'index.html')) { const copy = res.clone(); caches.open(VERSION).then(c => c.put('index.html', copy)); }
      return res;
    }).catch(() => caches.match('index.html')));
    return;
  }

  // Everything else: cache first, then network
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  })));
});
