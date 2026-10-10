/* ═══════════════════════════════════════════════════════════════════════
   photos.js — the polaroid gallery.

   If GIFT.photoDir is set, real photographs are used. Otherwise each
   polaroid gets a hand-built mini scene made from the flower sprites, so
   the page looks finished even before you add your own photos.
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var SIZE = 480;

  /* Colour moods, one per polaroid. [deep, mid, light] */
  var MOODS = [
    ['#3a0d20', '#8c1c3f', '#ffb3cd'],   // dusk rose
    ['#3d1704', '#c2551a', '#ffd08a'],   // golden hour
    ['#7a2247', '#e0709b', '#ffe6ef'],   // blush garden
    ['#140a2e', '#3d2470', '#b3a0ff'],   // night bloom
    ['#7a5a3a', '#dcb489', '#fff8ec'],   // cream morning
    ['#0e2a1c', '#2f6b32', '#b6f0ac']    // deep garden
  ];

  function rgba(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var num = parseInt(h, 16);
    return 'rgba(' + ((num >> 16) & 255) + ',' + ((num >> 8) & 255) + ',' + (num & 255) + ',' + a + ')';
  }

  /* ── one generated "photograph" ───────────────────────────────────── */
  function makeArt(index) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = SIZE;
    var ctx = cv.getContext('2d');
    var rng = Flowers.mulberry32(9001 + index * 977);
    var col = MOODS[index % MOODS.length];

    /* base wash */
    var base = ctx.createLinearGradient(0, 0, SIZE * 0.4, SIZE);
    base.addColorStop(0, col[0]);
    base.addColorStop(0.58, col[1]);
    base.addColorStop(1, col[2]);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, SIZE, SIZE);

    /* warm light source */
    var light = ctx.createRadialGradient(SIZE * 0.52, SIZE * 0.34, 0, SIZE * 0.5, SIZE * 0.5, SIZE * 0.82);
    light.addColorStop(0, rgba(col[2], 0.5));
    light.addColorStop(0.5, rgba(col[2], 0.12));
    light.addColorStop(1, 'rgba(12,2,10,.42)');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, SIZE, SIZE);

    /* bokeh */
    ctx.globalCompositeOperation = 'lighter';
    for (var b = 0; b < 17; b++) {
      var bx = rng() * SIZE;
      var by = rng() * SIZE;
      var br = SIZE * (0.03 + rng() * 0.11);
      var bg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      bg.addColorStop(0, rgba(col[2], 0.3 + rng() * 0.3));
      bg.addColorStop(1, rgba(col[2], 0));
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    /* blurred flowers far behind, crisp ones in front */
    var layers = [
      { count: 3, blur: 9,  size: [0.55, 0.95], alpha: 0.5, kinds: ['rose', 'bloom'] },
      { count: 2, blur: 0,  size: [0.75, 1.25], alpha: 1,   kinds: ['rose', 'bloom'] },
      { count: 2, blur: 0,  size: [0.34, 0.6],  alpha: 1,   kinds: ['filler', 'bloom'] }
    ];

    layers.forEach(function (L) {
      for (var i = 0; i < L.count; i++) {
        var sprite = Flowers.pick(L.kinds[Math.floor(rng() * L.kinds.length)], rng());
        var s = SIZE * (L.size[0] + rng() * (L.size[1] - L.size[0]));
        var x = SIZE * (0.16 + rng() * 0.68);
        var y = SIZE * (0.16 + rng() * 0.68);
        if (L.blur) ctx.filter = 'blur(' + L.blur + 'px)';
        ctx.globalAlpha = L.alpha * (0.72 + rng() * 0.28);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rng() * Math.PI * 2);
        ctx.drawImage(sprite.near, -s / 2, -s / 2, s, s);
        ctx.restore();
        ctx.filter = 'none';
        ctx.globalAlpha = 1;
      }
    });

    /* a scatter of loose petals for movement */
    for (var p = 0; p < 9; p++) {
      var petal = Flowers.pick('petal', rng());
      var ps = SIZE * (0.07 + rng() * 0.13);
      var px = rng() * SIZE;
      var py = rng() * SIZE;
      ctx.globalAlpha = 0.35 + rng() * 0.5;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(rng() * Math.PI * 2);
      ctx.drawImage(petal.near, -ps / 2, -ps / 2, ps, ps);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    /* vignette + grain */
    var vig = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.22, SIZE / 2, SIZE / 2, SIZE * 0.74);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(30,4,18,.5)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.fillStyle = 'rgba(255,255,255,.05)';
    for (var g = 0; g < 130; g++) {
      ctx.fillRect(rng() * SIZE, rng() * SIZE, 1, 1);
    }

    /* a soft highlight so it reads as glossy film */
    var gloss = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    gloss.addColorStop(0, 'rgba(255,255,255,.16)');
    gloss.addColorStop(0.35, 'rgba(255,255,255,0)');
    gloss.addColorStop(1, 'rgba(255,255,255,.05)');
    ctx.fillStyle = gloss;
    ctx.fillRect(0, 0, SIZE, SIZE);

    return cv;
  }

  var EXTS = ['jpg', 'jpeg', 'png', 'webp'];

  /* Try the real photo first; fall back to generated art if it is missing. */
  function realOrArt(index, dir) {
    return new Promise(function (resolve) {
      var i = index + 1;
      var img = new Image();
      var attempt = 0;

      img.onload = function () { resolve(img); };
      img.onerror = function () {
        attempt++;
        if (attempt < EXTS.length) {
          img.src = dir + '/' + i + '.' + EXTS[attempt];
        } else {
          resolve(makeArt(index));
        }
      };

      img.alt = '';
      img.decoding = 'async';
      img.src = dir + '/' + i + '.' + EXTS[0];
    });
  }

  function buildOne(index, dir) {
    return dir ? realOrArt(index, dir) : Promise.resolve(makeArt(index));
  }

  /* Returns a promise of [{ media, caption }] ready to drop into polaroids. */
  function build() {
    var cfg = global.GIFT || {};
    var captions = (cfg.captions || []).slice();
    var dir = cfg.photoDir;
    var count = captions.length || (dir ? 6 : 0);

    var jobs = [];
    for (var i = 0; i < count; i++) jobs.push(buildOne(i, dir));

    return Promise.all(jobs).then(function (media) {
      return media.map(function (el, idx) {
        return { media: el, caption: captions[idx] || '' };
      });
    });
  }

  global.Photos = {
    build: build,
    makeArt: makeArt,
    MOODS: MOODS
  };

})(window);
