/* Service Worker المحدث */
const CACHE_NAME = "family-tree-v2";
// أضف فقط الملفات الموجودة فعلياً في مجلدك
const assets = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./logo.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assets);
    })
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request);
    })
  );
});
