/* Societee service worker — offline on the course.
 *
 * Golf courses have terrible signal, so the app shell must keep working with
 * none: static assets are cache-first (hashed filenames never go stale), pages
 * are network-first with the cache as fallback. Nothing clever, deliberately —
 * a stale-while-offline shell beats a white screen at the 14th tee.
 */
const CACHE = "societee-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  const isStatic =
    url.pathname.includes("/_next/static/") ||
    /\.(png|ico|svg|woff2?)$/.test(url.pathname);

  if (isStatic) {
    e.respondWith(
      caches.open(CACHE).then(async (c) => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res.ok) c.put(e.request, res.clone());
        return res;
      })
    );
  } else {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(async () => {
          const hit = await caches.match(e.request);
          return hit ?? caches.match(new URL("./", url).pathname);
        })
    );
  }
});
