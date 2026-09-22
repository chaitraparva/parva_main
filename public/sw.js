// Parva Group Portal — service worker
// Bump this on every release so old caches get cleared out.
const CACHE_VERSION = 'parvar-realties-v1'

// Everything below is relative to the service worker's own scope (the
// folder it's registered from), not the domain root — so this same file
// works whether the app is hosted at the root of a domain or under a
// sub-path like /parva/ (e.g. GitHub Pages project sites).
const SCOPE = self.registration.scope
const APP_SHELL = [SCOPE, `${SCOPE}manifest.webmanifest`, `${SCOPE}icon-192.png`, `${SCOPE}icon-512.png`]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Navigations: try the network first so users always get the latest
  // build when online, fall back to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_VERSION).then((cache) => cache.put(SCOPE, copy))
          return response
        })
        .catch(() => caches.match(SCOPE)),
    )
    return
  }

  // Everything else (hashed JS/CSS/images): cache-first, then fill the
  // cache in the background from the network.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
