/* ═══════════════════════════════════════════════════════════════════════
   app.js — the flow:  gift  →  flower tunnel  →  letter
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var CFG = global.GIFT || {};
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

  function $(id) { return document.getElementById(id); }

  var screens = {};
  var el = {};
  var phase = 'gift';
  var reduceMotion = false;
  var toastTimer = 0;

  /* ── screens ──────────────────────────────────────────────────────── */
  function activate(name) {
    Object.keys(screens).forEach(function (key) {
      var node = screens[key];
      var on = key === name;
      node.classList.toggle('is-active', on);
      node.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    document.body.classList.toggle('is-letter', name === 'letter');
  }

  /* ── toast ────────────────────────────────────────────────────────── */
  function toast(message) {
    var t = el.toast;
    t.textContent = message;
    t.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-visible'); }, 3200);
  }

  function formatDate(d) {
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  /* ── polaroids ────────────────────────────────────────────────────── */
  function renderPolaroids(items) {
    var wrap = el.polaroids;
    wrap.innerHTML = '';

    items.forEach(function (item, i) {
      var fig = document.createElement('figure');
      fig.className = 'polaroid';
      fig.style.animationDelay = (0.15 + i * 0.11).toFixed(2) + 's';

      var frame = document.createElement('div');
      frame.className = 'polaroid__frame';
      if (item.media) frame.appendChild(item.media);

      var cap = document.createElement('figcaption');
      cap.className = 'polaroid__caption';
      cap.textContent = item.caption || '';

      fig.appendChild(frame);
      fig.appendChild(cap);
      wrap.appendChild(fig);
    });
  }

  /* ── the gift ─────────────────────────────────────────────────────── */
  function openGift() {
    if (phase !== 'gift') return;
    phase = 'opening';

    el.gift.classList.add('is-open');
    el.gift.disabled = true;

    global.Soundtrack.unlock();
    if (CFG.music !== false) global.Soundtrack.start();
    global.Soundtrack.chime();

    setTimeout(function () { el.giftCard.classList.add('is-gone'); }, 1450);

    var skip = reduceMotion || CFG.skipTunnel || !global.Flowers.list.length;
    setTimeout(function () {
      if (skip) {
        el.tunnel.classList.add('is-flashing');
        global.Tunnel.clear();
        setTimeout(finishTunnel, 420);
      } else {
        runTunnel();
      }
    }, skip ? 1500 : 1850);
  }

  function runTunnel() {
    phase = 'tunnel';
    activate('tunnel');

    var duration = CFG.tunnelDuration || 9000;

    var finished = global.Tunnel.play(duration);
    // A hidden tab pauses rAF; never let the flow stall forever.
    var safety = new Promise(function (resolve) { setTimeout(resolve, duration + 2500); });

    Promise.race([finished, safety]).then(function () {
      if (phase === 'tunnel') finishTunnel();
    });
  }

  function finishTunnel() {
    if (phase === 'letter') return;
    phase = 'letter';

    el.tunnel.classList.add('is-flashing');

    setTimeout(function () {
      activate('letter');
      global.Tunnel.petals();
    }, 900);

    setTimeout(function () {
      el.tunnel.classList.remove('is-active', 'is-flashing');
    }, 2300);
  }

  /* ── replay ───────────────────────────────────────────────────────── */
  function replay() {
    phase = 'gift';

    el.giftCard.classList.remove('is-gone');
    el.gift.classList.remove('is-open');
    el.gift.disabled = false;

    activate('gift');

    setTimeout(function () {
      global.Tunnel.halt();
      global.Tunnel.clear();
    }, 900);
  }

  /* ── share ────────────────────────────────────────────────────────── */
  function copyLink() {
    var url = global.location.href.split('#')[0];

    function legacyCopy() {
      var ta = document.createElement('textarea');
      ta.value = url;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }

    if (global.navigator.clipboard && global.isSecureContext) {
      global.navigator.clipboard.writeText(url).then(function () {
        toast('Link copied — go on, send it ♡');
      }).catch(function () {
        toast(legacyCopy() ? 'Link copied — go on, send it ♡' : url);
      });
    } else {
      toast(legacyCopy() ? 'Link copied — go on, send it ♡' : url);
    }
  }

  /* ── audio toggle ─────────────────────────────────────────────────── */
  function toggleAudio() {
    var on = global.Soundtrack.toggle();
    el.audioBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  /* ── boot ─────────────────────────────────────────────────────────── */
  function init() {
    screens = {
      gift: $('screen-gift'),
      tunnel: $('screen-tunnel'),
      letter: $('screen-letter')
    };

    el = {
      gift: $('gift'),
      giftCard: $('gift-card'),
      tunnel: $('screen-tunnel'),
      letter: $('screen-letter'),
      polaroids: $('polaroids'),
      signatureName: $('signature-name'),
      signatureDate: $('signature-date'),
      audioBtn: $('audio-toggle'),
      toast: $('toast')
    };

    reduceMotion = global.matchMedia &&
      global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* personalisation */
    el.signatureName.textContent = CFG.from || 'Your Friend';
    el.signatureDate.textContent = formatDate(new Date());
    document.title = 'For you, ' + (CFG.recipient || 'you') + ' \uD83E\uDD0D';

    /* wire up */
    el.gift.addEventListener('click', openGift);
    el.audioBtn.addEventListener('click', toggleAudio);
    $('skip-tunnel').addEventListener('click', function () { global.Tunnel.skip(); });
    $('replay').addEventListener('click', replay);
    $('share').addEventListener('click', copyLink);

    if (CFG.music === false || !global.Soundtrack.available) {
      el.audioBtn.hidden = true;
    }

    activate('gift');

    /* Build the garden, then the album — the box is usable as soon as the
       flowers are ready, so nothing waits on the polaroids. */
    global.Flowers.build()
      .catch(function (err) {
        console.warn('[amna] flower build failed:', err);
        return [];
      })
      .then(function () {
        global.Tunnel.mount($('stage'), global.Flowers.list);
        document.body.classList.add('is-ready');
        global.__amnaReady = true;
        return global.Photos.build();
      })
      .then(renderPolaroids)
      .catch(function (err) {
        console.warn('[amna] polaroid build failed:', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
