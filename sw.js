// ملف Service Worker أساسي لتلبية متطلبات Chrome
self.addEventListener("install", (e) => {
  console.log("SW Installed");
});

self.addEventListener("fetch", (e) => {
  // يمكن تركها فارغة حالياً للسماح بالتحميل العادي
});
