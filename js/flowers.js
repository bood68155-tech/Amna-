/* ═══════════════════════════════════════════════════════════════════════
   flowers.js — a tiny procedural flower garden.

   Every flower is described once as SVG (layered petals + gradients),
   then rasterised into an offscreen canvas sprite. Two sizes are kept for
   each flower — a crisp one for near flowers and a pre-blurred one for
   distant flowers — so the tunnel can throw hundreds of blossoms at the
   screen without ever touching a real image file.
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;
  var NEAR_PX = 288;   // crisp sprite resolution
  var FAR_PX  = 144;   // downscaled + blurred, used for depth of field

  /* ── deterministic randomness ─────────────────────────────────────── */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ── petal geometry ───────────────────────────────────────────────────
     Petals are anchored at the origin and grow "up" (negative Y), so a
     layer is just the same path rotated around the flower's centre.      */
  function petalPath(len, wid, shape) {
    var h = len;
    var w = wid;

    if (shape === 'point') {
      // slim, pointed — daisies, lilies, sunflowers
      return 'M0 0 C' + (-w * 0.80) + ' ' + (-h * 0.36) + ' ' +
             (-w * 0.46) + ' ' + (-h * 0.78) + ' 0 ' + (-h) +
             ' C' + (w * 0.46) + ' ' + (-h * 0.78) + ' ' +
             (w * 0.80) + ' ' + (-h * 0.36) + ' 0 0 Z';
    }

    if (shape === 'round') {
      // softly rounded tip — peonies, carnations, tulips
      return 'M0 0 C' + (-w) + ' ' + (-h * 0.54) + ' ' +
             (-w * 0.82) + ' ' + (-h * 1.02) + ' 0 ' + (-h * 1.02) +
             ' C' + (w * 0.82) + ' ' + (-h * 1.02) + ' ' +
             (w) + ' ' + (-h * 0.54) + ' 0 0 Z';
    }

    // 'soft' — the classic rose petal
    return 'M0 0 C' + (-w) + ' ' + (-h * 0.42) + ' ' +
           (-w * 1.02) + ' ' + (-h * 0.90) + ' 0 ' + (-h) +
           ' C' + (w * 1.02) + ' ' + (-h * 0.90) + ' ' +
           (w) + ' ' + (-h * 0.42) + ' 0 0 Z';
  }

  /* ── svg bits ─────────────────────────────────────────────────────── */
  var uid = 0;

  function radialGrad(stops, cx, cy, r) {
    var id = 'fg' + (uid++);
    var s = stops.map(function (st) {
      return '<stop offset="' + st[0] + '" stop-color="' + st[1] +
             '" stop-opacity="' + (st[2] == null ? 1 : st[2]) + '"/>';
    }).join('');
    return {
      id: id,
      markup: '<radialGradient id="' + id + '" cx="' + cx + '" cy="' + cy +
              '" r="' + r + '">' + s + '</radialGradient>'
    };
  }

  function n(v) { return Math.round(v * 100) / 100; }

  /* ── render one flower's body (centred in a `size` box) ───────────── */
  function renderCore(spec, defs, rng) {
    var size = spec.size;
    var c = size / 2;
    var out = [];
    var stroke = spec.stroke === undefined ? 'rgba(70,8,32,.09)' : spec.stroke;
    var sw = spec.sw === undefined ? 1.7 : spec.sw;

    /* optional greenery sitting behind the petals */
    if (spec.calyx) {
      var cg = radialGrad([['0', '#2f6b32'], ['1', '#123f1a']], 0.5, 1, 1);
      defs.push(cg.markup);
      var cd = petalPath(spec.calyx.len, spec.calyx.len * 0.30, 'point');
      for (var k = 0; k < spec.calyx.count; k++) {
        var ca = (k * 360) / spec.calyx.count + 14;
        out.push('<g transform="translate(' + c + ' ' + c + ') rotate(' + ca + ')">' +
                 '<path d="' + cd + '" fill="url(#' + cg.id + ')" opacity=".95"/></g>');
      }
    }

    /* the petals themselves, back layer first */
    spec.layers.forEach(function (L) {
      var g = radialGrad(L.stops, 0.5, 0.94, 0.98);
      defs.push(g.markup);

      var wid = L.len * L.w;
      var d = petalPath(L.len, wid, L.shape || 'soft');
      var count = L.count;
      var step = 360 / count;
      var jitter = L.jitter || 0;

      for (var i = 0; i < count; i++) {
        var a = (L.rot || 0) + i * step + (jitter ? (rng() - 0.5) * jitter : 0);
        var sc = L.scale ? L.scale[0] + rng() * (L.scale[1] - L.scale[0]) : 1;
        out.push('<g transform="translate(' + c + ' ' + c + ') rotate(' + n(a) + ') scale(' + n(sc) + ')">' +
                 '<path d="' + d + '" fill="url(#' + g.id + ')"' +
                 (stroke ? ' stroke="' + stroke + '" stroke-width="' + sw + '"' : '') +
                 (L.opacity == null ? '' : ' opacity="' + L.opacity + '"') +
                 '/></g>');
      }
    });

    /* the centre of the flower */
    if (spec.center) {
      var C = spec.center;
      var fill;
      if (C.stops) {
        var cgn = radialGrad(C.stops, 0.5, 0.42, 0.62);
        defs.push(cgn.markup);
        fill = 'url(#' + cgn.id + ')';
      } else {
        fill = C.fill;
      }
      out.push('<circle cx="' + c + '" cy="' + c + '" r="' + C.r + '" fill="' + fill + '"/>');

      if (C.dots) {
        var dcol = C.dotColors || ['rgba(0,0,0,.34)', 'rgba(255,255,255,.20)'];
        for (var q = 0; q < C.dots; q++) {
          var ang = rng() * TAU;
          var rad = Math.sqrt(rng()) * C.r * 0.86;
          var dr = 0.9 + rng() * (C.r * 0.055);
          out.push('<circle cx="' + n(c + Math.cos(ang) * rad) + '" cy="' + n(c + Math.sin(ang) * rad) +
                   '" r="' + n(dr) + '" fill="' + (rng() < 0.62 ? dcol[0] : dcol[1]) + '"/>');
        }
      }
    }

    /* lily-style stamens */
    if (spec.stamens) {
      var cols = spec.stamens.colors || ['#e8b84b', '#c98a1e'];
      for (var s = 0; s < spec.stamens.count; s++) {
        var sa = (rng() - 0.5) * 300 + 90;
        var L2 = spec.stamens.len * (0.72 + rng() * 0.4);
        var tx = c + Math.cos(sa * Math.PI / 180) * L2;
        var ty = c + Math.sin(sa * Math.PI / 180) * L2;
        out.push('<line x1="' + c + '" y1="' + c + '" x2="' + n(tx) + '" y2="' + n(ty) +
                 '" stroke="' + cols[1] + '" stroke-width="1.9" opacity=".85"/>' +
                 '<circle cx="' + n(tx) + '" cy="' + n(ty) + '" r="2.5" fill="' + cols[0] + '"/>');
      }
    }

    return out.join('');
  }

  /* Gradient definitions collected while rendering the current flower. */
  var defs = [];

  /* ── build a full square SVG for one definition ───────────────────── */
  function buildSVG(spec, seed) {
    var rng = mulberry32(seed);
    defs = [];

    // Work out how much room the petals need, then pad the canvas.
    var maxLen = 0;
    spec.layers.forEach(function (L) {
      var reach = L.len * (L.shape === 'round' ? 1.02 : 1);
      if (reach > maxLen) maxLen = reach;
    });
    if (spec.calyx) maxLen = Math.max(maxLen, spec.calyx.len);

    var cluster = spec.mini && spec.mini > 1;
    var size = Math.ceil(maxLen * 2.16 * (cluster ? 1.85 : 1));
    var c = size / 2;

    var inner = renderCore({
      size: size, layers: spec.layers, center: spec.center,
      calyx: spec.calyx, stamens: spec.stamens,
      stroke: spec.stroke, sw: spec.sw
    }, defs, rng);

    var body;
    if (cluster) {
      var parts = [];
      for (var i = 0; i < spec.mini; i++) {
        var th = rng() * TAU;
        var rad = (0.04 + rng() * 0.24) * size;
        var s = 0.28 + rng() * 0.3;
        var x = c + Math.cos(th) * rad;
        var y = c + Math.sin(th) * rad * 0.92;
        parts.push('<g transform="translate(' + n(x) + ' ' + n(y) + ') scale(' + n(s) + ') rotate(' +
                   n(rng() * 360) + ') translate(' + (-c) + ' ' + (-c) + ')">' + inner + '</g>');
      }
      body = parts.join('');
    } else {
      body = inner;
    }

    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
           '" viewBox="0 0 ' + size + ' ' + size + '"><defs>' + defs.join('') + '</defs>' + body + '</svg>';
  }

  /* ── flower recipes ───────────────────────────────────────────────── */
  function rose(deep, mid, tip, core) {
    return {
      layers: [
        { count: 7, len: 98, w: 0.60, shape: 'soft', rot: 0,  stops: [['0', deep], ['0.5', mid], ['1', tip]] },
        { count: 7, len: 86, w: 0.62, shape: 'soft', rot: 26, stops: [['0', deep], ['0.45', mid], ['1', tip]], opacity: 0.97, jitter: 5 },
        { count: 6, len: 68, w: 0.64, shape: 'soft', rot: 13, stops: [['0', core], ['0.5', mid], ['1', tip]] },
        { count: 5, len: 50, w: 0.70, shape: 'soft', rot: 41, stops: [['0', core], ['0.6', mid], ['1', mid]], jitter: 7 },
        { count: 4, len: 32, w: 0.78, shape: 'soft', rot: 9,  stops: [['0', core], ['1', deep]] }
      ],
      center: { r: 13, fill: core }
    };
  }

  function peony() {
    return {
      layers: [
        { count: 11, len: 92, w: 0.78, shape: 'round', rot: 0,  stops: [['0', '#d75e8c'], ['1', '#ffd6e4']], jitter: 8 },
        { count: 11, len: 74, w: 0.82, shape: 'round', rot: 17, stops: [['0', '#b43a66'], ['1', '#ffc2d8']], jitter: 9 },
        { count: 10, len: 54, w: 0.88, shape: 'round', rot: 6,  stops: [['0', '#8e2350'], ['1', '#ff9dbe']], jitter: 10 },
        { count: 8,  len: 34, w: 0.95, shape: 'round', rot: 30, stops: [['0', '#7a1c44'], ['1', '#ff8fb4']] }
      ],
      center: { r: 10, fill: '#8e2350' }
    };
  }

  function carnation(deep, mid) {
    return {
      layers: [
        { count: 12, len: 84, w: 0.66, shape: 'round', rot: 0,  stops: [['0', deep], ['1', mid]], jitter: 11 },
        { count: 12, len: 70, w: 0.74, shape: 'round', rot: 15, stops: [['0', deep], ['1', mid]], jitter: 13 },
        { count: 11, len: 52, w: 0.86, shape: 'round', rot: 5,  stops: [['0', deep], ['1', mid]], jitter: 12 },
        { count: 9,  len: 34, w: 0.98, shape: 'round', rot: 26, stops: [['0', deep], ['1', mid]], jitter: 10 }
      ],
      center: { r: 9, fill: deep }
    };
  }

  var DEFS = [
    /* ── roses ── */
    { name: 'rose-crimson', kind: 'rose',   seed: 101,
      spec: rose('#5a0417', '#b7123c', '#ff7fa3', '#3a0210') },
    { name: 'rose-pink',    kind: 'rose',   seed: 202,
      spec: rose('#a83263', '#ff7aa8', '#ffe0ec', '#7a1f45') },
    { name: 'rose-cream',   kind: 'rose',   seed: 303,
      spec: rose('#c39a6d', '#f4ddc4', '#fffaf4', '#9c7550') },
    { name: 'rose-coral',   kind: 'rose',   seed: 404,
      spec: rose('#9c1c30', '#ff6a55', '#ffc9ad', '#660d1e') },

    /* ── garden flowers ── */
    { name: 'peony', kind: 'bloom', seed: 505, spec: peony() },
    { name: 'carnation', kind: 'bloom', seed: 606, spec: carnation('#5c0a1e', '#ef5f7f') },
    { name: 'marigold', kind: 'bloom', seed: 707, spec: {
        layers: [
          { count: 14, len: 84, w: 0.62, shape: 'round', rot: 0,  stops: [['0', '#d97706'], ['1', '#fde047']], jitter: 10 },
          { count: 12, len: 64, w: 0.70, shape: 'round', rot: 12, stops: [['0', '#b45309'], ['1', '#fbbf24']], jitter: 12 },
          { count: 10, len: 44, w: 0.80, shape: 'round', rot: 4,  stops: [['0', '#92400e'], ['1', '#f59e0b']] }
        ],
        center: { r: 12, fill: '#8a4a10' }
      } },
    { name: 'sunflower', kind: 'bloom', seed: 808, spec: {
        layers: [
          { count: 26, len: 104, w: 0.20, shape: 'point', rot: 0,   stops: [['0', '#f08a0c'], ['1', '#ffd54a']] },
          { count: 24, len: 78,  w: 0.21, shape: 'point', rot: 7.5, stops: [['0', '#e07600'], ['1', '#ffc42e']] }
        ],
        center: { r: 38, stops: [['0', '#6b4423'], ['0.6', '#43280f'], ['1', '#241305']], dots: 52 }
      } },
    { name: 'daisy', kind: 'bloom', seed: 909, spec: {
        layers: [
          { count: 18, len: 96, w: 0.17, shape: 'point', rot: 0,  stops: [['0', '#efe4ff'], ['1', '#ffffff']] },
          { count: 18, len: 76, w: 0.16, shape: 'point', rot: 10, stops: [['0', '#e9dcff'], ['1', '#fffafd']], opacity: 0.95 }
        ],
        center: { r: 27, stops: [['0', '#ffe680'], ['0.55', '#f5b323'], ['1', '#d9820f']], dots: 22 }
      } },
    { name: 'tulip', kind: 'bloom', seed: 1010, spec: {
        layers: [
          { count: 3, len: 106, w: 0.58, shape: 'round', rot: 0,  stops: [['0', '#7a1f52'], ['1', '#e072a4']] },
          { count: 3, len: 94,  w: 0.54, shape: 'round', rot: 60, stops: [['0', '#9c2a63'], ['1', '#ff9dc4']] },
          { count: 3, len: 76,  w: 0.50, shape: 'round', rot: 30, stops: [['0', '#6d1946'], ['1', '#f2779f']], opacity: 0.92 }
        ],
        center: { r: 9, fill: '#5c1439' }
      } },
    { name: 'lily', kind: 'bloom', seed: 1111, spec: {
        layers: [
          { count: 6, len: 116, w: 0.30, shape: 'point', rot: 0,  stops: [['0', '#efc6ba'], ['1', '#fffdfa']] },
          { count: 6, len: 94,  w: 0.26, shape: 'point', rot: 30, stops: [['0', '#e0a99c'], ['1', '#fff8f4']], opacity: 0.95 }
        ],
        center: { r: 8, fill: '#c98a1e' },
        stamens: { count: 6, len: 52 }
      } },
    { name: 'anemone', kind: 'bloom', seed: 1212, spec: {
        layers: [
          { count: 9, len: 92, w: 0.58, shape: 'soft', rot: 0,  stops: [['0', '#5b21b6'], ['1', '#c4b5fd']], jitter: 5 },
          { count: 8, len: 72, w: 0.64, shape: 'soft', rot: 22, stops: [['0', '#4c1d95'], ['1', '#a78bfa']], jitter: 6 },
          { count: 6, len: 50, w: 0.72, shape: 'soft', rot: 10, stops: [['0', '#3b1078'], ['1', '#8b5cf6']] }
        ],
        center: { r: 17, stops: [['0', '#2a1163'], ['1', '#120633']], dots: 26 }
      } },
    { name: 'forget-me-not', kind: 'bloom', seed: 1313, spec: {
        layers: [
          { count: 5, len: 78, w: 0.82, shape: 'round', rot: 0,  stops: [['0', '#6d8ee8'], ['1', '#d3e0ff']] },
          { count: 5, len: 60, w: 0.86, shape: 'round', rot: 36, stops: [['0', '#4f6fd1'], ['1', '#b3c7ff']] }
        ],
        center: { r: 14, stops: [['0', '#ffe680'], ['1', '#dda000']] }
      } },

    /* ── filler: the little things that make it feel like a real garden ── */
    { name: 'gypsophila', kind: 'filler', seed: 1414, spec: {
        mini: 11,
        layers: [
          { count: 5, len: 46, w: 0.95, shape: 'round', rot: 0, stops: [['0', '#ffffff'], ['1', '#fff2f8']] }
        ],
        center: { r: 5, fill: '#f6e2b8' }
      } },
    { name: 'foliage', kind: 'filler', seed: 1515, spec: {
        // leaves radiating from the centre, so the sprite actually fills its
        // box and the greenery reads at speed in the tunnel
        layers: [
          { count: 7, len: 118, w: 0.30, shape: 'point', rot: 0, jitter: 16, scale: [0.62, 1],
            stops: [['0', '#8bd06d'], ['0.5', '#47a845'], ['1', '#1c6425']] },
          { count: 5, len: 78, w: 0.34, shape: 'point', rot: 27, jitter: 18, scale: [0.6, 0.95],
            stops: [['0', '#6cbb58'], ['1', '#17571f']] }
        ],
        stroke: 'rgba(6,40,14,.16)'
      } },

    /* ── single petals, used for the drifting petal field ── */
    { name: 'petal-blush', kind: 'petal', seed: 1616, spec: {
        layers: [
          { count: 1, len: 100, w: 0.66, shape: 'soft', rot: 0, stops: [['0', '#ffd0e0'], ['1', '#fff6fa']] }
        ]
      } },
    { name: 'petal-rose', kind: 'petal', seed: 1717, spec: {
        layers: [
          { count: 1, len: 100, w: 0.62, shape: 'soft', rot: 0, stops: [['0', '#c7406b'], ['1', '#ff9dbe']] }
        ]
      } },
    { name: 'petal-cream', kind: 'petal', seed: 1818, spec: {
        layers: [
          { count: 1, len: 100, w: 0.70, shape: 'soft', rot: 0, stops: [['0', '#e9c9a4'], ['1', '#fffdf7']] }
        ]
      } }
  ];

  /* ── rasterisation ────────────────────────────────────────────────── */
  function svgToCanvas(svg, px) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var cv = document.createElement('canvas');
        cv.width = px;
        cv.height = px;
        cv.getContext('2d').drawImage(img, 0, 0, px, px);
        resolve(cv);
      };
      img.onerror = function () { reject(new Error('sprite could not be decoded')); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }

  function blurDown(src, px, blurPx) {
    var cv = document.createElement('canvas');
    cv.width = px;
    cv.height = px;
    var ctx = cv.getContext('2d');
    try { ctx.filter = 'blur(' + blurPx + 'px)'; } catch (e) { /* filter unsupported */ }
    ctx.drawImage(src, 0, 0, px, px);
    try { ctx.filter = 'none'; } catch (e) { /* noop */ }
    return cv;
  }

  /* Last-resort flower so the page still blooms if SVG decoding fails. */
  function fallbackCanvas(seed, px) {
    var rng = mulberry32(seed);
    var cv = document.createElement('canvas');
    cv.width = cv.height = px;
    var ctx = cv.getContext('2d');
    var c = px / 2;
    var hues = [340, 350, 20, 45, 300];
    var hue = hues[Math.floor(rng() * hues.length)];
    for (var ring = 3; ring >= 1; ring--) {
      var petals = 6 + ring * 3;
      var len = (px / 2) * (0.34 + ring * 0.2);
      for (var i = 0; i < petals; i++) {
        var a = (i / petals) * TAU;
        ctx.save();
        ctx.translate(c, c);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, -len / 2, len * 0.24, len / 2, 0, 0, TAU);
        ctx.fillStyle = 'hsl(' + hue + ',' + (58 + ring * 9) + '%,' + (38 + ring * 13) + '%)';
        ctx.globalAlpha = 0.72 + ring * 0.08;
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(c, c, px * 0.09, 0, TAU);
    ctx.fillStyle = 'hsl(' + hue + ',70%,26%)';
    ctx.fill();
    return cv;
  }

  /* ── public API ───────────────────────────────────────────────────── */
  var list = [];

  function build() {
    var jobs = DEFS.map(function (def) {
      return function () {
        var svg = buildSVG(def.spec, def.seed);

        return svgToCanvas(svg, NEAR_PX)
          .catch(function () {
            // graceful degradation — draw it with the 2D API instead
            var canvases = fallbackCanvas(def.seed, NEAR_PX);
            return canvases;
          })
          .then(function (near) {
            list.push({
              name: def.name,
              kind: def.kind,
              near: near,
              far: blurDown(near, FAR_PX, 5.5)
            });
          });
      };
    });

    // Build sequentially so we are never rasterising a dozen SVGs at once.
    return jobs.reduce(function (chain, job) {
      return chain.then(job);
    }, Promise.resolve()).then(function () {
      list.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
      return list;
    });
  }

  function byKind(kind) {
    return list.filter(function (s) { return s.kind === kind; });
  }

  function pick(kind, r) {
    var pool = byKind(kind);
    if (!pool.length) return list[0];
    return pool[Math.floor(r * pool.length) % pool.length];
  }

  function draw(ctx, sprite, x, y, size, rot, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    if (rot) {
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.drawImage(sprite.near, -size / 2, -size / 2, size, size);
    } else {
      ctx.drawImage(sprite.near, x - size / 2, y - size / 2, size, size);
    }
    ctx.restore();
  }

  global.Flowers = {
    build: build,
    list: list,          // filled in place once build() resolves
    byKind: byKind,
    pick: pick,
    draw: draw,
    mulberry32: mulberry32
  };

})(window);
