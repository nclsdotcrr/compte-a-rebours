(function () {
  "use strict";

  var VILLE = "Tokyo";
  var CLE = "compte-a-rebours-japon";
  // Le voyage, fixé ici pour tout le monde (heures de Paris).
  // Dates et heures restent corrigeables dans les Réglages si un vol change.
  var DATE_DEPART = "2027-02-06", HEURE_DEPART = "18:30"; // décollage
  var DATE_RETOUR = "2027-02-18", HEURE_RETOUR = "16:30"; // atterrissage
  var NOM = "Miniva"; // nom affiché par défaut, modifiable dans les Réglages
  var THEMES = { kawaii: "#ffd6e7", neon: "#12062b", cyberpunk: "#0b0b0f", washi: "#f7f0e1", ghibli: "#8fd0f5", yokai: "#e4d2ad" };

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Réglages ----------
     Gardés uniquement sur le téléphone : le mode (départ ou retour), le thème et,
     seulement si on les change, le nom affiché et les dates et heures des vols. */
  function texte(v) { return typeof v === "string" ? v.trim().slice(0, 40) : ""; }

  function nettoyer(s) {
    // Prénoms saisis dans une version précédente (deux cases) : on les garde.
    var anciens = Array.isArray(s.prenoms) ? s.prenoms.map(texte).filter(Boolean).join(" & ") : "";
    // Les dates saisies avant que le voyage soit fixé (réglages sans « v: 2 »)
    // sont ignorées : c'est le voyage fixé ci-dessus qui s'applique.
    var perso = s.v === 2;
    return {
      nom: texte(s.nom) || anciens || NOM,
      // « depart » : pour qui part, le décompte va jusqu'au départ.
      // « retour » : les parents comptent jusqu'au retour.
      mode: s.mode === "retour" ? "retour" : "depart",
      date: perso && Countdown.lireDate(s.date) ? s.date : DATE_DEPART,
      heure: perso && Countdown.lireHeure(s.heure) ? s.heure : HEURE_DEPART,
      retour: perso && Countdown.lireDate(s.retour) ? s.retour : DATE_RETOUR,
      heureRetour: perso && Countdown.lireHeure(s.heureRetour) ? s.heureRetour : HEURE_RETOUR,
      theme: THEMES[s.theme] ? s.theme : "kawaii"
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
    // ?mode=retour&theme=neon&nom=Autre
    var q = new URLSearchParams(location.search);
    r = nettoyer({ mode: q.get("mode"), nom: q.get("nom"), theme: q.get("theme") });
    if (q.toString()) {
      sauverReglages(r);
      // Retire les paramètres de l'adresse (et donc de l'historique de la page).
      try { history.replaceState(null, "", location.pathname); } catch (e) {}
    }
    return r;
  }

  function sauverReglages(r) {
    // Une valeur identique à celle fixée en haut du fichier n'est pas enregistrée :
    // le téléphone suivra ainsi une correction publiée plus tard.
    var c = {
      v: 2,
      nom: r.nom === NOM ? "" : r.nom,
      mode: r.mode,
      theme: r.theme,
      date: r.date === DATE_DEPART ? "" : r.date,
      heure: r.heure === HEURE_DEPART ? "" : r.heure,
      retour: r.retour === DATE_RETOUR ? "" : r.retour,
      heureRetour: r.heureRetour === HEURE_RETOUR ? "" : r.heureRetour
    };
    try { localStorage.setItem(CLE, JSON.stringify(c)); } catch (e) { /* tant pis */ }
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

  function jourTexte(iso) {
    var d = Countdown.lireDate(iso);
    return fmtDate.format(new Date(Date.UTC(d.y, d.m - 1, d.d)));
  }

  // Exemple : « Départ : samedi 6 février 2027 à 18 h 30 (heure de Paris) »
  function texteVol(etiquette, date, heure) {
    var h = Countdown.lireHeure(heure);
    return etiquette + " : " + jourTexte(date) + " à " + h.h + " h " + deux(h.min) + " (heure de Paris)";
  }

  function deux(n) { return String(n).padStart(2, "0"); }

  /* Le nom affiché. Si on y écrit deux prénoms séparés par « & », ils sont
     à égalité : leur ordre s'inverse chaque jour. */
  function noms(jours) {
    var p = reglages.nom.split("&").map(function (x) { return x.trim(); }).filter(Boolean);
    if (p.length === 2 && Math.abs(jours) % 2 === 1) p = [p[1], p[0]];
    return p.join(" & ");
  }

  function afficher() {
    var retour = reglages.mode === "retour";
    var res = retour
      ? Countdown.calculer(reglages.retour, reglages.heureRetour)
      : Countdown.calculer(reglages.date, reglages.heure);
    var pastille = "東京まで ・ direction " + VILLE;
    var avant = "あと", nombre, unite, message, dateTxt, n, virgule, de;

    if (!res) {
      nombre = "?";
      unite = "jours";
      message = "Touchez la roue ⚙︎ pour vérifier les dates 🍣🥢";
      dateTxt = "";
    } else if (retour) {
      n = noms(res.jours);
      virgule = n ? ", " + n : "";
      de = n ? " de " + n : "";
      pastille = "帰りまで ・ retour de " + VILLE;
      dateTxt = texteVol("Arrivée", reglages.retour, reglages.heureRetour);
      if (res.jours > 1) {
        nombre = String(res.jours);
        unite = "jours";
        message = "Plus que " + res.jours + " jours avant le retour" + de + " ! 🏠";
      } else if (res.jours === 1) {
        nombre = "1";
        unite = "jour";
        message = "Retour demain ! Dernière nuit" + (n ? " sans " + n : "") + " 🌙";
      } else if (res.jours === 0) {
        avant = "今日！";
        nombre = "Jour J";
        unite = "";
        // « envole » : l'heure du vol est passée (ici, l'atterrissage).
        message = res.envole
          ? "Atterrissage ! おかえり" + virgule + " 🏠"
          : "C'est aujourd'hui ! Retour" + de + " 🏠";
      } else {
        pastille = "おかえり ・ de retour de " + VILLE;
        avant = "おかえり";
        nombre = String(-res.jours);
        unite = (-res.jours > 1 ? "jours" : "jour") + " depuis le retour";
        message = (n ? n + " : de" : "De") + " retour ! 🌸";
      }
    } else {
      n = noms(res.jours);
      virgule = n ? ", " + n : "";
      dateTxt = texteVol("Départ", reglages.date, reglages.heure);
      if (res.jours > 1) {
        nombre = String(res.jours);
        unite = "jours";
        message = (n ? n + " : plus" : "Plus") + " que " + res.jours + " jours avant " + VILLE + " ! 🍣🥢";
      } else if (res.jours === 1) {
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
    minuterie = setInterval(afficher, 1000);
  }
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) afficher();
  });

  /* ---------- Interrupteur Départ / Retour (écran principal) ---------- */
  $("bascule").checked = reglages.mode === "retour";
  $("bascule").addEventListener("change", function () {
    reglages.mode = this.checked ? "retour" : "depart";
    sauverReglages(reglages);
    relancer();
  });

  /* ---------- Fenêtre de réglages ---------- */
  var dlg = $("dialogue");
  function ouvrirReglages() {
    $("champ-nom").value = reglages.nom;
    $("champ-nom").placeholder = NOM;
    $("champ-date").value = reglages.date;
    $("champ-heure").value = reglages.heure;
    $("champ-retour").value = reglages.retour;
    $("champ-heure-retour").value = reglages.heureRetour;
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
    var ret = $("champ-retour").value;
    if (!Countdown.lireDate(d)) { e.preventDefault(); $("champ-date").focus(); return; }
    if (!Countdown.lireDate(ret)) { e.preventDefault(); $("champ-retour").focus(); return; }
    // Une heure laissée vide revient à l'heure fixée.
    reglages = nettoyer({
      v: 2,
      nom: $("champ-nom").value, // laissé vide : retour au nom par défaut
      mode: reglages.mode,
      date: d,
      heure: $("champ-heure").value,
      retour: ret,
      heureRetour: $("champ-heure-retour").value,
      theme: (document.querySelector('input[name="theme"]:checked') || {}).value
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

  /* ---------- Hors ligne ---------- */
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
})();
