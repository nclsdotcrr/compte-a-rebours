(function () {
  "use strict";

  var VILLE = "Tokyo";
  var CLE = "compte-a-rebours-japon";
  var THEMES = { kawaii: "#ffd6e7", neon: "#12062b", cyberpunk: "#0b0b0f", washi: "#f7f0e1", ghibli: "#8fd0f5" };

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Réglages ----------
     Gardés uniquement sur le téléphone. Aucun prénom ni aucune date n'est écrit
     dans les fichiers publiés : au premier lancement, l'appli ouvre les Réglages. */
  function texte(v) { return typeof v === "string" ? v.trim().slice(0, 30) : ""; }

  function nettoyer(s) {
    var p = Array.isArray(s.prenoms) ? s.prenoms : [s.prenom, s.amie];
    return {
      date: Countdown.lireDate(s.date) ? s.date : "",
      heure: Countdown.lireHeure(s.heure) ? s.heure : "",
      prenoms: [texte(p[0]), texte(p[1])],
      theme: THEMES[s.theme] ? s.theme : "kawaii",
      provisoire: !!s.provisoire
    };
  }

  function chargerReglages() {
    var r = null;
    try {
      var s = JSON.parse(localStorage.getItem(CLE) || "null");
      if (s && typeof s === "object") r = nettoyer(s);
    } catch (e) { /* stockage indisponible */ }
    if (r) return r;

    // Facultatif : un lien peut préremplir les réglages à la toute première ouverture.
    // ?date=AAAA-MM-JJ&heure=HH:MM&prenoms=Prénom1,Prénom2&theme=neon&provisoire=1
    var q = new URLSearchParams(location.search);
    r = nettoyer({
      date: q.get("date"),
      heure: q.get("heure"),
      prenoms: (q.get("prenoms") || "").split(","),
      theme: q.get("theme"),
      provisoire: q.get("provisoire") === "1"
    });
    if (q.toString()) {
      sauverReglages(r);
      // Retire les paramètres de l'adresse (et donc de l'historique de la page).
      try { history.replaceState(null, "", location.pathname); } catch (e) {}
    }
    return r;
  }

  function sauverReglages(r) {
    try { localStorage.setItem(CLE, JSON.stringify(r)); } catch (e) { /* tant pis */ }
  }

  var reglages = chargerReglages();

  /* ---------- Thème ---------- */
  function appliquerTheme(t) {
    if (!THEMES[t]) t = "kawaii";
    document.documentElement.dataset.theme = t;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEMES[t]);
  }
  appliquerTheme(reglages.theme);

  /* ---------- Affichage ---------- */
  var fmtDate = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC"
  });

  function texteDate(r) {
    var d = Countdown.lireDate(r.date);
    var t = "Départ : " + fmtDate.format(new Date(Date.UTC(d.y, d.m - 1, d.d)));
    var h = Countdown.lireHeure(r.heure);
    if (h) t += " à " + h.h + " h " + String(h.min).padStart(2, "0") + " (heure de Paris)";
    if (r.provisoire) t += " · date provisoire";
    return t;
  }

  function deux(n) { return String(n).padStart(2, "0"); }

  /* Les deux prénoms sont à égalité : leur ordre s'inverse chaque jour. */
  function noms(r, jours) {
    var p = r.prenoms.filter(Boolean);
    if (p.length === 2 && Math.abs(jours) % 2 === 1) p = [p[1], p[0]];
    return p.join(" & ");
  }

  function afficher() {
    var res = Countdown.calculer(reglages.date, reglages.heure);
    var pastille = "東京まで ・ direction " + VILLE;
    var avant, nombre, unite, message, dateTxt;

    if (!res) {
      avant = "あと";
      nombre = "?";
      unite = "jours";
      message = "Touchez la roue ⚙︎ pour choisir la date du départ 🍣🥢";
      dateTxt = "";
    } else {
      var n = noms(reglages, res.jours);
      var virgule = n ? ", " + n : "";
      dateTxt = texteDate(reglages);
      if (res.jours > 1) {
        avant = "あと";
        nombre = String(res.jours);
        unite = "jours";
        message = (n ? n + " : plus" : "Plus") + " que " + res.jours + " jours avant " + VILLE + " ! 🍣🥢";
      } else if (res.jours === 1) {
        avant = "あと";
        nombre = "1";
        unite = "jour";
        message = "C'est demain" + virgule + " ! Dernière nuit avant " + VILLE + " 🌙";
      } else if (res.jours === 0) {
        avant = "今日！";
        nombre = "Jour J";
        unite = "";
        message = res.envole
          ? "Décollage ! Bon vol" + virgule + " 🍣🥢 いってらっしゃい"
          : "C'est aujourd'hui" + virgule + " ! いってらっしゃい 🍣🥢";
      } else {
        pastille = "東京で ・ à " + VILLE;
        avant = "東京で";
        nombre = String(-res.jours);
        unite = -res.jours > 1 ? "jours à " + VILLE : "jour à " + VILLE;
        message = "Bienvenue à " + VILLE + virgule + " ! ようこそ 🌸";
      }
    }

    $("pastille").textContent = pastille;
    $("avant").textContent = avant;
    $("nombre").textContent = nombre;
    $("nombre").classList.toggle("petit", nombre.length > 3);
    $("unite").textContent = unite;
    $("unite").hidden = !unite;
    $("message").textContent = message;
    $("date").textContent = dateTxt;
    $("date").hidden = !dateTxt;
    document.body.classList.toggle("jour-j", !!res && res.jours === 0);

    var montrerMinuteur = !!res && res.reste !== null && !res.envole && res.jours >= 0;
    $("minuteur").hidden = !montrerMinuteur;
    if (montrerMinuteur) {
      var c = Countdown.decouper(res.reste);
      $("mj").textContent = c.j;
      $("mh").textContent = deux(c.h);
      $("mm").textContent = deux(c.m);
      $("ms").textContent = deux(c.s);
    }
  }

  var minuterie = null;
  function relancer() {
    clearInterval(minuterie);
    afficher();
    // Chaque seconde si l'heure du vol est connue, sinon toutes les 30 s (passage de minuit).
    minuterie = setInterval(afficher, reglages.heure ? 1000 : 30000);
  }
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) afficher();
  });

  /* ---------- Fenêtre de réglages ---------- */
  var dlg = $("dialogue");
  function ouvrirReglages() {
    $("prenom1").value = reglages.prenoms[0];
    $("prenom2").value = reglages.prenoms[1];
    $("champ-date").value = reglages.date;
    $("champ-heure").value = reglages.heure;
    $("provisoire").checked = reglages.provisoire;
    var radio = document.querySelector('input[name="theme"][value="' + reglages.theme + '"]');
    if (radio) radio.checked = true;
    dlg.showModal();
  }
  $("ouvrir").addEventListener("click", ouvrirReglages);
  // Aperçu immédiat quand on touche un thème ; « Annuler » revient au thème enregistré.
  document.querySelectorAll('input[name="theme"]').forEach(function (r) {
    r.addEventListener("change", function () { appliquerTheme(r.value); });
  });
  $("annuler").addEventListener("click", function () { appliquerTheme(reglages.theme); dlg.close(); });
  dlg.addEventListener("cancel", function () { appliquerTheme(reglages.theme); }); // touche Retour / Échap
  dlg.addEventListener("close", function () { appliquerTheme(reglages.theme); });
  $("formulaire").addEventListener("submit", function (e) {
    var d = $("champ-date").value;
    if (!Countdown.lireDate(d)) { e.preventDefault(); $("champ-date").focus(); return; }
    reglages = nettoyer({
      date: d,
      heure: $("champ-heure").value,
      prenoms: [$("prenom1").value, $("prenom2").value],
      theme: (document.querySelector('input[name="theme"]:checked') || {}).value,
      provisoire: $("provisoire").checked
    });
    sauverReglages(reglages);
    appliquerTheme(reglages.theme);
    relancer();
  });

  /* ---------- Installation sur l'écran d'accueil ---------- */
  var invite = null; // événement « beforeinstallprompt » gardé pour plus tard (Chrome, Android)
  var dejaInstallee = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) ||
    navigator.standalone === true;
  var iOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  function majInstaller() {
    var bloc = $("installer"), bouton = $("bouton-installer"), aide = $("installer-aide");
    bloc.hidden = dejaInstallee;
    if (dejaInstallee) return;
    bouton.hidden = !invite;
    if (invite) {
      aide.textContent = "";
    } else if (iOS) {
      aide.textContent = "Sur iPhone : ouvrez ce lien dans Safari, touchez le bouton Partager " +
        "(le carré avec une flèche ↑), puis « Sur l'écran d'accueil ».";
    } else {
      aide.textContent = "Touchez le menu ⋮ du navigateur, puis « Installer l'application » " +
        "ou « Ajouter à l'écran d'accueil ».";
    }
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    invite = e;
    majInstaller();
  });
  window.addEventListener("appinstalled", function () {
    invite = null;
    dejaInstallee = true;
    majInstaller();
  });
  $("bouton-installer").addEventListener("click", function () {
    if (!invite) return;
    var e = invite;
    invite = null; // une invite ne sert qu'une fois
    e.prompt();
    (e.userChoice || Promise.resolve({})).then(function (choix) {
      if (choix && choix.outcome === "accepted") dejaInstallee = true;
      majInstaller();
    });
  });
  majInstaller();

  /* ---------- Pétales ---------- */
  var reduit = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduit) {
    var conteneur = document.querySelector(".petales");
    for (var i = 0; i < 14; i++) {
      var el = document.createElement("span");
      el.className = "petale c" + (i % 4 + 1);
      el.style.left = (Math.random() * 100) + "%";
      el.style.animationDuration = (8 + Math.random() * 8) + "s";
      el.style.animationDelay = (-Math.random() * 16) + "s";
      var t = 0.6 + Math.random() * 0.7;
      el.style.width = (14 * t) + "px";
      el.style.height = (12 * t) + "px";
      conteneur.appendChild(el);
    }
  }

  relancer();
  // Premier lancement : pas encore de date, on ouvre directement les Réglages.
  if (!reglages.date) ouvrirReglages();

  /* ---------- Hors ligne ---------- */
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
})();
