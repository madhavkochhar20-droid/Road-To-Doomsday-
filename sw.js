// CinePhobic service worker: makes the site installable and lets the app shell open even when offline.
// Strategy: pages and scripts are NETWORK-FIRST (a new deploy shows up right away, cache is only the fallback),
// images are stale-while-revalidate. Audio/video, Firebase, TMDB and anything cross-origin are never touched.
// To force every user to refresh the cache after a big change, bump VERSION.
const VERSION = "cinephobic-v1";
const SHELL = [
  "./", "index.html", "hero-audio.js", "manifest.webmanifest",
  "firebase-config.js", "tmdb-config.js",
  "assets/icons/icon-192.png", "assets/icons/icon-512.png",
  "assets/apple-touch-icon.png", "assets/favicon-32.png", "assets/throne-bg.jpg"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(new Request(u, {cache: "reload"})))))   // one missing file must not break install
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k.startsWith("cinephobic-")).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const put = (req, res) => { if(res && res.ok && res.type === "basic") caches.open(VERSION).then(c => c.put(req, res.clone())).catch(() => {}); return res; };

function networkFirst(req, fallbackUrl, timeoutMs){
  return new Promise(resolve => {
    let settled = false;
    const useCache = () => caches.match(req, {ignoreSearch: false}).then(r => r || (fallbackUrl && caches.match(fallbackUrl)));
    const timer = timeoutMs ? setTimeout(() => {          // slow network: show the cached copy instead of waiting
      useCache().then(r => { if(r && !settled){ settled = true; resolve(r); } });
    }, timeoutMs) : null;
    fetch(req).then(res => {
      clearTimeout(timer);
      put(req, res);
      if(!settled){ settled = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      useCache().then(r => { if(!settled){ settled = true; resolve(r || Response.error()); } });
    });
  });
}

function staleWhileRevalidate(req){
  return caches.match(req).then(hit => {
    const net = fetch(req).then(res => put(req, res)).catch(() => hit);
    return hit || net;
  });
}

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if(req.method !== "GET" || url.origin !== self.location.origin) return;           // Firebase, TMDB, fonts CDN etc: untouched
  if(url.pathname.startsWith("/__/")) return;                                       // Firebase auth helper paths
  if(req.headers.has("range") || req.destination === "audio" || req.destination === "video") return;   // media: always straight from the network

  if(req.mode === "navigate"){ e.respondWith(networkFirst(req, "index.html", 3500)); return; }
  if(/\.(js|css|webmanifest|json|html)$/i.test(url.pathname)){ e.respondWith(networkFirst(req, null, 0)); return; }
  if(req.destination === "image" || req.destination === "font"){ e.respondWith(staleWhileRevalidate(req)); return; }
});
