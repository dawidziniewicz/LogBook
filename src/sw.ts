/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
// aplikacja działa offline – każda nawigacja dostaje index.html z cache
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));
// kafelki mapy – raz obejrzane w porcie są dostępne na morzu bez zasięgu
registerRoute(
  ({ url }) => url.hostname === 'tile.openstreetmap.org' || url.hostname === 'tiles.openseamap.org',
  new CacheFirst({
    cacheName: 'map-tiles',
    plugins: [new ExpirationPlugin({ maxEntries: 4000, maxAgeSeconds: 60 * 24 * 3600, purgeOnQuotaError: true })],
  }),
);

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url: string = event.notification.data?.url ?? '/';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of all) {
        if ('focus' in c) {
          c.postMessage({ type: 'open', url });
          return (c as WindowClient).focus();
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
