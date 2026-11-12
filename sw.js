/* Garde l'appli en cache pour qu'elle marche sans réseau.
   Changer VERSION après chaque modification des fichiers. */
var VERSION = "japon-v5";
var FICHIERS = [
  "./",
  "index.html",
  "style.css",
  "countdown.js",
  "app.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FICHIERS); }));
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (cles) {
    return Promise.all(cles.filter(function (k) { return k !== VERSION; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function depuisLeCache(requete) {
  return caches.match(requete, { ignoreSearch: true });
}

/* Réseau d'abord (pour recevoir les mises à jour), cache sinon.
   Seules les réponses valides du site lui-même sont gardées : une page d'erreur
   (site supprimé, 404) ou la page de connexion d'un Wi-Fi public ne remplacent
   jamais l'appli en cache. */
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(function (r) {
      if (r.ok && r.type === "basic" && !r.redirected) {
        var copie = r.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copie); });
        return r;
      }
      return depuisLeCache(req).then(function (c) { return c || r; });
    }).catch(function () {
      return depuisLeCache(req);
    })
  );
});
