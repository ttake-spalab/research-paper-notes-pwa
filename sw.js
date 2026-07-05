// Service worker for the PaperShelf PWA.
// Caches the app shell for offline use. GitHub API responses are never cached
// (they must stay fresh); only same-origin static assets and the DOMPurify CDN
// script are handled here.
"use strict";

const CACHE = "papershelf-v1";
const DOMPURIFY = "https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.5/purify.min.js";
const CORE = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // DOMPurify is cross-origin; cache it best-effort so it isn't fatal if
      // the CDN can't be reached at install time.
      .then((c) => Promise.all([c.addAll(CORE), c.add(DOMPURIFY).catch(() => {})]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  // Let cross-origin requests (api.github.com etc.) pass straight through,
  // except the DOMPurify script which we deliberately cache.
  if (!sameOrigin && req.url !== DOMPURIFY) return;

  if (req.mode === "navigate") {
    // Network-first for the document so a redeploy is picked up immediately;
    // fall back to the cached shell when offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Cache-first for static assets (icons, manifest, DOMPurify).
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
