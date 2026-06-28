/* =========================================================================
   Hexcited — engine.js
   Core systems: math utils, input, camera, AABB collision, particles,
   screen shake, and a fixed-timestep game loop.
   Everything attaches to the global `Hex` namespace.
   ========================================================================= */
(function (global) {
  "use strict";

  const Hex = (global.Hex = global.Hex || {});

  /* ----------------------------- Math utils ----------------------------- */
  const M = {
    clamp: (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v),
    lerp: (a, b, t) => a + (b - a) * t,
    rand: (a, b) => a + Math.random() * (b - a),
    randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    sign: (v) => (v > 0 ? 1 : v < 0 ? -1 : 0),
    // exponential smoothing that is framerate independent-ish for fixed dt
    approach: (cur, target, delta) => {
      if (cur < target) return Math.min(cur + delta, target);
      if (cur > target) return Math.max(cur - delta, target);
      return cur;
    },
    aabb: (a, b) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y,
  };
  Hex.M = M;

  /* ------------------------------- Input -------------------------------- */
  const Input = {
    down: Object.create(null),
    pressed: Object.create(null), // edge-triggered this frame
    released: Object.create(null),
    _queuedPressed: Object.create(null),
    _queuedReleased: Object.create(null),

    // Map raw keys to logical actions
    map: {
      ArrowLeft: "left", KeyA: "left",
      ArrowRight: "right", KeyD: "right",
      ArrowUp: "up", KeyW: "up",
      ArrowDown: "down", KeyS: "down",
      Space: "jump",
      ShiftLeft: "slow", ShiftRight: "slow",
      Enter: "start", NumpadEnter: "start",
      KeyM: "mute", KeyP: "pause",
      Digit1: "level1", Numpad1: "level1",
      Digit2: "level2", Numpad2: "level2",
      Digit3: "level3", Numpad3: "level3",
    },

    init() {
      const preventer = new Set(["left", "right", "up", "down", "jump"]);
      global.addEventListener("keydown", (e) => {
        const a = this.map[e.code];
        if (!a) return;
        if (preventer.has(a)) e.preventDefault();
        if (!this.down[a]) this._queuedPressed[a] = true;
        this.down[a] = true;
      });
      global.addEventListener("keyup", (e) => {
        const a = this.map[e.code];
        if (!a) return;
        this.down[a] = false;
        this._queuedReleased[a] = true;
      });
      // Lose focus -> release everything (avoids stuck keys)
      global.addEventListener("blur", () => {
        this.down = Object.create(null);
      });
    },

    // Called once per frame BEFORE update so edge events line up
    beginFrame() {
      this.pressed = this._queuedPressed;
      this.released = this._queuedReleased;
      this._queuedPressed = Object.create(null);
      this._queuedReleased = Object.create(null);
    },

    isDown(a) { return !!this.down[a]; },
    wasPressed(a) { return !!this.pressed[a]; },
    wasReleased(a) { return !!this.released[a]; },
  };
  Hex.Input = Input;

  /* ------------------------------ Camera -------------------------------- */
  class Camera {
    constructor(viewW, viewH) {
      this.viewW = viewW;
      this.viewH = viewH;
      this.x = 0;
      this.y = 0;
      this.tx = 0;
      this.ty = 0;
      this.bounds = { x: 0, y: 0, w: Infinity, h: Infinity };
      this.shake = 0; // trauma 0..1
      this.ox = 0;
      this.oy = 0;
    }
    setBounds(x, y, w, h) { this.bounds = { x, y, w, h }; }
    follow(target, lerp = 0.12, lookX = 0, lookY = 0) {
      this.tx = target.x + target.w / 2 - this.viewW / 2 + lookX;
      this.ty = target.y + target.h / 2 - this.viewH / 2 + lookY;
      this.x = M.lerp(this.x, this.tx, lerp);
      this.y = M.lerp(this.y, this.ty, lerp);
      this._clamp();
    }
    snapTo(x, y) { this.x = x; this.y = y; this._clamp(); }
    _clamp() {
      const b = this.bounds;
      if (b.w !== Infinity)
        this.x = M.clamp(this.x, b.x, Math.max(b.x, b.x + b.w - this.viewW));
      if (b.h !== Infinity)
        this.y = M.clamp(this.y, b.y, Math.max(b.y, b.y + b.h - this.viewH));
    }
    addShake(amount) { this.shake = M.clamp(this.shake + amount, 0, 1); }
    update() {
      if (this.shake > 0) {
        const s = this.shake * this.shake;
        const mag = 16 * s;
        this.ox = M.rand(-mag, mag);
        this.oy = M.rand(-mag, mag);
        this.shake = Math.max(0, this.shake - 0.04);
      } else {
        this.ox = this.oy = 0;
      }
    }
    // Apply translate to a context (call inside save/restore)
    apply(ctx) {
      ctx.translate(
        Math.round(-this.x + this.ox),
        Math.round(-this.y + this.oy)
      );
    }
  }
  Hex.Camera = Camera;

  /* ---------------------------- Collision ------------------------------- */
  // Resolve a moving body (with .x,.y,.w,.h,.vx,.vy) against an array of solid
  // rects, axis-separated so it can never tunnel through walls/floors.
  // Returns { onGround, hitCeil, hitWallL, hitWallR, ridingObstacle }.
  function moveAndCollide(body, solids, dt) {
    const res = { onGround: false, hitCeil: false, hitWallL: false, hitWallR: false };

    // --- Horizontal ---
    body.x += body.vx * dt;
    for (let i = 0; i < solids.length; i++) {
      const s = solids[i];
      if (s.oneWay) continue; // one-way platforms only collide vertically
      if (M.aabb(body, s)) {
        if (body.vx > 0) { body.x = s.x - body.w; res.hitWallR = true; }
        else if (body.vx < 0) { body.x = s.x + s.w; res.hitWallL = true; }
        body.vx = 0;
      }
    }

    // --- Vertical ---
    const prevBottom = body.y + body.h;
    body.y += body.vy * dt;
    for (let i = 0; i < solids.length; i++) {
      const s = solids[i];
      if (M.aabb(body, s)) {
        if (s.oneWay) {
          // Only land on a one-way platform when falling and previously above it
          if (body.vy >= 0 && prevBottom <= s.y + 1) {
            body.y = s.y - body.h;
            body.vy = 0;
            res.onGround = true;
          }
          continue;
        }
        if (body.vy > 0) { body.y = s.y - body.h; body.vy = 0; res.onGround = true; }
        else if (body.vy < 0) { body.y = s.y + s.h; body.vy = 0; res.hitCeil = true; }
      }
    }
    return res;
  }
  Hex.moveAndCollide = moveAndCollide;

  /* ---------------------------- Particles ------------------------------- */
  class Particles {
    constructor(max = 600) {
      this.pool = [];
      this.max = max;
    }
    spawn(opts) {
      if (this.pool.length >= this.max) this.pool.shift();
      this.pool.push({
        x: opts.x, y: opts.y,
        vx: opts.vx || 0, vy: opts.vy || 0,
        g: opts.g != null ? opts.g : 0,
        life: opts.life || 0.6,
        max: opts.life || 0.6,
        size: opts.size || 3,
        color: opts.color || "#fff",
        glow: opts.glow || false,
        shape: opts.shape || "circle", // circle | square | star | streak
        spin: opts.spin || 0,
        rot: opts.rot || 0,
        fade: opts.fade !== false,
        shrink: opts.shrink !== false,
        drag: opts.drag != null ? opts.drag : 0,
      });
    }
    burst(x, y, n, opts) {
      for (let i = 0; i < n; i++) {
        const ang = opts.angle != null ? opts.angle + M.rand(-opts.spread, opts.spread)
                                        : M.rand(0, Math.PI * 2);
        const spd = M.rand(opts.speedMin || 40, opts.speedMax || 160);
        this.spawn({
          x, y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - (opts.lift || 0),
          g: opts.g != null ? opts.g : 400,
          life: M.rand(opts.lifeMin || 0.3, opts.lifeMax || 0.7),
          size: M.rand(opts.sizeMin || 2, opts.sizeMax || 5),
          color: Array.isArray(opts.color)
            ? opts.color[M.randInt(0, opts.color.length - 1)]
            : opts.color,
          glow: opts.glow,
          shape: opts.shape,
          spin: M.rand(-8, 8),
          drag: opts.drag || 0,
        });
      }
    }
    update(dt) {
      for (let i = this.pool.length - 1; i >= 0; i--) {
        const p = this.pool[i];
        p.life -= dt;
        if (p.life <= 0) { this.pool.splice(i, 1); continue; }
        p.vy += p.g * dt;
        if (p.drag) { p.vx *= (1 - p.drag * dt); p.vy *= (1 - p.drag * dt); }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
      }
    }
    draw(ctx) {
      for (let i = 0; i < this.pool.length; i++) {
        const p = this.pool[i];
        const t = p.life / p.max;
        ctx.save();
        ctx.globalAlpha = p.fade ? M.clamp(t, 0, 1) : 1;
        const sz = p.shrink ? p.size * (0.4 + 0.6 * t) : p.size;
        if (p.glow) {
          ctx.shadowColor = p.color;
          ctx.shadowBlur = sz * 2.5;
        }
        ctx.fillStyle = p.color;
        if (p.shape === "square") {
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
        } else if (p.shape === "streak") {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = sz;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
          ctx.stroke();
        } else if (p.shape === "star") {
          drawStar(ctx, p.x, p.y, sz, sz * 0.45, 5, p.rot);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }
    clear() { this.pool.length = 0; }
    get count() { return this.pool.length; }
  }
  Hex.Particles = Particles;

  function drawStar(ctx, cx, cy, outer, inner, points, rot) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = rot + (i * Math.PI) / points;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
  Hex.drawStar = drawStar;

  /* ------------------------------- Loop --------------------------------- */
  // Fixed-timestep loop with an accumulator. step(dt) runs at a constant
  // 1/60s; render(alpha) runs once per animation frame.
  class Loop {
    constructor(step, render) {
      this.step = step;
      this.render = render;
      this.dt = 1 / 60;
      this.acc = 0;
      this.last = 0;
      this.running = false;
      this._raf = this._raf.bind(this);
    }
    start() {
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      requestAnimationFrame(this._raf);
    }
    stop() { this.running = false; }
    _raf(now) {
      if (!this.running) return;
      let frame = (now - this.last) / 1000;
      this.last = now;
      if (frame > 0.25) frame = 0.25; // avoid spiral of death after tab-out
      this.acc += frame;
      let steps = 0;
      while (this.acc >= this.dt && steps < 5) {
        this.step(this.dt);
        this.acc -= this.dt;
        steps++;
      }
      if (steps === 5) this.acc = 0;
      this.render(this.acc / this.dt);
      requestAnimationFrame(this._raf);
    }
  }
  Hex.Loop = Loop;

  /* --------------------------- Draw helpers ----------------------------- */
  Hex.draw = {
    roundRect(ctx, x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    },
    // Vertical gradient fill helper
    vgrad(ctx, x, y, w, h, stops) {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      for (const [pos, col] of stops) g.addColorStop(pos, col);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
    },
  };
})(window);
