/* Hexcited — Hexie's Rescue
   fx.js — particles, screen shake, hitstop, floating text. All world-space. */
(function () {
  'use strict';
  const HX = window.Hexcited;
  const U = HX.util;

  const FX = (HX.FX = {
    parts: [],
    texts: [],
    shakeT: 0,
    shakeDur: 1,
    shakeMag: 0,
    stop: 0, // hitstop timer (seconds)
  });

  FX.reset = function () {
    FX.parts.length = 0;
    FX.texts.length = 0;
    FX.shakeT = 0;
    FX.stop = 0;
  };

  FX.shake = function (mag, dur) {
    FX.shakeMag = Math.max(FX.shakeMag * (FX.shakeT > 0 ? 1 : 0), mag);
    FX.shakeDur = dur;
    FX.shakeT = dur;
  };

  FX.offset = function () {
    if (FX.shakeT <= 0) return { x: 0, y: 0 };
    const k = (FX.shakeT / FX.shakeDur) * FX.shakeMag;
    return { x: (Math.random() * 2 - 1) * k, y: (Math.random() * 2 - 1) * k };
  };

  FX.hit = function (t) {
    FX.stop = Math.max(FX.stop, t);
  };

  FX.spawn = function (o) {
    FX.parts.push({
      x: o.x, y: o.y,
      vx: o.vx || 0, vy: o.vy || 0,
      life: o.life || 0.6, maxLife: o.life || 0.6,
      size: o.size || 3,
      color: o.color || '#fff',
      grav: o.grav || 0,
      drag: o.drag || 0,
      type: o.type || 'dot', // dot | spark | feather | shard | star | leaf | ring
      rot: o.rot || Math.random() * 6.28,
      spin: o.spin !== undefined ? o.spin : U.rand(-4, 4),
      alpha: o.alpha !== undefined ? o.alpha : 1,
    });
    if (FX.parts.length > 500) FX.parts.splice(0, FX.parts.length - 500);
  };

  FX.burst = function (x, y, n, base) {
    for (let i = 0; i < n; i++) {
      const a = U.rand(0, Math.PI * 2);
      const sp = U.rand(0.3, 1) * (base.speed || 120);
      FX.spawn(Object.assign({}, base, {
        x: x + U.rand(-4, 4), y: y + U.rand(-4, 4),
        vx: Math.cos(a) * sp + (base.vx || 0),
        vy: Math.sin(a) * sp + (base.vy || 0),
        life: (base.life || 0.6) * U.rand(0.6, 1.2),
        size: (base.size || 3) * U.rand(0.6, 1.4),
      }));
    }
  };

  /* --- common presets --- */
  FX.dust = (x, y, n) =>
    FX.burst(x, y, n || 6, { speed: 70, vy: -30, life: 0.5, size: 3.5, color: '#8f81a8', drag: 3, type: 'dot' });
  FX.sparkle = (x, y, color, n) =>
    FX.burst(x, y, n || 8, { speed: 90, life: 0.55, size: 3, color: color || '#ffd66e', type: 'star', grav: 60 });
  FX.feathers = (x, y, n, color) =>
    FX.burst(x, y, n || 8, { speed: 130, life: 1.1, size: 5, color: color || '#e8e4f0', type: 'feather', grav: 140, drag: 2.5 });
  FX.shards = (x, y, n) =>
    FX.burst(x, y, n || 12, { speed: 240, life: 0.9, size: 4, color: '#9aa2b8', type: 'shard', grav: 700 });
  FX.hearts = (x, y, n) =>
    FX.burst(x, y, n || 7, { speed: 55, vy: -70, life: 1.3, size: 5, color: '#ff5f8f', type: 'heart', grav: -30 });

  FX.addText = function (x, y, str, color) {
    FX.texts.push({ x, y, str, color: color || '#ffd66e', life: 0.9, maxLife: 0.9 });
  };

  FX.update = function (dt) {
    if (FX.shakeT > 0) FX.shakeT -= dt;
    for (let i = FX.parts.length - 1; i >= 0; i--) {
      const p = FX.parts[i];
      p.life -= dt;
      if (p.life <= 0) { FX.parts.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      if (p.drag) {
        p.vx -= p.vx * p.drag * dt;
        p.vy -= p.vy * p.drag * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
    for (let i = FX.texts.length - 1; i >= 0; i--) {
      const t = FX.texts[i];
      t.life -= dt;
      t.y -= 40 * dt;
      if (t.life <= 0) FX.texts.splice(i, 1);
    }
  };

  FX.draw = function (ctx) {
    for (const p of FX.parts) {
      const k = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = p.alpha * Math.min(1, k * 2);
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      switch (p.type) {
        case 'dot':
          ctx.beginPath();
          ctx.arc(0, 0, p.size * k, 0, 6.283);
          ctx.fill();
          break;
        case 'spark':
          ctx.rotate(Math.atan2(p.vy, p.vx));
          ctx.fillRect(-p.size * 1.6, -p.size * 0.3, p.size * 3.2, p.size * 0.6);
          break;
        case 'star': {
          ctx.rotate(p.rot);
          const s = p.size * (0.5 + k);
          ctx.beginPath();
          for (let j = 0; j < 8; j++) {
            const r = j % 2 ? s * 0.4 : s;
            const a = (j / 8) * 6.283;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'feather':
          ctx.rotate(p.rot);
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 1.6, p.size * 0.55, 0, 0, 6.283);
          ctx.fill();
          break;
        case 'shard':
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
          break;
        case 'leaf':
          ctx.rotate(p.rot + Math.sin(p.life * 5) * 0.6);
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 1.3, p.size * 0.6, 0, 0, 6.283);
          ctx.fill();
          break;
        case 'heart': {
          const s = p.size * 0.22;
          ctx.scale(s, s);
          ctx.beginPath();
          ctx.moveTo(0, 3);
          ctx.bezierCurveTo(-5, -1, -3.4, -5, 0, -2.4);
          ctx.bezierCurveTo(3.4, -5, 5, -1, 0, 3);
          ctx.fill();
          break;
        }
        case 'ring':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2.5 * k;
          ctx.beginPath();
          ctx.arc(0, 0, p.size * (1.4 - k), 0, 6.283);
          ctx.stroke();
          break;
      }
      ctx.restore();
    }
    for (const t of FX.texts) {
      const k = t.life / t.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 2.5);
      ctx.font = "800 15px 'Trebuchet MS', Verdana, sans-serif";
      ctx.textAlign = 'center';
      ctx.fillStyle = '#120a1e';
      ctx.fillText(t.str, t.x + 1.5, t.y + 1.5);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
      ctx.restore();
    }
  };
})();
