/* ═══════════════════════════════════════════════════════════════════════
   audio.js — a tiny music box.

   Everything is synthesised with the Web Audio API: a warm pad following a
   I–vi–IV–V progression, and a soft music-box melody drifting over it.
   No audio files, so nothing to download and nothing to go missing.
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var ctx = null;
  var master = null;
  var wet = null;
  var padBus = null;
  var bellBus = null;
  var timer = null;

  var BAR = 4;            // seconds per chord
  var STEP = BAR / 8;     // one melody note every half second
  var running = false;
  var wantOn = true;
  var bar = 0;
  var nextBarAt = 0;

  /* I – vi – IV – V in C */
  var PROGRESSION = [
    { pad: [48, 60, 64, 67], scale: [72, 74, 76, 79, 81, 84] },
    { pad: [45, 57, 60, 64], scale: [69, 72, 74, 76, 79, 81] },
    { pad: [41, 53, 57, 60], scale: [65, 69, 72, 74, 77, 81] },
    { pad: [43, 55, 59, 62], scale: [67, 71, 74, 76, 79, 83] }
  ];

  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  function makeImpulse(seconds, decay) {
    var rate = ctx.sampleRate;
    var len = Math.max(1, Math.floor(rate * seconds));
    var buf = ctx.createBuffer(2, len, rate);
    for (var ch = 0; ch < 2; ch++) {
      var data = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  function init() {
    if (ctx) return true;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return false;

    try {
      ctx = new AC();

      master = ctx.createGain();
      master.gain.value = 0;

      var warm = ctx.createBiquadFilter();
      warm.type = 'lowpass';
      warm.frequency.value = 3600;
      warm.Q.value = 0.4;

      var verb = ctx.createConvolver();
      verb.buffer = makeImpulse(2.8, 2.6);

      wet = ctx.createGain();
      wet.gain.value = 0.34;

      padBus = ctx.createGain();
      padBus.gain.value = 0.5;

      bellBus = ctx.createGain();
      bellBus.gain.value = 0.9;

      padBus.connect(warm);
      bellBus.connect(warm);
      warm.connect(master);
      warm.connect(verb);
      verb.connect(wet);
      wet.connect(master);
      master.connect(ctx.destination);

      return true;
    } catch (e) {
      ctx = null;
      return false;
    }
  }

  /* ── one chord of pad + one bar of melody ─────────────────────────── */
  function scheduleBar(index, t) {
    var chord = PROGRESSION[index % PROGRESSION.length];

    /* pad */
    chord.pad.forEach(function (note, i) {
      var osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = midi(note);

      var detune = ctx.createOscillator();
      detune.type = 'sine';
      detune.frequency.value = midi(note) * 1.004;

      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(i === 0 ? 0.13 : 0.055, t + 1.5);
      g.gain.linearRampToValueAtTime(0.0001, t + BAR + 1.2);

      osc.connect(g);
      detune.connect(g);
      g.connect(padBus);

      osc.start(t);
      detune.start(t);
      osc.stop(t + BAR + 1.4);
      detune.stop(t + BAR + 1.4);
    });

    /* music box melody */
    var rng = Flowers.mulberry32(index * 7919 + 13);
    for (var s = 0; s < 8; s++) {
      var at = t + s * STEP + rng() * 0.04;

      // Rest now and then so it breathes.
      if (rng() < 0.22 && s !== 0) continue;

      // Prefer neighbouring notes so the line feels like a melody.
      var pickIdx = Math.floor(rng() * chord.scale.length);
      if (s > 0 && rng() < 0.55) pickIdx = melodyCursor(index, s);
      var note = chord.scale[Math.min(pickIdx, chord.scale.length - 1)];

      playBell(midi(note), at, 0.055 + rng() * 0.03);
      if (rng() < 0.3) playBell(midi(note) * 2, at + 0.06, 0.016);
    }
  }

  /* A tiny deterministic walk so the melody arcs instead of jumping. */
  function melodyCursor(index, step) {
    var rng = Flowers.mulberry32(index * 104729 + step * 31);
    return Math.floor(rng() * 6);
  }

  function playBell(freq, at, level) {
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(level, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.9);

    osc.connect(g);
    g.connect(bellBus);
    osc.start(at);
    osc.stop(at + 2);
  }

  function pump() {
    if (!running || !ctx) return;
    var horizon = ctx.currentTime + 1.2;
    while (nextBarAt < horizon) {
      if (nextBarAt < ctx.currentTime) nextBarAt = ctx.currentTime + 0.05;
      scheduleBar(bar++, nextBarAt);
      nextBarAt += BAR;
    }
  }

  /* ── public API ───────────────────────────────────────────────────── */
  var Audio = {
    get isOn() { return wantOn && running; },

    /* Call from a user gesture — browsers block audio until then. */
    unlock: function () {
      if (!init()) return false;
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    },

    start: function () {
      if (!init()) return false;
      if (ctx.state === 'suspended') ctx.resume();
      if (running) return true;

      running = true;
      wantOn = true;
      bar = 0;
      nextBarAt = ctx.currentTime + 0.15;

      var now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
      master.gain.linearRampToValueAtTime(0.17, now + 3.5);

      pump();
      timer = setInterval(pump, 250);
      return true;
    },

    stop: function () {
      if (!ctx) return;
      wantOn = false;
      running = false;
      if (timer) { clearInterval(timer); timer = null; }
      var now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0.0001, now + 1.2);
    },

    /* Returns the new on/off state. */
    toggle: function () {
      if (running || wantOn) {
        if (running) { Audio.stop(); return false; }
        Audio.start();
        return true;
      }
      return Audio.start();
    },

    /* A soft chime used when the box opens. */
    chime: function () {
      if (!init()) return;
      if (ctx.state === 'suspended') ctx.resume();
      var t = ctx.currentTime + 0.02;
      [84, 88, 91, 96].forEach(function (n, i) {
        playBell(midi(n), t + i * 0.13, 0.085 - i * 0.012);
      });
      if (!running) {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(0.0001, ctx.currentTime);
        master.gain.linearRampToValueAtTime(0.19, ctx.currentTime + 0.4);
        master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 4);
      }
    },

    get available() { return !!(global.AudioContext || global.webkitAudioContext); }
  };

  global.Soundtrack = Audio;

})(window);
