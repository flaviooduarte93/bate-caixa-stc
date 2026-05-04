// ═══════════════════════════════════════════
// BATE CAIXA — Service Worker v2
// ═══════════════════════════════════════════
const CACHE = 'bate-caixa-v2'

const PRECACHE = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
]

// Domínios que nunca devem ser interceptados (sempre vão direto à rede)
const BYPASS = [
  'supabase.co',          // banco de dados e auth
  'api.cloudinary.com',   // upload de fotos
  'res.cloudinary.com',   // entrega de fotos
]

// ── INSTALL: cache essentials ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => {
      return Promise.allSettled(PRECACHE.map(url => c.add(url).catch(() => {})))
    }).then(() => self.skipWaiting())
  )
})

// ── ACTIVATE: clean old caches ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// ── FETCH ──
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // Deixar passar sem interceptar: métodos não-GET e domínios da lista BYPASS
  if (e.request.method !== 'GET') return
  if (BYPASS.some(domain => url.hostname.includes(domain))) return

  // Map tiles: cache-first (funcionam offline depois da primeira visita)
  if (
    url.hostname.includes('carto.com') ||
    url.hostname.includes('cartocdn.com') ||
    url.hostname.includes('tile.openstreetmap') ||
    url.hostname.includes('basemaps')
  ) {
    e.respondWith(
      caches.open(CACHE).then(async c => {
        const cached = await c.match(e.request)
        if (cached) return cached
        try {
          const resp = await fetch(e.request)
          if (resp.ok) c.put(e.request, resp.clone())
          return resp
        } catch {
          return cached || new Response('', { status: 503 })
        }
      })
    )
    return
  }

  // Tudo o mais: network-first, cache como fallback offline
  e.respondWith(
    fetch(e.request)
      .then(resp => {
        if (resp.ok) {
          const clone = resp.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return resp
      })
      .catch(() =>
        caches.match(e.request).then(r => r || new Response('Offline', { status: 503 }))
      )
  )
})
