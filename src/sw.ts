/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope & {__WB_MANIFEST:Array<{url:string;revision:string|null}>}
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('/kartvizit/index.html')))
registerRoute(({url})=>url.origin===self.location.origin && url.pathname.startsWith('/kartvizit/ocr/'),new CacheFirst({cacheName:'kartvizit-ocr-v1'}))
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING') void self.skipWaiting()})
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()))
