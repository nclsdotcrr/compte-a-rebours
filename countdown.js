/* Calcul du décompte, toujours en heure de Paris (Europe/Paris),
   quel que soit le fuseau réglé sur le téléphone. */
(function (global) {
  "use strict";

  var TZ = "Europe/Paris";
  var JOUR_MS = 86400000;

  var fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23"
  });

  /* Heure murale à Paris pour un instant donné. */
  function heureParis(instant) {
    var p = {};
    fmt.formatToParts(new Date(instant)).forEach(function (x) { p[x.type] = x.value; });
    return {
      y: +p.year, m: +p.month, d: +p.day,
      h: +p.hour % 24, min: +p.minute, s: +p.second
    };
  }

  /* "AAAA-MM-JJ" -> {y, m, d} ; null si invalide. */
  function lireDate(txt) {
    var r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(txt || "");
    if (!r) return null;
    var y = +r[1], m = +r[2], d = +r[3];
    var t = new Date(Date.UTC(y, m - 1, d));
    if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
    return { y: y, m: m, d: d };
  }

  /* "13:45" -> {h, min} ; null si vide ou invalide. */
  function lireHeure(txt) {
    var r = /^(\d{1,2}):(\d{2})$/.exec(txt || "");
    if (!r || +r[1] > 23 || +r[2] > 59) return null;
    return { h: +r[1], min: +r[2] };
  }

  /* Instant (ms) correspondant à une heure murale de Paris
     (gère l'heure d'été / d'hiver). */
  function instantParis(y, m, d, h, min) {
    var voulu = Date.UTC(y, m - 1, d, h, min);
    var t = voulu;
    for (var i = 0; i < 3; i++) {
      var w = heureParis(t);
      var vu = Date.UTC(w.y, w.m - 1, w.d, w.h, w.min, w.s);
      t += voulu - vu;
    }
    return t;
  }

  /* Résultat du décompte.
     jours : nombre de jours calendaires (à Paris) entre aujourd'hui et le départ.
       > 0 : avant le départ ; 0 : jour J ; < 0 : départ passé.
     reste : si une heure est donnée, millisecondes jusqu'au décollage (sinon null). */
  function calculer(dateTxt, heureTxt, maintenant) {
    var dep = lireDate(dateTxt);
    if (!dep) return null;
    var now = maintenant == null ? Date.now() : maintenant;
    var auj = heureParis(now);
    var jours = Math.round(
      (Date.UTC(dep.y, dep.m - 1, dep.d) - Date.UTC(auj.y, auj.m - 1, auj.d)) / JOUR_MS
    );
    var hr = lireHeure(heureTxt);
    var reste = null, envole = false;
    if (hr) {
      reste = instantParis(dep.y, dep.m, dep.d, hr.h, hr.min) - now;
      if (reste <= 0) { envole = true; reste = 0; }
    }
    return { jours: jours, reste: reste, envole: envole };
  }

  /* ms -> {j, h, m, s} */
  function decouper(ms) {
    var s = Math.floor(ms / 1000);
    return {
      j: Math.floor(s / 86400),
      h: Math.floor((s % 86400) / 3600),
      m: Math.floor((s % 3600) / 60),
      s: s % 60
    };
  }

  global.Countdown = {
    calculer: calculer,
    decouper: decouper,
    lireDate: lireDate,
    lireHeure: lireHeure,
    instantParis: instantParis,
    heureParis: heureParis
  };
})(typeof window !== "undefined" ? window : globalThis);
