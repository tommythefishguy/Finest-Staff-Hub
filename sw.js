const CACHE='finest-staff-hub-v1';
const FILES=['./','./index.html','./style.css','./script.js','./manifest.json','./icon-192.png','./icon-512.png','./assets/finest-circle-logo.png','./assets/finest-main-bg.png','./assets/finest-wordmark.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
