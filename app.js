(function () {
  "use strict";

  var VILLE = "Tokyo";
  var CLE = "compte-a-rebours-japon";
  // Le voyage, fixé ici pour tout le monde (heures de Paris).
  // Dates et heures restent corrigeables dans les Réglages si un vol change.
  var DATE_DEPART = "2027-02-06", HEURE_DEPART = "18:30"; // décollage
  var DATE_RETOUR = "2027-02-18", HEURE_RETOUR = "16:30"; // atterrissage
  var NOM = "Mivana"; // nom affiché par défaut, modifiable dans les Réglages
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

  /* L'heure qu'il est dans une ville, avec ☀️ le jour et 🌙 la nuit (22 h – 7 h). */
  var fmtVilles = {};
  function heureA(tz, t) {
    var f = fmtVilles[tz] || (fmtVilles[tz] = new Intl.DateTimeFormat("fr-FR", {
      timeZone: tz, hour: "numeric", minute: "2-digit", hourCycle: "h23"
    }));
    var p = {};
    f.formatToParts(new Date(t)).forEach(function (x) { p[x.type] = x.value; });
    var h = +p.hour % 24;
    return h + " h " + p.minute + " " + (h >= 7 && h < 22 ? "☀️" : "🌙");
  }

  // Vol passé : la date est passée, ou c'est le jour même et l'heure du vol est passée.
  function passe(r) { return !!r && (r.jours < 0 || (r.jours === 0 && r.envole)); }

  function afficher() {
    var t = Date.now();
    var resDep = Countdown.calculer(reglages.date, reglages.heure, t);
    var resRet = Countdown.calculer(reglages.retour, reglages.heureRetour, t);
    var rentrees = passe(resRet);
    var auJapon = passe(resDep) && !!resRet && !rentrees;
    // Une fois rentrées, l'écran « Départ » affiche lui aussi le retour.
    var retour = reglages.mode === "retour" || rentrees;
    var res = retour ? resRet : resDep;
    var pastille = "東京まで ・ direction " + VILLE;
    var avant = "あと", nombre, unite, message, dateTxt, n, virgule, de, sejour = null;

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
        message = "Plus que " + res.jours + " jours avant le retour" + de + " ! 🇫🇷";
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
          ? "Atterrissage ! おかえり" + virgule + " 🇫🇷"
          : "C'est aujourd'hui ! Retour" + de + " 🇫🇷";
      } else {
        pastille = "おかえり ・ de retour de " + VILLE;
        avant = "おかえり";
        nombre = String(-res.jours);
        unite = (-res.jours > 1 ? "jours" : "jour") + " depuis le retour";
        message = (n ? n + " : de" : "De") + " retour ! 🌸";
      }
      // Pendant le séjour, côté parents : le jour du voyage et l'heure à Tokyo.
      if (auJapon) {
        var jour = -resDep.jours, total = resRet.jours - resDep.jours;
        sejour = [jour === 0 ? "En vol vers " + VILLE + " ✈️" : "Jour " + jour + " sur " + total + " au Japon",
          "🇯🇵 À " + VILLE + " : " + heureA("Asia/Tokyo", t)];
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
      // Pendant le séjour, côté voyageuses : l'heure à Paris (pour appeler) et le retour.
      if (auJapon) {
        var r = resRet.jours;
        sejour = ["🇫🇷 À Paris : " + heureA("Europe/Paris", t),
          r > 1 ? "retour dans " + r + " jours" : r === 1 ? "retour demain" : "retour aujourd'hui"];
      }
    }

    $("pastille").textContent = pastille;
    $("avant").textContent = avant;
    $("nombre").textContent = nombre;
    $("nombre").classList.toggle("petit", nombre.length > 3);
    $("unite").textContent = unite;
    $("unite").hidden = !unite;
    $("message").textContent = message;
    // Deux lignes : le jour du voyage (ou le retour), puis l'heure de l'autre ville.
    var sj = $("sejour"), texteSejour = sejour ? sejour.join(" ・ ") : "";
    if (sj.dataset.texte !== texteSejour) {
      sj.dataset.texte = texteSejour;
      sj.textContent = "";
      (sejour || []).forEach(function (morceau, k) {
        var e = document.createElement("span");
        e.textContent = morceau;
        sj.appendChild(e);
      });
    }
    sj.hidden = !sejour;
    document.body.classList.toggle("en-sejour", !!sejour);
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

    feter(res, retour);
    afficherMot(t);
  }

  /* ---------- Confettis aux grandes étapes ----------
     Départ : J-100, J-50, J-30, J-7, J-1 et le décollage.
     Retour : J-7, J-1 et l'atterrissage.
     Une seule fois par étape (retenu sur le téléphone) ; toucher la carte les relance ce jour-là. */
  var CLE_FETES = CLE + "-fetes";
  var fetesVues = {};
  try { (JSON.parse(localStorage.getItem(CLE_FETES) || "[]") || []).forEach(function (id) { fetesVues[id] = 1; }); } catch (e) {}
  var feteDuJour = null;

  function feter(res, retour) {
    var etape = null;
    if (res) {
      if (res.jours === 0 && res.envole) etape = retour ? "atterrissage" : "decollage";
      else if ((retour ? [7, 1] : [100, 50, 30, 7, 1]).indexOf(res.jours) > -1) etape = (retour ? "r" : "d") + res.jours;
    }
    feteDuJour = etape;
    if (!etape) return;
    var id = etape + "@" + (retour ? reglages.retour : reglages.date);
    if (fetesVues[id]) return;
    fetesVues[id] = 1;
    try { localStorage.setItem(CLE_FETES, JSON.stringify(Object.keys(fetesVues).slice(-30))); } catch (e) {}
    confettis();
  }

  var reduit = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var toile = null;
  function confettis() {
    if (reduit || toile || document.hidden) return;
    toile = document.createElement("canvas");
    toile.className = "confettis";
    toile.setAttribute("aria-hidden", "true");
    document.body.appendChild(toile);
    var moi = toile;
    var W = innerWidth, H = innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    toile.width = W * dpr;
    toile.height = H * dpr;
    var cx = toile.getContext("2d");
    cx.scale(dpr, dpr);
    // Les couleurs du thème choisi
    var st = getComputedStyle(document.documentElement);
    var couleurs = ["--accent", "--petale-1", "--petale-2", "--petale-3", "--petale-4", "--nombre"]
      .map(function (v) { return st.getPropertyValue(v).trim(); }).filter(Boolean);
    var bouts = [];
    for (var i = 0; i < 160; i++) {
      var a = -Math.PI / 2 + (Math.random() - 0.5) * 1.7, v = 7 + Math.random() * 9;
      bouts.push({
        x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.5,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        r: Math.random() * 6.3, vr: (Math.random() - 0.5) * 0.3, o: Math.random() * 6.3,
        w: 6 + Math.random() * 6, h: 5 + Math.random() * 6, c: couleurs[i % couleurs.length]
      });
    }
    var debut = null;
    function image(now) {
      if (debut === null) debut = now;
      var e = now - debut;
      cx.clearRect(0, 0, W, H);
      cx.globalAlpha = Math.max(0, 1 - Math.max(0, e - 3500) / 1500);
      bouts.forEach(function (p) {
        p.vx *= 0.96;
        p.vy = p.vy * 0.96 + 0.25;
        p.x += p.vx + Math.sin(p.o + e / 300) * 0.8;
        p.y += p.vy;
        p.r += p.vr;
        cx.save();
        cx.translate(p.x, p.y);
        cx.rotate(p.r);
        cx.fillStyle = p.c;
        cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 1);
        cx.restore();
      });
      if (e < 5000 && toile === moi) requestAnimationFrame(image);
      else finir();
    }
    function finir() { moi.remove(); if (toile === moi) toile = null; }
    requestAnimationFrame(image);
    setTimeout(finir, 6000); // au cas où l'animation serait mise en pause
  }
  document.querySelector(".carte").addEventListener("click", function () { if (feteDuJour) confettis(); });

  /* ---------- Mot japonais du jour ----------
     [japonais, rōmaji, prononciation à la française, sens]. Le même mot pour tout le monde
     le même jour ; la liste recommence au début une fois finie. */
  var MOTS = [
    ["こんにちは", "konnichiwa", "kon-ni-tchi-wa", "bonjour"],
    ["ありがとう", "arigatō", "a-ri-ga-toh", "merci"],
    ["すみません", "sumimasen", "sou-mi-ma-sène", "pardon, excusez-moi"],
    ["おはよう", "ohayō", "o-ha-yoh", "bonjour (le matin)"],
    ["こんばんは", "konbanwa", "kom-ban-wa", "bonsoir"],
    ["はい", "hai", "haï", "oui"],
    ["いいえ", "iie", "i-i-é", "non"],
    ["おいしい", "oishii", "o-i-chii", "c'est bon ! (délicieux)"],
    ["いただきます", "itadakimasu", "i-ta-da-ki-mass", "bon appétit (avant de manger)"],
    ["ごちそうさまでした", "gochisōsama deshita", "go-tchi-soh-sa-ma dé-chta", "merci pour le repas"],
    ["かわいい", "kawaii", "ka-wa-ii", "mignon"],
    ["すごい", "sugoi", "sou-goï", "génial ! incroyable !"],
    ["おねがいします", "onegai shimasu", "o-né-gaï chi-mass", "s'il vous plaît"],
    ["これをください", "kore o kudasai", "ko-ré o kou-da-saï", "je voudrais ceci, s'il vous plaît"],
    ["いくらですか", "ikura desu ka", "i-kou-ra dess ka", "combien ça coûte ?"],
    ["トイレはどこですか", "toire wa doko desu ka", "toï-ré wa do-ko dess ka", "où sont les toilettes ?"],
    ["わかりません", "wakarimasen", "wa-ka-ri-ma-sène", "je ne comprends pas"],
    ["えいごをはなせますか", "eigo o hanasemasu ka", "é-i-go o ha-na-sé-mass ka", "vous parlez anglais ?"],
    ["もういちど", "mō ichido", "moh i-tchi-do", "encore une fois"],
    ["ゆっくり", "yukkuri", "youk-kou-ri", "lentement"],
    ["だいじょうぶ", "daijōbu", "daï-djoh-bou", "ça va, pas de souci"],
    ["ちょっとまって", "chotto matte", "tchot-to mat-té", "attends un peu !"],
    ["ほんとう？", "hontō?", "hone-toh", "c'est vrai ?"],
    ["たのしい", "tanoshii", "ta-no-chii", "amusant, on s'amuse"],
    ["たのしみ", "tanoshimi", "ta-no-chi-mi", "j'ai hâte !"],
    ["きれい", "kirei", "ki-réï", "joli, propre"],
    ["さむい", "samui", "sa-mouï", "il fait froid"],
    ["あつい", "atsui", "a-tsouï", "il fait chaud, c'est chaud"],
    ["ゆき", "yuki", "you-ki", "neige"],
    ["そら", "sora", "so-ra", "ciel"],
    ["つき", "tsuki", "tsou-ki", "lune"],
    ["ほし", "hoshi", "ho-chi", "étoile"],
    ["やま", "yama", "ya-ma", "montagne"],
    ["ふじさん", "Fuji-san", "fou-dji-sane", "le mont Fuji"],
    ["うみ", "umi", "ou-mi", "mer"],
    ["さくら", "sakura", "sa-kou-ra", "fleur de cerisier"],
    ["じんじゃ", "jinja", "djine-dja", "sanctuaire shinto"],
    ["おてら", "otera", "o-té-ra", "temple bouddhiste"],
    ["まつり", "matsuri", "ma-tsou-ri", "fête traditionnelle"],
    ["はなび", "hanabi", "ha-na-bi", "feu d'artifice"],
    ["おに", "oni", "o-ni", "ogre à cornes des contes"],
    ["ようかい", "yōkai", "yoh-kaï", "créature magique des légendes"],
    ["おめん", "omen", "o-mène", "masque"],
    ["ねこ", "neko", "né-ko", "chat"],
    ["いぬ", "inu", "i-nou", "chien"],
    ["ともだち", "tomodachi", "to-mo-da-tchi", "ami, amie"],
    ["えがお", "egao", "é-ga-o", "sourire"],
    ["がんばって", "ganbatte", "gam-bat-té", "courage ! bonne chance !"],
    ["おげんきですか", "o-genki desu ka", "o-guène-ki dess ka", "comment allez-vous ?"],
    ["げんきです", "genki desu", "guène-ki dess", "je vais bien"],
    ["よろしくおねがいします", "yoroshiku onegai shimasu", "yo-ro-chi-kou o-né-gaï chi-mass", "enchanté, enchantée"],
    ["フランスからきました", "Furansu kara kimashita", "fou-rane-sou ka-ra ki-ma-chta", "je viens de France"],
    ["おやすみなさい", "oyasumi nasai", "o-ya-sou-mi na-saï", "bonne nuit"],
    ["さようなら", "sayōnara", "sa-yoh-na-ra", "au revoir"],
    ["またね", "mata ne", "ma-ta né", "à plus !"],
    ["みず", "mizu", "mi-zou", "eau"],
    ["おちゃ", "ocha", "o-tcha", "thé"],
    ["ごはん", "gohan", "go-hane", "riz, repas"],
    ["すし", "sushi", "sou-chi", "sushi"],
    ["らーめん", "rāmen", "raa-mène", "ramen (soupe de nouilles)"],
    ["いちご", "ichigo", "i-tchi-go", "fraise"],
    ["あまい", "amai", "a-maï", "sucré"],
    ["からい", "karai", "ka-raï", "épicé"],
    ["はし", "hashi", "ha-chi", "baguettes"],
    ["コンビニ", "konbini", "kom-bi-ni", "supérette ouverte jour et nuit"],
    ["おみやげ", "omiyage", "o-mi-ya-gué", "souvenir à offrir"],
    ["しゃしん", "shashin", "cha-chine", "photo"],
    ["しゃしんをとってもいいですか", "shashin o tottemo ii desu ka", "cha-chine o tot-té-mo ii dess ka", "je peux prendre une photo ?"],
    ["えき", "eki", "é-ki", "gare"],
    ["でんしゃ", "densha", "dène-cha", "train"],
    ["きっぷ", "kippu", "kip-pou", "billet"],
    ["ちず", "chizu", "tchi-zou", "plan, carte"],
    ["みぎ", "migi", "mi-gui", "à droite"],
    ["ひだり", "hidari", "hi-da-ri", "à gauche"],
    ["まっすぐ", "massugu", "mass-sou-gou", "tout droit"],
    ["いりぐち", "iriguchi", "i-ri-gou-tchi", "entrée"],
    ["でぐち", "deguchi", "dé-gou-tchi", "sortie"],
    ["たすけて", "tasukete", "ta-sou-ké-té", "à l'aide !"],
    ["いち、に、さん", "ichi, ni, san", "i-tchi, ni, sane", "un, deux, trois"],
    ["にほん", "Nihon", "ni-hone", "le Japon"],
    ["とうきょう", "Tōkyō", "toh-kyoh", "Tokyo"],
    ["ひこうき", "hikōki", "hi-koh-ki", "avion"],
    ["くうこう", "kūkō", "kou-koh", "aéroport"],
    ["ようこそ", "yōkoso", "yoh-ko-so", "bienvenue"],
    ["いってきます", "ittekimasu", "it-té-ki-mass", "j'y vais ! (en partant)"],
    ["いってらっしゃい", "itterasshai", "it-té-rach-chaï", "bonne route ! (à qui part)"],
    ["ただいま", "tadaima", "ta-daï-ma", "je suis rentrée !"],
    ["おかえり", "okaeri", "o-ka-é-ri", "bon retour à la maison !"]
  ];
  var DEBUT_MOTS = Date.UTC(2026, 10, 14); // premier mot : le 14 novembre 2026
  var motAffiche = -1;

  function motDuJour(t) {
    var p = Countdown.heureParis(t);
    var aujourdhui = Date.UTC(p.y, p.m - 1, p.d);
    var iso = p.y + "-" + deux(p.m) + "-" + deux(p.d);
    // Le jour du départ et le jour du retour, le mot qui va avec.
    if (iso === reglages.date) return MOTS.length - 3;
    if (iso === reglages.retour) return MOTS.length - 1;
    var i = Math.round((aujourdhui - DEBUT_MOTS) / 86400000) % MOTS.length;
    return i < 0 ? i + MOTS.length : i;
  }

  function afficherMot(t) {
    var i = motDuJour(t);
    if (i === motAffiche) return;
    motAffiche = i;
    var m = MOTS[i];
    $("mot-jp").textContent = m[0];
    $("mot-jp").classList.toggle("long", m[0].length > 7);
    $("mot-romaji").textContent = m[1];
    $("mot-dire").textContent = "« " + m[2] + " »";
    $("mot-sens").textContent = m[3];
  }

  // Écouter le mot, si le téléphone a une voix japonaise.
  var voixJa = null;
  function chercherVoix() {
    if (!window.speechSynthesis) return;
    voixJa = speechSynthesis.getVoices().filter(function (v) { return /^ja/i.test(v.lang); })[0] || null;
    $("mot-ecouter").hidden = !voixJa;
  }
  if (window.speechSynthesis) {
    chercherVoix();
    speechSynthesis.addEventListener("voiceschanged", chercherVoix);
  }
  $("mot-ecouter").addEventListener("click", function () {
    if (!voixJa || motAffiche < 0) return;
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(MOTS[motAffiche][0]);
    u.lang = voixJa.lang;
    u.voice = voixJa;
    u.rate = 0.8;
    speechSynthesis.speak(u);
  });

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
