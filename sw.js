/* Garde l'appli en cache pour qu'elle marche sans réseau.
   Après chaque modification des fichiers : changer VERSION ici ET le « ?v= »
   des trois liens de index.html (preparer-publication.sh vérifie les deux). */
var VERSION = "japon-v12";
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
  // « reload » : télécharge vraiment chaque fichier, sans reprendre une copie
  // gardée par le navigateur (sinon une ancienne version peut se glisser dedans).
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return c.addAll(FICHIERS.map(function (f) { return new Request(f, { cache: "reload" }); }));
  }));
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
    // « no-cache » : demande toujours au site si le fichier a changé
    // (réponse très légère quand il n'a pas changé).
    fetch(req.url, { cache: "no-cache" }).then(function (r) {
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
