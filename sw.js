/* Public shell only. API responses, lecture audio, slides and answers are never cached. */
'use strict';
const ROOT_URL = new URL('./', self.registration.scope);
const CACHE_PREFIX = 'fukushu-shell-' + encodeURIComponent(ROOT_URL.pathname) + '-';
const CACHE_NAME = CACHE_PREFIX + '300b82b108e2c27931d8';
const PRECACHE = ["./", "./manifest.webmanifest", "./static/THIRD_PARTY_NOTICES.txt", "./static/app.css", "./static/chunks/chunk-3P3NBJ43.js", "./static/chunks/chunk-3P3NBJ43.js.LEGAL.txt", "./static/connection.js", "./static/effects-image.js", "./static/effects-image.js.LEGAL.txt", "./static/effects.css", "./static/effects.js", "./static/effects.js.LEGAL.txt", "./static/icons/icon-180.png", "./static/icons/icon-192.png", "./static/icons/icon-512.png", "./static/icons/icon.svg", "./static/install.css", "./static/lecture-search.css", "./static/lecture-search.js", "./static/mobile.css", "./static/mobile.js", "./static/search-playback.js", "./static/study-sync.js", "./static/telegram-web-app.js"];
const SHELL_URL = ROOT_URL.href;
const ASSET_URLS = new Set(PRECACHE.filter(path => path !== './').map(path => new URL(path, ROOT_URL).href));

self.addEventListener('install', event => {
  // Replace any still-cached legacy redirect at the stable root URL as well.
  const freshResources = PRECACHE.map(path => new Request(new URL(path, ROOT_URL).href, {cache: 'reload'}));
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(freshResources)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== ROOT_URL.origin || request.headers.has('Authorization')) return;
  // Discovery must always reach GitHub; a cached tunnel address would break reconnect.
  if (url.pathname.endsWith('/url.txt') || url.pathname.includes('/api/')) return;
  const navigation = request.mode === 'navigate' && (url.pathname === ROOT_URL.pathname || url.pathname === ROOT_URL.pathname + 'index.html');
  if (navigation) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, {cache: 'no-cache'});
        if (response.ok && (response.headers.get('Content-Type') || '').includes('text/html')) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(SHELL_URL, response.clone());
          return response;
        }
        const saved = await caches.match(SHELL_URL, { cacheName: CACHE_NAME });
        return saved || response;
      } catch (error) {
        const saved = await caches.match(SHELL_URL, { cacheName: CACHE_NAME });
        if (saved) return saved;
        throw error;
      }
    })());
    return;
  }
  // Exact build-time paths only; query strings are asset revision hints, never cache keys.
  url.search = '';
  url.hash = '';
  if (!ASSET_URLS.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      // A fresh navigation may already contain the next deployment's HTML while
      // this worker is still active. Revalidate scripts/styles to keep them in sync.
      const response = await fetch(request, {cache: 'no-cache'});
      if (response.ok && response.type === 'basic') {
        await cache.put(url.href, response.clone());
        return response;
      }
      const saved = await cache.match(url.href);
      return saved || response;
    } catch (error) {
      const saved = await cache.match(url.href);
      if (saved) return saved;
      throw error;
    }
  })());
});
