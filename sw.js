// Service Worker مطور لضمان تفعيل ميزة PWA
const CACHE_NAME = "family-tree-v1";
const assets = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./logo.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(assets)));
});

self.addEventListener("fetch", (e) => {
  e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request)));
});
