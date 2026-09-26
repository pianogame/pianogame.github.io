const CACHE_NAME = 'piano-dream-stage-shell-v1';
const LEGACY_CACHE_PREFIX = 'piano-palette-shell-';
const CACHE_PREFIX = 'piano-dream-stage-shell-';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => (name.startsWith(LEGACY_CACHE_PREFIX) || name.startsWith(CACHE_PREFIX)) && name !== CACHE_NAME)
        .map((name) => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

function shouldRefresh(request) {
  return (
    request.mode === 'navigate' ||
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'manifest'
  );
}

function canonicalKey(request) {
  const url = new URL(request.url);
  url.search = '';
  return new Request(url.toString(), { method: 'GET' });
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const key = canonicalKey(request);

  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) {
      await cache.put(key, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(key);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (
    request.method !== 'GET' ||
    new URL(request.url).origin !== self.location.origin ||
    !shouldRefresh(request)
  ) {
    return;
  }

  event.respondWith(networkFirst(request));
});
