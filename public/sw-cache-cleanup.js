/* global self, caches */
/* Remove the legacy API cache when an upgraded service worker activates. */
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete('vector-api-cache'));
});
