import { ROUTES } from "@/lib/constants/routes";
import { HTTP_STATUS } from "@/lib/http/status";
import { ERROR_PWA } from "@/lib/http/errors/pwa";


export const serviceWorker = String.raw`
const CACHE_PREFIX = "projekt-offline-";
const CACHE_NAME = CACHE_PREFIX + "v1";
const OFFLINE_URL = ${JSON.stringify(ROUTES.offline)};

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const response = await fetch(OFFLINE_URL, { cache: "reload" });
    if (!response.ok || response.redirected) {
      throw new Error(${JSON.stringify(ERROR_PWA.REGISTRATION_FAILED.message)});
    }

    const html = await response.text();
    const styles = [...html.matchAll(/<link\b[^>]*>/gi)]
      .filter(([tag]) => /rel="stylesheet"/.test(tag))
      .map(([tag]) => tag.match(/href="([^"]+)"/)?.[1])
      .filter(Boolean)
      .map((href) => new URL(href.replaceAll("&amp;", "&"), self.location.origin))
      .filter((url) => url.origin === self.location.origin);
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(styles.map((url) => new Request(url.href, { cache: "reload" })));
    // Nur statisches HTML anzeigen: keine Hydrierung einer fremden Seitenroute.
    const document = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
    await cache.put(OFFLINE_URL, new Response(document, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      const fallback = await cache.match(OFFLINE_URL);
      return fallback || new Response(null, { status: ${HTTP_STATUS.SERVICE_UNAVAILABLE} });
    }));
  } else if (request.destination === "style") {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return await cache.match(request) || Response.error();
    }));
  }
});
`;
