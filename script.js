/* ═══════════════════════════════════════════════════════════════════════
   For Amna — drifting petals, an unwrapping box, a tunnel of pink and
   white flowers, a gallery, and a letter that types itself as you scroll.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var BOUQUETS = [
    "amna/5936084187276316915_121.jpg",
    "amna/5936084187276316916_120.jpg",
    "amna/5936084187276316917_121.jpg",
    "amna/5936084187276316918_120.jpg",
    "amna/5936084187276316920_121.jpg",
    "amna/5936084187276316921_121.jpg"
  ];

  /* the blooms are strictly pink and white */
  var PALETTE = [
    { petal: "#ff9ec4", inner: "#ffd3e4", core: "#ffffff", edge: "#e8437f" }, /* rose pink  */
    { petal: "#ffd3e4", inner: "#fff0f6", core: "#ffffff", edge: "#f19bbd" }, /* blush pink */
    { petal: "#ffffff", inner: "#ffe6f0", core: "#ff9ec4", edge: "#f3a8c6" }, /* white      */
    { petal: "#f76a9e", inner: "#ffb7d5", core: "#ffe6f0", edge: "#c92f68" }, /* deep pink  */
    { petal: "#ffe6f0", inner: "#ffffff", core: "#ff9ec4", edge: "#f7aac8" }, /* pale pink  */
    { petal: "#fff6fa", inner: "#ffd3e4", core: "#ffb7d5", edge: "#f3b9cf" }  /* cream white*/
  ];

  /* the drifting background petals are light pink and white */
  var PETAL_TONE = [
    { fill: "#ffd3e4", edge: "#f3a8c6" },
    { fill: "#ffe6f0", edge: "#f7aac8" },
    { fill: "#ffffff", edge: "#f3b9cf" },
    { fill: "#ffb7d5", edge: "#ef86b0" }
  ];

  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var screenBox = document.getElementById("screen-box");
  var screenBloom = document.getElementById("screen-bloom");
  var screenLetter = document.getElementById("screen-letter");
  var giftWrap = document.getElementById("gift-wrap");
  var giftBase = document.getElementById("gift-base");
  var giftLid = document.getElementById("gift-lid");
  var giftLidImg = document.getElementById("gift-lid-img");
  var giftConfetti = document.getElementById("giftConfetti");
  var bloomStage = document.getElementById("bloomStage");
  var gallery = document.getElementById("gallery");
  var btnReplay = document.getElementById("btn-replay");
  var btnCopy = document.getElementById("btn-copy");
  var copyText = document.getElementById("copyText");
  var letterBody = document.getElementById("letterBody");

  var phase = "box";
  var bloomTimer = 0;
  var fallTimer = 0;

  /* ── deterministic pseudo random, so the layout is stable ────────── */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ── 1 · the lid is the top of the very same photograph ──────────── */
  function syncLid() {
    if (!giftBase || !giftLidImg) return;
    var src = giftBase.currentSrc || giftBase.src;
    if (src && giftLidImg.getAttribute("src") !== src) giftLidImg.setAttribute("src", src);
  }

  if (giftBase) {
    if (giftBase.complete && giftBase.naturalWidth) syncLid();
    giftBase.addEventListener("load", syncLid);
    giftBase.addEventListener("error", syncLid);
  }

  /* a small scatter of petals that flies out of the box as it opens */
  function burstConfetti() {
    if (!giftConfetti) return;
    giftConfetti.innerHTML = "";
    var rng = mulberry32(77123);
    var frag = document.createDocumentFragment();
    for (var i = 0; i < 16; i++) {
      var bit = document.createElement("i");
      var tone = PETAL_TONE[Math.floor(rng() * PETAL_TONE.length)];
      var angle = (rng() * 300 - 150) * Math.PI / 180;
      var reach = 70 + rng() * 120;
      bit.style.setProperty("--cx", (Math.sin(angle) * reach).toFixed(1) + "px");
      bit.style.setProperty("--cy", (Math.abs(Math.cos(angle)) * reach * 0.6 + 60).toFixed(1) + "px");
      bit.style.setProperty("--cs", (rng() * 420 - 210).toFixed(0) + "deg");
      bit.style.setProperty("animation-delay", (rng() * 0.18).toFixed(3) + "s");
      var size = 9 + rng() * 11;
      bit.style.width = size.toFixed(1) + "px";
      bit.style.height = size.toFixed(1) + "px";
      bit.innerHTML = petalSVG(tone);
      frag.appendChild(bit);
    }
    giftConfetti.appendChild(frag);
  }

  /* one soft petal, used for the background drift and the burst */
  function petalSVG(tone) {
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="presentation">' +
      '<path d="M50 3 C75 24 89 48 85 70 C81 92 63 98 50 97 C37 98 19 92 15 70 C11 48 25 24 50 3 Z" ' +
      'fill="' + tone.fill + '" stroke="' + tone.edge + '" stroke-width="3"/>' +
      '<path d="M50 9 L50 92" stroke="' + tone.edge + '" stroke-width="2" opacity="0.35" fill="none"/>' +
      "</svg>";
  }

  /* ── 5 · light pink and white petals drifting in the background ──── */
  function buildPetals() {
    var field = document.getElementById("petalField");
    if (!field || field.childElementCount) return;
    var rng = mulberry32(24680);
    var count = REDUCED ? 8 : 20;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < count; i++) {
      var el = document.createElement("span");
      el.className = "petal";
      var tone = PETAL_TONE[Math.floor(rng() * PETAL_TONE.length)];
      var size = 12 + rng() * 20;
      el.style.width = size.toFixed(1) + "px";
      el.style.height = size.toFixed(1) + "px";
      el.style.left = (rng() * 100).toFixed(2) + "%";
      el.style.setProperty("--sway", (rng() * 120 - 60).toFixed(0) + "px");
      el.style.setProperty("--petal-alpha", (0.45 + rng() * 0.45).toFixed(2));
      el.style.animationDuration = (15 + rng() * 16).toFixed(1) + "s";
      el.style.animationDelay = "-" + (rng() * 30).toFixed(1) + "s";
      el.innerHTML = petalSVG(tone);
      frag.appendChild(el);
    }
    field.appendChild(frag);
  }

  /* ── one cartoon flower, drawn as SVG, pink and white only ───────── */
  function flowerSVG(rng) {
    var pal = PALETTE[Math.floor(rng() * PALETTE.length)];
    var petals = 6 + Math.floor(rng() * 4);
    var step = 360 / petals;
    var inner = Math.max(4, petals - 2);
    var innerStep = 360 / inner;
    var spin = rng() * 360;
    var shape = [];
    shape.push('<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="presentation">');
    shape.push('<g transform="translate(60,60) rotate(' + spin.toFixed(1) + ')">');
    /* a smaller inner ring so each bloom reads as a full flower */
    for (var k = 0; k < inner; k++) {
      shape.push('<ellipse cx="0" cy="-17" rx="9" ry="17" fill="' + pal.inner +
        '" stroke="' + pal.edge + '" stroke-width="1.4" transform="rotate(' + (k * innerStep + innerStep / 2).toFixed(2) + ')"/>');
    }
    for (var i = 0; i < petals; i++) {
      shape.push('<ellipse cx="0" cy="-27" rx="13" ry="26" fill="' + pal.petal +
        '" stroke="' + pal.edge + '" stroke-width="1.6" transform="rotate(' + (i * step).toFixed(2) + ')"/>');
    }
    shape.push('<circle r="12" fill="' + pal.core + '" stroke="' + pal.edge + '" stroke-width="1.6"/>');
    shape.push("</g></svg>");
    return shape.join("");
  }

  /* ── 2a · the dense spiral tunnel of blooms ──────────────────────── */
  var STEP_MS = 12;

  function buildSpiral() {
    bloomStage.innerHTML = "";
    bloomStage.classList.remove("is-falling");
    var rng = mulberry32(20261014);
    var COUNT = REDUCED ? 40 : 120;
    var GOLDEN = Math.PI * (3 - Math.sqrt(5)); /* ≈ 137.5° */
    var MAX_R = 47;                            /* vmin from the centre */
    var frag = document.createDocumentFragment();

    for (var i = 0; i < COUNT; i++) {
      var t = COUNT === 1 ? 1 : i / (COUNT - 1);
      var angle = i * GOLDEN;
      var radius = MAX_R * Math.sqrt(t);
      var dx = Math.cos(angle) * radius;
      var dy = Math.sin(angle) * radius;

      var wrap = document.createElement("div");
      wrap.className = "spiral-flower";
      wrap.style.left = "calc(50% + " + dx.toFixed(2) + "vmin)";
      wrap.style.top = "calc(50% + " + dy.toFixed(2) + "vmin)";
      /* near the centre they are tiny; out at the rim they are large */
      wrap.style.setProperty("--size", (26 + t * 62 + rng() * 16).toFixed(1) + "px");
      wrap.style.setProperty("--delay", (i * STEP_MS / 1000).toFixed(3) + "s");
      wrap.innerHTML = flowerSVG(rng);
      frag.appendChild(wrap);
    }
    bloomStage.appendChild(frag);
    return (COUNT - 1) * STEP_MS + 950;
  }

  /* ── 2b · the cascade: every bloom lets go and falls to the floor ── */
  function startFalling() {
    var flowers = Array.prototype.slice.call(bloomStage.querySelectorAll(".spiral-flower"));
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var longest = 0;

    flowers.forEach(function (el, i) {
      var box = el.getBoundingClientRect();
      var centreY = box.top + box.height / 2;
      var floorY = vh - box.height * 0.42;
      var dy = Math.max(60, floorY - centreY);
      var dir = i % 2 ? 1 : -1;

      el.style.setProperty("--fall-y", dy.toFixed(1) + "px");
      el.style.setProperty("--fall-x", (dir * (6 + (i * 13) % 30)).toFixed(0) + "px");
      el.style.setProperty("--fall-spin", (dir * (120 + (i * 37) % 200)).toFixed(0) + "deg");
      var delay = i * 0.008;
      var dur = 1.05 + (i % 5) * 0.08;
      el.style.setProperty("--fall-delay", delay.toFixed(3) + "s");
      el.style.setProperty("--fall-dur", dur.toFixed(2) + "s");
      el.classList.add("is-falling");
      longest = Math.max(longest, delay + dur);
    });

    bloomStage.classList.add("is-falling");
    return REDUCED ? 400 : Math.max(900, Math.round(longest * 1000) + 260);
  }

  /* ── 3 · the letter types itself out, line by line, as you scroll ── */
  var lineEls = [];
  var lineTexts = [];
  var totalChars = 0;
  var shownChars = 0;
  var driftChars = 0;
  var tickTimer = 0;
  var TICK_MS = 40;
  var DRIFT_CPS = 7;

  function scrollProgress() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    if (max <= 0) return 1;
    return Math.max(0, Math.min(1, window.scrollY / max));
  }

  function renderTyped(n) {
    var left = n;
    var caretLine = -1;
    for (var i = 0; i < lineEls.length; i++) {
      var full = lineTexts[i];
      var el = lineEls[i];
      var take;
      if (left >= full.length) {
        take = full.length;
        left -= full.length;
        caretLine = i;
      } else if (left > 0) {
        take = left;
        left = 0;
        caretLine = i;
      } else {
        take = 0;
      }
      el.textContent = full.slice(0, take);
    }
    for (var j = 0; j < lineEls.length; j++) {
      lineEls[j].classList.toggle("is-typing", j === caretLine && shownChars < totalChars);
    }
  }

  function applyTyping(target) {
    if (target <= shownChars) return;
    shownChars = Math.min(totalChars, target);
    renderTyped(shownChars);
    if (shownChars >= totalChars && tickTimer) {
      window.clearInterval(tickTimer);
      tickTimer = 0;
    }
  }

  function typeTick() {
    driftChars = Math.min(totalChars, driftChars + DRIFT_CPS * TICK_MS / 1000);
    applyTyping(Math.max(Math.floor(driftChars), Math.round(scrollProgress() * totalChars)));
  }

  function startTyping() {
    lineEls = Array.prototype.slice.call(letterBody.querySelectorAll(".letter-line"));
    lineTexts = lineEls.map(function (el) { return el.getAttribute("data-text") || ""; });
    totalChars = lineTexts.reduce(function (a, s) { return a + s.length; }, 0);
    shownChars = 0;
    driftChars = 0;
    renderTyped(0);
    if (tickTimer) window.clearInterval(tickTimer);
    tickTimer = window.setInterval(typeTick, TICK_MS);
  }

  /* ── 4 · the vintage photo frames ────────────────────────────────── */
  function buildGallery() {
    gallery.innerHTML = "";
    var rots = [-3, 2, -2, 3, -1.5, 2.5];
    var frag = document.createDocumentFragment();
    BOUQUETS.forEach(function (src, i) {
      var frame = document.createElement("div");
      frame.className = "vframe";
      frame.style.setProperty("--delay", (i * 0.09).toFixed(2) + "s");

      var card = document.createElement("div");
      card.className = "framed";
      card.style.setProperty("--tilt", rots[i % rots.length] + "deg");

      var img = document.createElement("img");
      img.src = src;
      img.alt = "Bouquet " + (i + 1);
      img.loading = "eager";
      img.decoding = "async";

      card.appendChild(img);
      frame.appendChild(card);
      frag.appendChild(frame);
    });
    gallery.appendChild(frag);
  }

  function revealGallery() {
    var frames = Array.prototype.slice.call(gallery.querySelectorAll(".vframe"));
    if (!("IntersectionObserver" in window)) {
      frames.forEach(function (f) { f.classList.add("is-in"); });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
    frames.forEach(function (f) { obs.observe(f); });
  }

  /* ── flow ────────────────────────────────────────────────────────── */
  function show(screen) {
    [screenBox, screenBloom, screenLetter].forEach(function (s) {
      s.classList.toggle("is-active", s === screen);
      s.setAttribute("aria-hidden", s === screen ? "false" : "true");
    });
  }

  function openGift() {
    if (phase !== "box") return;
    phase = "bloom";

    /* the lid lifts off and the box opens, before the flowers take over */
    syncLid();
    burstConfetti();
    giftWrap.classList.add("is-opening");

    var bloomMs = buildSpiral();
    screenBloom.classList.add("is-active");
    screenBloom.setAttribute("aria-hidden", "false");

    window.setTimeout(function () {
      screenBox.classList.remove("is-active", "is-opening");
      screenBox.setAttribute("aria-hidden", "true");
    }, 1150);

    window.clearTimeout(bloomTimer);
    bloomTimer = window.setTimeout(function () {
      if (phase !== "bloom") return;
      phase = "fall";
      var fallMs = startFalling();
      window.clearTimeout(fallTimer);
      fallTimer = window.setTimeout(goToLetter, fallMs);
    }, REDUCED ? 400 : bloomMs);
  }

  function goToLetter() {
    window.clearTimeout(bloomTimer);
    window.clearTimeout(fallTimer);
    if (phase === "letter") return;
    phase = "letter";
    show(screenLetter);
    buildGallery();
    revealGallery();
    startTyping();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  giftWrap.addEventListener("click", openGift);
  giftWrap.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openGift();
    }
  });
  /* tapping the bloom jumps straight to the letter */
  bloomStage.addEventListener("click", goToLetter);

  btnReplay.addEventListener("click", function () {
    window.location.reload();
  });

  btnCopy.addEventListener("click", function () {
    var old = copyText.textContent;
    function done() {
      copyText.textContent = "Copied!";
      window.setTimeout(function () { copyText.textContent = old; }, 1200);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(window.location.href).then(done, done);
    } else {
      done();
    }
  });

  /* scrolling down reveals the rest of the letter right away */
  window.addEventListener("scroll", function () {
    if (phase !== "letter" || !totalChars) return;
    applyTyping(Math.round(scrollProgress() * totalChars));
  }, { passive: true });

  buildPetals();
  window.__amna = {
    goToLetter: goToLetter,
    openGift: openGift,
    scrollProgress: scrollProgress,
    stats: function () {
      return { phase: phase, totalChars: totalChars, shownChars: shownChars, lines: lineEls.length };
    }
  };
})();
