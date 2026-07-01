/* Hexcited — Hexie's Rescue
   core.js — global namespace, utilities, input handling. */
(function () {
  'use strict';
  const HX = (window.Hexcited = window.Hexcited || {});

  HX.W = 960;   // internal render width
  HX.H = 540;   // internal render height
  HX.DT = 1 / 60; // fixed simulation timestep

  /* ------------------------------------------------ utilities */
  const U = (HX.util = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    /* frame-rate independent exponential smoothing */
    damp: (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt)),
    rand: (a, b) => a + Math.random() * (b - a),
    irand: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    chance: (p) => Math.random() < p,
    sgn: (v) => (v < 0 ? -1 : 1),
    aabb: (ax, ay, aw, ah, bx, by, bw, bh) =>
      ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by,
    /* deterministic LCG so decorative layouts are stable per level */
    seeded(seed) {
      let s = seed >>> 0;
      return function () {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
      };
    },
    /* rounded-rect path (own impl so no reliance on ctx.roundRect) */
    rr(ctx, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    },
  });

  /* ------------------------------------------------ input */
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    Space: 'jump',
    Enter: 'confirm', NumpadEnter: 'confirm',
    KeyP: 'pause',
    KeyM: 'mute',
    Digit1: 'lvl1', Numpad1: 'lvl1',
    Digit2: 'lvl2', Numpad2: 'lvl2',
    Digit3: 'lvl3', Numpad3: 'lvl3',
  };

  HX.Input = {
    held: Object.create(null),
    hit: Object.create(null),
    init() {
      window.addEventListener('keydown', (e) => {
        const a = KEYMAP[e.code];
        if (a) e.preventDefault();
        if (HX.Audio) HX.Audio.unlock(); // audio needs a user gesture
        if (!a || e.repeat) return;
        this.held[a] = true;
        this.hit[a] = true;
      });
      window.addEventListener('keyup', (e) => {
        const a = KEYMAP[e.code];
        if (a) this.held[a] = false;
      });
      window.addEventListener('blur', () => {
        this.held = Object.create(null);
      });
    },
    down(a) { return !!this.held[a]; },
    pressed(a) { return !!this.hit[a]; },
    endFrame() { this.hit = Object.create(null); },
  };
})();
