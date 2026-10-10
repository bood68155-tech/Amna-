/* ═══════════════════════════════════════════════════════════════════════
   tunnel.js — the flower tunnel.

   Flowers live on concentric helical shells stretching 7,400 units into the
   distance. The camera flies forward while the whole tube rolls, and during
   the finale the shells expand outward and the light blows out into a warm
   white bloom.

   All the maths is done in world units and projected with a single
   `focal / depth` term, then handed to the canvas as one composed transform
   per flower — no DOM, no layout, no per-flower save/restore.

   The forward travel and the roll are sampled from curves precomputed over
   the timeline, so the animation lands exactly on its finale no matter what
   frame rate the visitor's machine manages.

   The same canvas doubles as the drifting petal field behind the letter.
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;

  /* ── world constants ──────────────────────────────────────────────── */
  var NEAR = 110;         // closest a flower may get before it wraps
  var SPAN = 7400;        // depth of the tube
  var FADE_NEAR = 170;    // flowers dissolve as they reach the lens
  var FADE_FULL = 640;
  var FAR_FADE_A = 3100;  // and again at the far end, into fog
  var FAR_FADE_B = 7000;

  /* ── the three concentric shells ──────────────────────────────────── */
  var LAYERS = [
    { // outer ring: greenery and small blossoms framing the view
      weight: 0.44,
      rMin: 330, rMax: 720,
      sMin: 80,  sMax: 165,
      twist: 0.00042, spin: 0.26,
      alpha: 0.95, blend: 'source-over',
      kinds: ['foliage', 'foliage', 'foliage', 'foliage', 'foliage', 'gypsophila', 'gypsophila',
              'rose-pink', 'rose-crimson', 'peony', 'daisy', 'carnation',
              'marigold', 'tulip', 'anemone']
    },
    { // the roses you fly through
      weight: 0.33,
      rMin: 165, rMax: 445,
      sMin: 130, sMax: 250,
      twist: 0.00030, spin: -0.20,
      alpha: 1, blend: 'source-over',
      kinds: ['rose-crimson', 'rose-crimson', 'rose-pink', 'rose-pink', 'rose-coral',
              'rose-cream', 'peony', 'carnation', 'sunflower', 'daisy', 'lily', 'tulip']
    },
    { // inner sparkle: petals whipping past the lens
      weight: 0.23,
      rMin: 30, rMax: 175,
      sMin: 50,  sMax: 120,
      twist: -0.00058, spin: 0.52,
      alpha: 0.7, blend: 'lighter',
      kinds: ['petal-rose', 'petal-rose', 'petal-blush', 'petal-cream', 'daisy', 'rose-pink']
    }
  ];

  var BASE_COUNT = 720;   // tuned up/down with viewport size
  var CURVE_N = 1200;     // resolution of the precomputed motion curves

  /* ── small maths helpers ──────────────────────────────────────────── */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function span01(p, a, b) { return clamp01((p - a) / (b - a)); }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeIn(t) { return t * t * t; }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ═══════════════════════════════════════════════════════════════════
     the engine
     ═══════════════════════════════════════════════════════════════════ */
  var T = {
    canvas: null,
    ctx: null,
    dpr: 1,
    w: 0,
    h: 0,

    mode: 'idle',          // idle | tunnel | petals
    running: false,
    raf: 0,
    lastTime: 0,
    elapsed: 0,

    sprites: [],
    byName: {},

    shells: [],            // one bucket per layer
    petalField: [],        // the drifting petals behind the letter

    camZ: 0,
    roll: 0,
    focal: 880,
    bloom: 0,

    t0: 0,
    duration: 9000,
    curves: null,
    _resolve: null,
    _paused: false,
    _accum: 0,

    bgGrad: null,
    bloomGrad: null,
    coreGrad: null,
    creamGrad: null
  };

  /* ── setup ────────────────────────────────────────────────────────── */
  T.mount = function (canvas, sprites) {
    T.canvas = canvas;
    T.ctx = canvas.getContext('2d', { alpha: false });
    T.sprites = sprites || [];
    T.byName = {};
    T.sprites.forEach(function (s) { T.byName[s.name] = s; });

    T.resize();
    global.addEventListener('resize', T.resize);
    global.addEventListener('orientationchange', function () {
      setTimeout(T.resize, 250);
    });

    document.addEventListener('visibilitychange', function () {
      T._paused = !!document.hidden;
      if (!T._paused) T.lastTime = performance.now();
    });
  };

  T.resize = function () {
    if (!T.canvas) return;
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var w = global.innerWidth;
    var h = global.innerHeight;

    T.dpr = dpr;
    T.w = w;
    T.h = h;
    T.canvas.width = Math.max(1, Math.round(w * dpr));
    T.canvas.height = Math.max(1, Math.round(h * dpr));

    T.buildGradients();
    T.buildShells();
    T.buildPetals();
  };

  T.buildGradients = function () {
    var ctx = T.ctx;
    var W = T.canvas.width;
    var H = T.canvas.height;

    // deep rose darkness that the flowers fly out of — warm, never cold
    T.bgGrad = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.72);
    T.bgGrad.addColorStop(0, '#3d0e16');
    T.bgGrad.addColorStop(0.34, '#24070b');
    T.bgGrad.addColorStop(1, '#0c0104');

    // a tighter pool of warm light so blossoms still read through the glow
    T.coreGrad = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, Math.min(W, H) * 0.46);
    T.coreGrad.addColorStop(0, 'rgba(255,228,214,.9)');
    T.coreGrad.addColorStop(0.45, 'rgba(255,140,150,.22)');
    T.coreGrad.addColorStop(1, 'rgba(150,26,52,0)');

    // the warm light waiting at the end of the tunnel
    T.bloomGrad = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.78);
    T.bloomGrad.addColorStop(0, 'rgba(255,255,255,1)');
    T.bloomGrad.addColorStop(0.28, 'rgba(255,238,229,.78)');
    T.bloomGrad.addColorStop(0.58, 'rgba(255,166,175,.36)');
    T.bloomGrad.addColorStop(1, 'rgba(178,52,88,0)');

    // the letter screen's soft paper light
    T.creamGrad = ctx.createRadialGradient(W * 0.5, H * 0.16, 0, W * 0.5, H * 0.5, Math.max(W, H) * 1.05);
    T.creamGrad.addColorStop(0, '#ffe9f1');
    T.creamGrad.addColorStop(0.42, '#fff5f0');
    T.creamGrad.addColorStop(1, '#ffe3ec');
  };

  /* ── particles ────────────────────────────────────────────────────── */

  /* Greenery and baby's breath read too small at their nominal size, so the
     background layers get a little extra reach from them. */
  function spriteScale(sprite) {
    if (!sprite) return 1;
    if (sprite.name === 'foliage') return 1.7;
    if (sprite.kind === 'filler') return 1.2;
    if (sprite.kind === 'petal') return 0.9;
    return 1;
  }

  function spritePicker(kinds) {
    return function (rng) {
      var name = kinds[Math.floor(rng() * kinds.length) % kinds.length];
      return T.byName[name] || T.sprites[0];
    };
  }

  T.buildShells = function () {
    if (!T.sprites.length) return;

    var scale = 1;
    if (T.w < 760) scale = 0.66;
    else if (T.w < 1100) scale = 0.84;

    T.shells = LAYERS.map(function (L, li) {
      var rng = global.Flowers.mulberry32(4242 + li * 131);
      var pick = spritePicker(L.kinds);
      var count = Math.round(BASE_COUNT * L.weight * scale);
      var items = new Array(count);

      for (var i = 0; i < count; i++) {
        var sprite = pick(rng);
        items[i] = {
          z: rng() * SPAN,
          r: lerp(L.rMin, L.rMax, rng()),
          theta: rng() * TAU,
          size: lerp(L.sMin, L.sMax, rng()) * spriteScale(sprite),
          sprite: sprite,
          rot: rng() * TAU,
          rotV: (rng() - 0.5) * 0.85,
          twist: L.twist * (0.55 + rng() * 0.9),
          spin: L.spin * (0.7 + rng() * 0.6),
          alpha: L.alpha * (0.74 + rng() * 0.26),
          /* scratch slots, rewritten every frame so we never allocate */
          _dz: 0, _x: 0, _y: 0, _sz: 0, _a: 0, _r: 0, _bmp: null
        };
      }

      return { cfg: L, items: items, visible: [] };
    });
  };

  T.buildPetals = function () {
    if (!T.sprites.length) return;
    var rng = global.Flowers.mulberry32(777);
    var count = T.w < 760 ? 34 : 58;
    var pick = spritePicker(['petal', 'petal', 'petal', 'bloom', 'rose']);

    T.petalField = new Array(count);
    for (var i = 0; i < count; i++) {
      T.petalField[i] = {
        x: rng() * T.w,
        y: rng() * T.h,
        vy: 14 + rng() * 34,
        sway: 20 + rng() * 46,
        phase: rng() * TAU,
        size: 16 + rng() * 40,
        sprite: pick(rng),
        rot: rng() * TAU,
        rotV: (rng() - 0.5) * 1.5,
        alpha: 0.24 + rng() * 0.5
      };
    }
  };

  /* ═══════════════════════════════════════════════════════════════════
     the timeline — everything is a function of progress 0 → 1
     ═══════════════════════════════════════════════════════════════════ */
  T.timeline = function (p) {
    var speed;
    if (p < 0.12) {
      speed = lerp(420, 1750, easeOut(span01(p, 0, 0.12)));
    } else if (p < 0.58) {
      speed = lerp(1750, 2050, span01(p, 0.12, 0.58));
    } else if (p < 0.82) {
      speed = lerp(2050, 3050, smooth(span01(p, 0.58, 0.82)));
    } else {
      speed = lerp(3050, 4600, easeIn(span01(p, 0.82, 1)));
    }

    var rollSpeed = lerp(0.16, 2.1, easeIn(span01(p, 0.05, 0.9)));
    if (p > 0.78) rollSpeed *= 1 + span01(p, 0.78, 1) * 3.4;

    return {
      speed: speed,
      rollSpeed: rollSpeed,
      expand: 1 + easeIn(span01(p, 0.5, 1)) * 1.35,
      focal: 880 + span01(p, 0.2, 1) * 300,
      bloom: Math.pow(span01(p, 0.84, 1), 1.5),
      fade: easeOut(span01(p, 0, 0.07))
    };
  };

  /* Integrate speed and rollSpeed once per duration so the camera's travel
     is a pure function of progress — no drift if frames are dropped. */
  function buildCurves(durationMs) {
    var dist = new Float64Array(CURVE_N + 1);
    var roll = new Float64Array(CURVE_N + 1);
    var step = 1 / CURVE_N;

    for (var i = 1; i <= CURVE_N; i++) {
      var mid = (i - 0.5) * step;
      var tl = T.timeline(mid);
      dist[i] = dist[i - 1] + tl.speed * step;
      roll[i] = roll[i - 1] + tl.rollSpeed * step;
    }

    var seconds = durationMs / 1000;
    for (var j = 0; j <= CURVE_N; j++) {
      dist[j] *= seconds;   // world units
      roll[j] *= seconds;   // radians
    }

    T.curves = { dist: dist, roll: roll };
  }

  function sampleCurve(arr, p) {
    var x = clamp01(p) * CURVE_N;
    var i = Math.floor(x);
    if (i >= CURVE_N) return arr[CURVE_N];
    return arr[i] + (arr[i + 1] - arr[i]) * (x - i);
  }

  /* ═══════════════════════════════════════════════════════════════════
     rendering
     ═══════════════════════════════════════════════════════════════════ */
  function drawTunnel(tl, camZ, roll) {
    var ctx = T.ctx;
    var dpr = T.dpr;
    var W = T.canvas.width;
    var H = T.canvas.height;
    var cx = T.w / 2;
    var cy = T.h / 2;
    var t = T.elapsed;

    /* background */
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = T.bgGrad;
    ctx.fillRect(0, 0, W, H);

    /* ── flowers, one shell at a time ── */
    for (var li = 0; li < T.shells.length; li++) {
      var shell = T.shells[li];
      var cfg = shell.cfg;
      var items = shell.items;
      var vis = shell.visible;
      vis.length = 0;

      for (var i = 0; i < items.length; i++) {
        var p = items[i];

        /* wrap the depth into [NEAR, SPAN + NEAR) — a plain single `+= SPAN`
           is not enough once camZ sits near the end of the span. */
        var dz = p.z - camZ;
        dz -= Math.floor(dz / SPAN) * SPAN;
        if (dz < NEAR) dz += SPAN;

        var s = tl.focal / dz;
        var sz = p.size * s;
        if (sz < 2.5) continue;

        var theta = p.theta + p.twist * p.z + roll + t * p.spin;
        var x = cx + Math.cos(theta) * p.r * tl.expand * s;
        var y = cy + Math.sin(theta) * p.r * tl.expand * s;

        if (x + sz * 0.5 < -60 || x - sz * 0.5 > T.w + 60) continue;
        if (y + sz * 0.5 < -60 || y - sz * 0.5 > T.h + 60) continue;

        var a = clamp01((dz - FADE_NEAR) / (FADE_FULL - FADE_NEAR));
        a *= 1 - clamp01((dz - FAR_FADE_A) / (FAR_FADE_B - FAR_FADE_A));
        a *= p.alpha * tl.fade;
        if (a <= 0.012) continue;

        p._dz = dz;
        p._x = x;
        p._y = y;
        p._sz = sz;
        p._a = a;
        p._r = p.rot + t * p.rotV;
        p._bmp = sz < 82 ? p.sprite.far : p.sprite.near;

        vis.push(p);
      }

      /* painter's algorithm: far flowers first */
      vis.sort(function (a2, b2) { return b2._dz - a2._dz; });

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = cfg.blend;

      for (var v = 0; v < vis.length; v++) {
        var q = vis[v];
        var bmp = q._bmp;
        var k = (q._sz / bmp.width) * dpr;
        var cos = Math.cos(q._r) * k;
        var sin = Math.sin(q._r) * k;

        ctx.setTransform(cos, sin, -sin, cos, q._x * dpr, q._y * dpr);
        ctx.globalAlpha = q._a;
        ctx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
      }
    }

    /* ── the light at the end ── */
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';

    // a soft glow so the middle of the tube never goes flat — kept gentle and
    // tight so the individual blossoms still read through it
    ctx.globalAlpha = 0.42 * tl.fade + tl.bloom * 0.45;
    ctx.fillStyle = T.coreGrad;
    ctx.fillRect(0, 0, W, H);

    /* rotating light rays during the finale */
    if (tl.bloom > 0.001) {
      var R = Math.max(W, H) * 0.78;
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(roll * 0.55);
      ctx.fillStyle = 'rgba(255,236,230,1)';
      for (var ray = 0; ray < 18; ray++) {
        ctx.rotate(TAU / 18);
        ctx.globalAlpha = 0.05 * tl.bloom * (0.35 + 0.65 * Math.abs(Math.sin(ray * 2.1 + t * 1.4)));
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(R * 0.055, -R);
        ctx.lineTo(R * 0.012, -R);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    if (tl.bloom > 0.001) {
      ctx.globalAlpha = tl.bloom;
      ctx.fillStyle = T.bloomGrad;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawPetals(dt) {
    var ctx = T.ctx;
    var dpr = T.dpr;
    var W = T.canvas.width;
    var H = T.canvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = T.creamGrad;
    ctx.fillRect(0, 0, W, H);

    for (var i = 0; i < T.petalField.length; i++) {
      var p = T.petalField[i];

      p.phase += dt * 0.75;
      p.y += p.vy * dt;
      p.rot += p.rotV * dt;
      p.x += Math.sin(p.phase) * p.sway * dt;

      if (p.y - p.size > T.h + 60) {
        p.y = -p.size - Math.random() * 160;
        p.x = Math.random() * T.w;
      }
      if (p.x < -80) p.x = T.w + 60;
      if (p.x > T.w + 80) p.x = -60;

      var bmp = p.sprite.near;
      var k = (p.size / bmp.width) * dpr;
      var cos = Math.cos(p.rot) * k;
      var sin = Math.sin(p.rot) * k;

      ctx.setTransform(cos, sin, -sin, cos, p.x * dpr, p.y * dpr);
      ctx.globalAlpha = p.alpha * (0.72 + 0.28 * Math.sin(p.phase * 1.7));
      ctx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  /* ═══════════════════════════════════════════════════════════════════
     the frame loop
     ═══════════════════════════════════════════════════════════════════ */
  function frame(now) {
    T.raf = global.requestAnimationFrame(frame);
    if (!T.running || T._paused) { T.lastTime = now; return; }

    var dt = T.lastTime ? (now - T.lastTime) / 1000 : 0.016;
    T.lastTime = now;
    dt = Math.min(Math.max(dt, 0), 0.05);
    T.elapsed += dt;

    if (T.mode === 'tunnel') {
      var prog = clamp01((now - T.t0) / T.duration);
      var tl = T.timeline(prog);

      T.camZ = sampleCurve(T.curves.dist, prog) % SPAN;
      T.roll = sampleCurve(T.curves.roll, prog);
      T.focal = tl.focal;
      T.bloom = tl.bloom;

      drawTunnel(tl, T.camZ, T.roll);

      if (T._resolve && prog >= 1) {
        var done = T._resolve;
        T._resolve = null;
        done();
      }
    } else if (T.mode === 'petals') {
      // the letter screen doesn't need 60fps
      T._accum += dt;
      if (T._accum >= 1 / 32) {
        drawPetals(T._accum);
        T._accum = 0;
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     public API
     ═══════════════════════════════════════════════════════════════════ */
  T.play = function (duration) {
    T.duration = duration || 9000;
    T.buildShells();
    buildCurves(T.duration);

    T.mode = 'tunnel';
    T.camZ = 0;
    T.roll = 0;
    T.bloom = 0;
    T.elapsed = 0;
    T._accum = 0;
    T.t0 = performance.now();
    T.lastTime = performance.now();

    if (!T.running) {
      T.running = true;
      T.raf = global.requestAnimationFrame(frame);
    }

    return new Promise(function (resolve) { T._resolve = resolve; });
  };

  T.petals = function () {
    T.buildPetals();
    T.mode = 'petals';
    T.lastTime = performance.now();
    if (!T.running) {
      T.running = true;
      T.raf = global.requestAnimationFrame(frame);
    }
  };

  T.skip = function () {
    if (T.mode === 'tunnel') T.t0 = performance.now() - T.duration * 0.99;
  };

  T.clear = function () {
    if (!T.ctx) return;
    T.mode = 'idle';
    T.ctx.setTransform(1, 0, 0, 1, 0, 0);
    T.ctx.globalAlpha = 1;
    T.ctx.clearRect(0, 0, T.canvas.width, T.canvas.height);
  };

  T.halt = function () {
    T.running = false;
    if (T.raf) global.cancelAnimationFrame(T.raf);
    T.raf = 0;
  };

  global.Tunnel = T;

})(window);
