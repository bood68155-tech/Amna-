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

  var SVG_NS = "http://www.w3.org/2000/svg";

  var phase = "box";
  var bloomTimer = 0;
  var fallTimer = 0;
  var resizeTimer = 0;
  var spiralEnd = 0;

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

  /* ── the flowers are drawn SIX times, not two hundred and forty ────
     Every bloom used to carry its own ~30-node inline SVG, which is what
     buried the renderer. Now each palette entry becomes one <symbol>, and
     a bloom is just <svg><use/></svg> — two nodes instead of thirty. */
  var FLOWER_SHAPES = [8, 7, 9, 6, 8, 10];
  var FLOWER_IDS = [];

  /* one cartoon flower, drawn once per palette entry, pink and white only */
  function buildFlowerDefs() {
    if (FLOWER_IDS.length) return;

    var host = document.getElementById("flowerDefs");
    if (!host) {
      host = document.createElementNS(SVG_NS, "svg");
      host.setAttribute("id", "flowerDefs");
      host.setAttribute("class", "flower-defs");
      host.setAttribute("aria-hidden", "true");
      document.body.appendChild(host);
    }

    var rng = mulberry32(90210);
    var out = ["<defs>"];

    for (var p = 0; p < PALETTE.length; p++) {
      var pal = PALETTE[p];
      var id = "amna-flower-" + p;
      var petals = FLOWER_SHAPES[p % FLOWER_SHAPES.length];
      var step = 360 / petals;
      var inner = Math.max(4, petals - 2);
      var innerStep = 360 / inner;
      var spin = rng() * 360;
      FLOWER_IDS.push(id);

      out.push('<symbol id="' + id + '" viewBox="0 0 120 120">');
      out.push('<g transform="translate(60,60) rotate(' + spin.toFixed(1) + ')">');
      /* a smaller inner ring so each bloom reads as a full flower */
      for (var k = 0; k < inner; k++) {
        out.push('<ellipse cx="0" cy="-17" rx="9" ry="17" fill="' + pal.inner +
          '" stroke="' + pal.edge + '" stroke-width="1.4" transform="rotate(' + (k * innerStep + innerStep / 2).toFixed(2) + ')"/>');
      }
      for (var i = 0; i < petals; i++) {
        out.push('<ellipse cx="0" cy="-27" rx="13" ry="26" fill="' + pal.petal +
          '" stroke="' + pal.edge + '" stroke-width="1.6" transform="rotate(' + (i * step).toFixed(2) + ')"/>');
      }
      out.push('<circle r="12" fill="' + pal.core + '" stroke="' + pal.edge + '" stroke-width="1.6"/>');
      out.push("</g></symbol>");
    }

    out.push("</defs>");
    host.innerHTML = out.join("");
  }

  /* a bloom: two nodes that point at one of the shared symbols */
  function flowerEl(rng) {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 120 120");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    var id = FLOWER_IDS[Math.floor(rng() * FLOWER_IDS.length)] || FLOWER_IDS[0];
    var use = document.createElementNS(SVG_NS, "use");
    use.setAttribute("href", "#" + id);
    use.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "#" + id);
    svg.appendChild(use);
    return svg;
  }

  /* ── 2a · the explosive spiral: 240 blooms, laid out in one pass ─── */
  var FLOWER_COUNT = 240;  /* inside the 220–250 band */
  var EXPAND_S = 0.5;      /* the wave reaches the rim in half a second */
  var FALL_STEP = 0.005;   /* the release is staggered, never stacked   */
  var SPIRAL = [];         /* the built blooms, reused by the cascade   */

  function buildSpiral() {
    var w = window.innerWidth || document.documentElement.clientWidth || 360;
    var h = window.innerHeight || document.documentElement.clientHeight || 640;
    var cx = w / 2;
    var cy = h / 2;

    /* The burst must reach every viewport edge with the corners included.
       Half the longer side — Math.max(w, h) / 2 — is not far enough: on a
       1440x900 screen that is 720px of reach against an 849px corner, which
       left all four corners empty. The viewport's half-diagonal always
       covers them, and is never less than half the longer side.

       Measured in pixels and applied in pixels: the previous version fed
       pixel values into a vmin() calc, which flung every bloom ~17,000px
       off screen and took the whole renderer down with it. */
    var R_MAX = Math.hypot(w, h) * 0.5 * 1.08;

    bloomStage.innerHTML = "";
    bloomStage.classList.remove("is-falling");
    SPIRAL.length = 0;
    spiralEnd = 0;

    var rng = mulberry32(20261014);
    var COUNT = REDUCED ? 70 : FLOWER_COUNT;
    var GOLDEN = Math.PI * (3 - Math.sqrt(5)); /* the golden angle ≈ 137.5° */
    var frag = document.createDocumentFragment();

    for (var i = 0; i < COUNT; i++) {
      var t = COUNT === 1 ? 1 : i / (COUNT - 1);
      var angle = i * GOLDEN;             /* an even sweep, no visible seam */
      var radius = R_MAX * Math.sqrt(t);  /* equal-area rings: dense core    */
      var dx = Math.cos(angle) * radius;
      var dy = Math.sin(angle) * radius;
      var size = 20 + t * 56 + rng() * 14;

      var el = document.createElement("div");
      el.className = "spiral-flower";
      el.style.left = (cx + dx).toFixed(1) + "px";
      el.style.top = (cy + dy).toFixed(1) + "px";
      /* tiny at the core, full-grown at the rim */
      el.style.setProperty("--size", size.toFixed(1) + "px");
      /* the wave races outwards, so it reads as one explosive burst */
      el.style.setProperty("--delay", (t * EXPAND_S).toFixed(3) + "s");
      el.appendChild(flowerEl(rng));

      /* The cascade needs no measuring: the geometry is already known, so
         nothing is read back from layout. The old code called
         getBoundingClientRect() while writing styles inside the same loop,
         forcing a synchronous reflow per flower. */
      var dir = i % 2 ? 1 : -1;
      var drop = Math.max(40, h - size * 0.5 - (cy + dy));
      var delay = i * FALL_STEP;
      var dur = 0.95 + (i % 5) * 0.09;
      el.style.setProperty("--fall-y", drop.toFixed(1) + "px");
      el.style.setProperty("--fall-x", (dir * (4 + (i * 13) % 26) - dx * 0.1).toFixed(0) + "px");
      el.style.setProperty("--fall-spin", (dir * (90 + (i * 37) % 220)).toFixed(0) + "deg");
      el.style.setProperty("--fall-delay", delay.toFixed(3) + "s");
      el.style.setProperty("--fall-dur", dur.toFixed(2) + "s");

      SPIRAL.push(el);
      frag.appendChild(el);
      spiralEnd = Math.max(spiralEnd, delay + dur);
    }

    bloomStage.appendChild(frag);

    /* once the outermost bloom has landed, the burst is complete */
    return Math.round((EXPAND_S + 0.9) * 1000);
  }

  /* ── 2b · the cascade: every bloom lets go and settles on the floor ─ */
  function startFalling() {
    for (var i = 0; i < SPIRAL.length; i++) SPIRAL[i].classList.add("is-falling");
    bloomStage.classList.add("is-falling");
    if (REDUCED) return 500;
    /* let the cascade land and rest for a beat before the letter arrives */
    return Math.max(1000, Math.round(spiralEnd * 1000) + 520);
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
    /* The top margin reaches back over the whole page above the viewport, so
       photos the visitor has already scrolled past are revealed as well.
       Without it, jumping straight to the bottom (scrollbar drag, End key,
       deep link) flew past the middle frames and stranded them at opacity 0
       for good, because an element that never intersects never fires. */
    var passed = Math.max(2000, document.documentElement.scrollHeight) + "px";
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: passed + " 0px -6% 0px" });
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

    var bloomMs;
    try {
      bloomMs = buildSpiral();
      screenBloom.classList.add("is-active");
      screenBloom.setAttribute("aria-hidden", "false");
    } catch (err) {
      /* whatever happens, never leave the visitor on a blank screen */
      screenBox.classList.remove("is-active", "is-opening");
      goToLetter();
      return;
    }

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

    /* drop the blooms so the renderer is not holding 240 painted layers
       behind the letter for the rest of the visit */
    if (bloomStage.childElementCount) bloomStage.innerHTML = "";
    SPIRAL.length = 0;

    show(screenLetter);
    /* normally already built during idle; build now if the visitor skipped
       straight here before idle time ever arrived */
    if (!gallery.childElementCount) buildGallery();
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

  /* the spiral is measured against the live viewport, so re-seat it if the
     window changes size mid-burst (debounced, and only while blooming) */
  window.addEventListener("resize", function () {
    if (phase !== "bloom") return;
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      if (phase !== "bloom") return;
      try {
        buildSpiral();
      } catch (err) {
        /* keep whatever is already on screen */
      }
    }, 180);
  });

  /* Build the gallery during idle time — after first paint, so it never
     competes with the gift box. The six photos then finish loading long
     before the letter is reached, so nothing pops in or shifts when it
     appears. (The box itself is fetched by the <link rel=preload> in the
     document head.) */
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(buildGallery, { timeout: 2500 });
  } else {
    window.addEventListener("load", function () {
      window.setTimeout(buildGallery, 300);
    });
  }

  buildFlowerDefs();
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
