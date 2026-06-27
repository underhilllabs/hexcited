/* =========================================================================
   Hexcited — entities.js
   Hexie (the cat), Wendy, churchfolk enemies, pumpkins, the flying broom,
   and ducks. Each entity knows how to update + draw itself. All sprites are
   procedurally drawn with canvas primitives (no image assets).
   ========================================================================= */
(function (global) {
  "use strict";
  const Hex = (global.Hex = global.Hex || {});
  const M = Hex.M;
  const A = Hex.Audio;

  /* ============================ PLAYER: HEXIE ============================ */
  // Tunables for a satisfying jump.
  const P = {
    accel: 1400,
    airAccel: 900,
    friction: 1500,
    maxRun: 230,
    gravity: 2000,
    fallGravity: 2600,      // heavier when descending
    apexGravity: 1300,      // floaty near the top of a jump
    apexThreshold: 70,      // |vy| under this near apex = floaty
    jumpVel: 620,
    jumpCut: 0.45,          // multiply vy when jump released early
    coyote: 0.10,           // seconds you can still jump after leaving ground
    buffer: 0.12,           // seconds a jump press is remembered
    maxFall: 900,
  };

  class Hexie {
    constructor(x, y) {
      this.x = x; this.y = y;
      this.w = 34; this.h = 30;
      this.vx = 0; this.vy = 0;
      this.dir = 1;
      this.onGround = false;
      this.coyoteT = 0;
      this.bufferT = 0;
      this.jumping = false;
      this.state = "idle";   // idle | run | jump | fall
      this.animT = 0;
      this.runPhase = 0;
      // squash & stretch
      this.sx = 1; this.sy = 1;
      // juice
      this.blinkT = M.rand(2, 5);
      this.blinking = 0;
      this.tailPhase = 0;
      this.earTwitch = 0;
      // health
      this.maxHp = 3;
      this.hp = 3;
      this.invuln = 0;
      this.dead = false;
      this.facingLocked = false;
    }

    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }

    hurt(fromX, game) {
      if (this.invuln > 0 || this.dead) return false;
      this.hp--;
      this.invuln = 1.3;
      const dir = this.cx < fromX ? -1 : 1;
      this.vx = dir * 260;
      this.vy = -360;
      A.hurt();
      game.cam.addShake(0.6);
      game.particles.burst(this.cx, this.cy, 14, {
        color: ["#ff4d6d", "#ff8a3d", "#fff"], speedMin: 80, speedMax: 240,
        lifeMin: 0.3, lifeMax: 0.6, glow: true, g: 300,
      });
      if (this.hp <= 0) this.dead = true;
      return true;
    }

    bounce() {
      this.vy = -P.jumpVel * 0.72;
      this.jumping = true;
      this.sx = 0.7; this.sy = 1.35;
    }

    update(dt, solids, game) {
      if (this.invuln > 0) this.invuln -= dt;

      const In = Hex.Input;
      const left = In.isDown("left");
      const right = In.isDown("right");
      const wantJump = In.wasPressed("jump");
      const holdJump = In.isDown("jump");

      // Horizontal accel / friction
      let move = (right ? 1 : 0) - (left ? 1 : 0);
      const accel = this.onGround ? P.accel : P.airAccel;
      if (move !== 0) {
        this.vx += move * accel * dt;
        this.vx = M.clamp(this.vx, -P.maxRun, P.maxRun);
        if (!this.facingLocked) this.dir = move;
      } else {
        this.vx = M.approach(this.vx, 0, P.friction * dt);
      }

      // Jump buffering + coyote time
      if (wantJump) this.bufferT = P.buffer;
      else if (this.bufferT > 0) this.bufferT -= dt;
      if (this.onGround) this.coyoteT = P.coyote;
      else if (this.coyoteT > 0) this.coyoteT -= dt;

      if (this.bufferT > 0 && this.coyoteT > 0) {
        this.vy = -P.jumpVel;
        this.jumping = true;
        this.onGround = false;
        this.coyoteT = 0;
        this.bufferT = 0;
        this.sx = 0.7; this.sy = 1.4;          // stretch up
        A.jump();
        game.particles.burst(this.cx, this.y + this.h, 10, {
          color: ["#b48cff", "#ffffff"], angle: -Math.PI / 2, spread: 1.0,
          speedMin: 40, speedMax: 130, lifeMin: 0.2, lifeMax: 0.45, g: 200, glow: true,
        });
      }

      // Variable jump height (release early -> cut)
      if (Hex.Input.wasReleased("jump") && this.vy < 0 && this.jumping) {
        this.vy *= P.jumpCut;
        this.jumping = false;
      }

      // Gravity with apex hang + heavier fall
      let g = P.gravity;
      if (this.vy > 0) g = P.fallGravity;
      if (Math.abs(this.vy) < P.apexThreshold && !this.onGround && holdJump) g = P.apexGravity;
      this.vy += g * dt;
      this.vy = Math.min(this.vy, P.maxFall);

      // Move + collide
      const wasAir = !this.onGround;
      const r = Hex.moveAndCollide(this, solids, dt);
      this.onGround = r.onGround;

      if (this.onGround) {
        this.jumping = false;
        if (wasAir && this._fellFast) {
          // landing squash + dust
          this.sx = 1.35; this.sy = 0.65;
          A.land();
          game.particles.burst(this.cx, this.y + this.h, 8, {
            color: ["#5a4a7a", "#8a78b0"], angle: -Math.PI / 2, spread: 1.3,
            speedMin: 30, speedMax: 110, lifeMin: 0.2, lifeMax: 0.4, g: 250,
          });
          if (this._fellFast > 520) game.cam.addShake(0.18);
        }
        this._fellFast = 0;
      } else {
        this._fellFast = Math.max(this._fellFast || 0, this.vy);
      }

      // Recover squash/stretch toward 1
      this.sx = M.approach(this.sx, 1, 4 * dt);
      this.sy = M.approach(this.sy, 1, 4 * dt);

      // State + animation
      if (!this.onGround) this.state = this.vy < 0 ? "jump" : "fall";
      else if (Math.abs(this.vx) > 20) this.state = "run";
      else this.state = "idle";

      this.animT += dt;
      this.runPhase += Math.abs(this.vx) * dt * 0.06;
      this.tailPhase += dt * (this.state === "run" ? 9 : 4);

      // Blink + ear twitch
      this.blinkT -= dt;
      if (this.blinkT <= 0) { this.blinking = 0.12; this.blinkT = M.rand(2.5, 6); }
      if (this.blinking > 0) this.blinking -= dt;
      this.earTwitch = Math.max(0, this.earTwitch - dt);
      if (Math.random() < 0.004) this.earTwitch = 0.25;
    }

    draw(ctx) {
      // flicker while invulnerable
      if (this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0) return;

      const cx = this.cx;
      const baseY = this.y + this.h;
      ctx.save();
      ctx.translate(cx, baseY);
      ctx.scale(this.dir * this.sx, this.sy);

      // soft ground shadow (drawn unscaled-ish before body squash matters little)
      // body bob for idle/run
      let bob = 0;
      if (this.state === "run") bob = Math.sin(this.runPhase * 6) * 1.5;
      else if (this.state === "idle") bob = Math.sin(this.animT * 3) * 1.2;

      drawCat(ctx, this, bob);
      ctx.restore();
    }
  }
  Hex.Hexie = Hexie;

  // Draw the cat centered at (0,0) at its feet, facing +x.
  function drawCat(ctx, cat, bob) {
    const black = "#0c0a14";
    const fur = "#16121f";
    const bodyW = 30, bodyH = 18;
    const topY = -(28) + bob;   // body vertical anchor

    // --- tail (behind) ---
    ctx.save();
    ctx.strokeStyle = black;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    const tailWag = Math.sin(cat.tailPhase) * 6;
    ctx.beginPath();
    ctx.moveTo(-12, topY + 12);
    ctx.quadraticCurveTo(-26, topY + 8 + tailWag, -22 - Math.cos(cat.tailPhase) * 4,
      topY - 8 + tailWag);
    ctx.stroke();
    ctx.restore();

    // --- legs (run cycle) ---
    ctx.strokeStyle = black;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    let legA = 0, legB = 0;
    if (cat.state === "run") {
      legA = Math.sin(cat.runPhase * 6) * 6;
      legB = Math.sin(cat.runPhase * 6 + Math.PI) * 6;
    } else if (cat.state === "jump") { legA = -4; legB = -4; }
    else if (cat.state === "fall") { legA = 4; legB = 4; }
    ctx.beginPath();
    ctx.moveTo(-7, topY + 16); ctx.lineTo(-7 + legA, topY + 26);
    ctx.moveTo(7, topY + 16);  ctx.lineTo(7 + legB, topY + 26);
    ctx.stroke();

    // --- body ---
    ctx.fillStyle = black;
    Hex.draw.roundRect(ctx, -bodyW / 2, topY, bodyW, bodyH + 4, 9);
    ctx.fill();

    // --- head ---
    const hx = 8, hy = topY - 6;
    ctx.beginPath();
    ctx.arc(hx, hy, 11, 0, Math.PI * 2);
    ctx.fill();

    // ears
    const twitch = cat.earTwitch > 0 ? -2 : 0;
    ctx.beginPath();
    ctx.moveTo(hx - 8, hy - 6); ctx.lineTo(hx - 11, hy - 17 + twitch); ctx.lineTo(hx - 2, hy - 9);
    ctx.moveTo(hx + 6, hy - 7); ctx.lineTo(hx + 11, hy - 18); ctx.lineTo(hx + 1, hy - 9);
    ctx.closePath();
    ctx.fill();
    // inner ear hint
    ctx.fillStyle = "#3a2350";
    ctx.beginPath();
    ctx.moveTo(hx - 8, hy - 8); ctx.lineTo(hx - 10, hy - 14 + twitch); ctx.lineTo(hx - 5, hy - 9);
    ctx.fill();
    ctx.fillStyle = black;

    // --- eyes (glowing) ---
    if (cat.blinking > 0) {
      ctx.strokeStyle = "#b7ff5b";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(hx + 1, hy - 1); ctx.lineTo(hx + 5, hy - 1);
      ctx.moveTo(hx + 9, hy - 1); ctx.lineTo(hx + 13, hy - 1);
      ctx.stroke();
    } else {
      ctx.save();
      ctx.shadowColor = "#aaff4d";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#c8ff6b";
      ctx.beginPath();
      ctx.ellipse(hx + 3, hy - 1, 2.4, 3.2, 0, 0, Math.PI * 2);
      ctx.ellipse(hx + 11, hy - 1, 2.4, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      // slit pupils
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#16240a";
      ctx.fillRect(hx + 2.4, hy - 3, 1.1, 4);
      ctx.fillRect(hx + 10.4, hy - 3, 1.1, 4);
      ctx.restore();
    }

    // whiskers
    ctx.strokeStyle = "rgba(220,210,255,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx + 12, hy + 3); ctx.lineTo(hx + 20, hy + 1);
    ctx.moveTo(hx + 12, hy + 5); ctx.lineTo(hx + 20, hy + 6);
    ctx.stroke();

    // tiny nose
    ctx.fillStyle = "#ff7aa8";
    ctx.beginPath();
    ctx.arc(hx + 13, hy + 4, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  Hex.drawCat = drawCat;

  /* ============================== PUMPKIN =============================== */
  class Pumpkin {
    constructor(x, y) {
      this.x = x; this.y = y;
      this.w = 22; this.h = 22;
      this.bob = M.rand(0, Math.PI * 2);
      this.collected = false;
      this.spin = 0;
    }
    update(dt) { this.bob += dt * 3; this.spin += dt; }
    draw(ctx) {
      if (this.collected) return;
      const cx = this.x + this.w / 2;
      const cy = this.y + this.h / 2 + Math.sin(this.bob) * 4;
      ctx.save();
      ctx.translate(cx, cy);
      // glow halo
      ctx.shadowColor = "#ff9d2e";
      ctx.shadowBlur = 18;
      // body
      ctx.fillStyle = "#ff8c1a";
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // ribs
      ctx.strokeStyle = "rgba(180,70,0,0.5)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(0, 0, 4, 9, 0, 0, Math.PI * 2);
      ctx.ellipse(0, 0, 8, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
      // stem
      ctx.strokeStyle = "#5b8a2a";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(2, -13);
      ctx.stroke();
      // little face glow
      ctx.fillStyle = "rgba(255,240,180,0.85)";
      ctx.beginPath();
      ctx.moveTo(-5, -1); ctx.lineTo(-2, -3); ctx.lineTo(-2, 1); ctx.closePath();
      ctx.moveTo(5, -1); ctx.lineTo(2, -3); ctx.lineTo(2, 1); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  Hex.Pumpkin = Pumpkin;

  /* ====================== ENEMY: CHURCHFOLK ============================ */
  // A prim, disapproving member of the Church of Good Manners. Patrols a
  // platform; stomp from above to defeat, hurts on side contact.
  class Churchfolk {
    constructor(x, y, range) {
      this.w = 28; this.h = 40;
      this.x = x; this.y = y - this.h;
      this.spawnX = x;
      this.range = range || 90;
      this.vx = 50;
      this.vy = 0;
      this.dir = -1;
      this.dead = false;
      this.squish = 0;
      this.phase = M.rand(0, Math.PI * 2);
      this.wagT = 0;
    }
    update(dt, solids, game) {
      if (this.dead) return;
      this.phase += dt * 4;
      this.wagT += dt * 8;
      // patrol within range of spawn
      this.x += this.dir * Math.abs(this.vx) * dt;
      if (this.x < this.spawnX - this.range) { this.x = this.spawnX - this.range; this.dir = 1; }
      if (this.x > this.spawnX + this.range) { this.x = this.spawnX + this.range; this.dir = -1; }
      // gravity to stay grounded
      this.vy += 2000 * dt;
      this.vy = Math.min(this.vy, 900);
      this.y += this.vy * dt;
      for (const s of solids) {
        if (s.oneWay) continue;
        if (M.aabb(this, s) && this.vy > 0) {
          this.y = s.y - this.h; this.vy = 0;
        }
      }
    }
    stomp(game) {
      this.dead = true;
      this.squish = 1;
      A.stomp();
      game.cam.addShake(0.35);
      game.addScore(150, this.x + this.w / 2, this.y);
      game.particles.burst(this.x + this.w / 2, this.y + this.h * 0.4, 18, {
        color: ["#6b4fa0", "#d8c8ff", "#fff", "#ff8a3d"], speedMin: 60, speedMax: 240,
        lifeMin: 0.3, lifeMax: 0.7, glow: true, g: 500,
      });
    }
    draw(ctx) {
      const cx = this.x + this.w / 2;
      const baseY = this.y + this.h;
      ctx.save();
      ctx.translate(cx, baseY);

      if (this.dead) {
        // flattened poof remnant
        this.squish = Math.max(0, this.squish - 0.05);
        ctx.globalAlpha = this.squish;
        ctx.fillStyle = "#241a38";
        ctx.beginPath();
        ctx.ellipse(0, -3, 18 * (2 - this.squish), 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      const sway = Math.sin(this.phase) * 2;
      ctx.translate(sway, 0);
      ctx.scale(this.dir, 1);

      // robe (silhouette body)
      ctx.fillStyle = "#2a2140";
      ctx.beginPath();
      ctx.moveTo(-13, -2);
      ctx.lineTo(-9, -30);
      ctx.quadraticCurveTo(0, -36, 9, -30);
      ctx.lineTo(13, -2);
      ctx.closePath();
      ctx.fill();
      // white prim collar
      ctx.fillStyle = "#e9e2ff";
      ctx.beginPath();
      ctx.moveTo(-8, -28); ctx.lineTo(0, -22); ctx.lineTo(8, -28);
      ctx.lineTo(5, -30); ctx.lineTo(-5, -30); ctx.closePath();
      ctx.fill();
      // head
      ctx.fillStyle = "#d9c7b0";
      ctx.beginPath();
      ctx.arc(0, -38, 7, 0, Math.PI * 2);
      ctx.fill();
      // stern hat (clergy-ish)
      ctx.fillStyle = "#15101f";
      ctx.fillRect(-9, -45, 18, 3);
      ctx.fillRect(-5, -52, 10, 8);
      // disapproving frown + eyes
      ctx.strokeStyle = "#3a2f22";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-3, -34); ctx.quadraticCurveTo(0, -36, 3, -34);
      ctx.stroke();
      ctx.fillStyle = "#1a120b";
      ctx.fillRect(-4, -40, 2, 2);
      ctx.fillRect(2, -40, 2, 2);
      // wagging finger of disapproval
      ctx.strokeStyle = "#d9c7b0";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      const fw = Math.sin(this.wagT) * 4;
      ctx.beginPath();
      ctx.moveTo(10, -22);
      ctx.lineTo(16, -30 + fw);
      ctx.stroke();
      ctx.restore();
    }
  }
  Hex.Churchfolk = Churchfolk;

  /* ============================== WENDY ================================ */
  // Short witch with an oversized hat and red/white striped socks. Held in
  // a cage at the end of level 1; rides the broom in level 2.
  class Wendy {
    constructor(x, y) {
      this.x = x; this.y = y;
      this.w = 30; this.h = 40;
      this.caged = true;
      this.phase = M.rand(0, 6);
      this.free = false;
    }
    update(dt) { this.phase += dt * 2.5; }
    draw(ctx, opts) {
      opts = opts || {};
      const bob = Math.sin(this.phase) * (this.caged ? 1.5 : 3);
      const cx = this.x + this.w / 2;
      const baseY = this.y + this.h + bob;
      ctx.save();
      ctx.translate(cx, baseY);
      if (opts.flip) ctx.scale(-1, 1);
      drawWendy(ctx);
      ctx.restore();

      // cage
      if (this.caged) {
        ctx.save();
        ctx.translate(cx, this.y + this.h);
        ctx.strokeStyle = "rgba(180,180,200,0.85)";
        ctx.lineWidth = 2.5;
        ctx.shadowColor = "rgba(150,200,255,0.4)";
        ctx.shadowBlur = 8;
        const cw = 46, ch = 60;
        ctx.strokeRect(-cw / 2, -ch, cw, ch);
        for (let i = -cw / 2 + 8; i < cw / 2; i += 8) {
          ctx.beginPath(); ctx.moveTo(i, -ch); ctx.lineTo(i, 0); ctx.stroke();
        }
        // top dome
        ctx.beginPath();
        ctx.arc(0, -ch, cw / 2, Math.PI, 0);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
  Hex.Wendy = Wendy;

  function drawWendy(ctx) {
    // striped socks / legs
    const legs = ["#cf2d3a", "#fff"];
    for (const lx of [-5, 5]) {
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = legs[i % 2];
        ctx.fillRect(lx - 3, -10 + i * 2, 6, 2);
      }
      // little shoe
      ctx.fillStyle = "#1a1426";
      ctx.fillRect(lx - 4, -1, 8, 3);
    }
    // dress (short witch -> stout body)
    ctx.fillStyle = "#3a2b66";
    ctx.beginPath();
    ctx.moveTo(-11, -10);
    ctx.lineTo(-8, -30);
    ctx.quadraticCurveTo(0, -34, 8, -30);
    ctx.lineTo(11, -10);
    ctx.closePath();
    ctx.fill();
    // belt
    ctx.fillStyle = "#ffd24d";
    ctx.fillRect(-9, -20, 18, 3);
    // arms
    ctx.strokeStyle = "#3a2b66";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-8, -26); ctx.lineTo(-14, -18);
    ctx.moveTo(8, -26); ctx.lineTo(14, -18);
    ctx.stroke();
    // face
    ctx.fillStyle = "#e7d3a1";
    ctx.beginPath();
    ctx.arc(0, -34, 7, 0, Math.PI * 2);
    ctx.fill();
    // eyes + smile
    ctx.fillStyle = "#1a120b";
    ctx.fillRect(-3, -36, 1.8, 2);
    ctx.fillRect(1.4, -36, 1.8, 2);
    ctx.strokeStyle = "#a3434f";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, -32, 2.5, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
    // OVERSIZED witch hat
    ctx.fillStyle = "#241a3a";
    ctx.beginPath();
    ctx.ellipse(0, -40, 18, 5, 0, 0, Math.PI * 2);   // big brim
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-12, -41);
    ctx.quadraticCurveTo(-2, -74, 9, -42);            // tall bent cone
    ctx.closePath();
    ctx.fill();
    // hat band + star
    ctx.fillStyle = "#ffd24d";
    ctx.fillRect(-11, -45, 20, 3);
    ctx.fillStyle = "#ffe9a8";
    Hex.drawStar(ctx, 2, -58, 3.5, 1.6, 5, 0.3);
  }
  Hex.drawWendy = drawWendy;

  /* ===================== LEVEL 2: BROOM + DUCKS ======================== */
  // The broom carries Hexie + Wendy. Player controls vertical position and
  // forward speed; the world auto-scrolls.
  class Broom {
    constructor(x, y) {
      this.x = x; this.y = y;
      this.w = 70; this.h = 30;
      this.vy = 0;
      this.tilt = 0;
      this.speed = 1;          // 0.6 .. 1.8 multiplier
      this.trailT = 0;
      this.maxHp = 3;
      this.hp = 3;
      this.invuln = 0;
      this.dead = false;
      this.tailPhase = 0;
      this.bobT = 0;
    }
    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }

    hurt(game) {
      if (this.invuln > 0 || this.dead) return false;
      this.hp--;
      this.invuln = 1.4;
      A.hurt();
      game.cam.addShake(0.7);
      game.particles.burst(this.cx, this.cy, 16, {
        color: ["#ff4d6d", "#fff", "#ffd24d"], speedMin: 80, speedMax: 240,
        lifeMin: 0.3, lifeMax: 0.6, glow: true, g: 0, drag: 2,
      });
      if (this.hp <= 0) this.dead = true;
      return true;
    }

    update(dt, bounds, game) {
      if (this.invuln > 0) this.invuln -= dt;
      this.bobT += dt;
      this.tailPhase += dt * 12;
      const In = Hex.Input;
      const up = In.isDown("up");
      const down = In.isDown("down");
      // vertical steering
      const accY = 1100;
      if (up) this.vy -= accY * dt;
      else if (down) this.vy += accY * dt;
      else this.vy = M.approach(this.vy, 0, 900 * dt);
      this.vy = M.clamp(this.vy, -360, 360);
      this.y += this.vy * dt;
      // clamp to play area
      this.y = M.clamp(this.y, bounds.top, bounds.bottom - this.h);
      if (this.y <= bounds.top || this.y >= bounds.bottom - this.h) this.vy *= 0.3;
      this.tilt = M.lerp(this.tilt, M.clamp(this.vy / 360, -1, 1) * 0.4, 0.15);

      // speed control
      const fast = In.isDown("jump");
      const slow = In.isDown("slow") || In.isDown("down") === undefined;
      let target = 1;
      if (fast) target = 1.8;
      else if (In.isDown("slow")) target = 0.6;
      this.speed = M.lerp(this.speed, target, 0.1);

      // sparkle trail
      this.trailT -= dt;
      if (this.trailT <= 0 && !game.paused) {
        this.trailT = 0.03;
        game.particles.spawn({
          x: this.x - 6, y: this.cy + M.rand(-4, 8),
          vx: -120 - game.scrollSpeed * 0.4, vy: M.rand(-20, 20),
          life: M.rand(0.3, 0.6), size: M.rand(2, 4), g: 0, drag: 1.5,
          color: ["#ffd24d", "#ff8a3d", "#b48cff", "#8be9fd"][M.randInt(0, 3)],
          glow: true,
        });
      }
    }

    draw(ctx) {
      if (this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0) return;
      const cx = this.cx, cy = this.cy;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(this.tilt);
      const bob = Math.sin(this.bobT * 3) * 2;
      ctx.translate(0, bob);

      // broom stick
      ctx.strokeStyle = "#6b4a23";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-32, 6); ctx.lineTo(28, 0);
      ctx.stroke();
      // bristles (animated)
      ctx.strokeStyle = "#c98a3a";
      ctx.lineWidth = 2;
      for (let i = -3; i <= 3; i++) {
        const w = Math.sin(this.tailPhase + i) * 3;
        ctx.beginPath();
        ctx.moveTo(28, 0);
        ctx.lineTo(40, i * 2.4 + w);
        ctx.stroke();
      }

      // Wendy riding front
      ctx.save();
      ctx.translate(6, 2);
      ctx.scale(0.62, 0.62);
      ctx.translate(0, 6);
      drawWendy(ctx);
      ctx.restore();

      // Hexie riding behind
      ctx.save();
      ctx.translate(-20, 4);
      ctx.scale(0.55, 0.55);
      // small seated cat: reuse drawCat with a faux state
      drawCat(ctx, { state: "idle", runPhase: 0, animT: this.bobT, tailPhase: this.tailPhase,
        blinking: 0, earTwitch: 0 }, 0);
      ctx.restore();

      ctx.restore();
    }
  }
  Hex.Broom = Broom;

  // Duck flying in formation; an obstacle that hurts on contact.
  class Duck {
    constructor(x, y, opts) {
      opts = opts || {};
      this.w = 30; this.h = 22;
      this.x = x; this.y = y;
      this.baseY = y;
      this.amp = opts.amp != null ? opts.amp : 18;
      this.freq = opts.freq != null ? opts.freq : 2;
      this.phase = opts.phase || 0;
      this.vx = opts.vx != null ? opts.vx : -40; // relative drift on top of scroll
      this.flap = M.rand(0, 6);
      this.dead = false;
    }
    update(dt, scroll) {
      this.x -= scroll * dt;
      this.x += this.vx * dt;
      this.phase += dt * this.freq;
      this.y = this.baseY + Math.sin(this.phase) * this.amp;
      this.flap += dt * 14;
    }
    draw(ctx) {
      const cx = this.x + this.w / 2;
      const cy = this.y + this.h / 2;
      ctx.save();
      ctx.translate(cx, cy);
      // body
      ctx.fillStyle = "#2c3a52";
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // head
      ctx.beginPath();
      ctx.arc(-11, -4, 5, 0, Math.PI * 2);
      ctx.fill();
      // bill
      ctx.fillStyle = "#e0a23a";
      ctx.beginPath();
      ctx.moveTo(-15, -4); ctx.lineTo(-22, -2); ctx.lineTo(-15, 0); ctx.closePath();
      ctx.fill();
      // eye
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(-12, -5, 1.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.arc(-12, -5, 0.7, 0, Math.PI * 2); ctx.fill();
      // flapping wing
      ctx.fillStyle = "#445a7e";
      const wf = Math.sin(this.flap) * 8;
      ctx.beginPath();
      ctx.moveTo(2, -2);
      ctx.quadraticCurveTo(8, -8 - wf, 14, -2 - wf * 0.4);
      ctx.quadraticCurveTo(8, 2, 2, 2);
      ctx.closePath();
      ctx.fill();
      // tail
      ctx.fillStyle = "#2c3a52";
      ctx.beginPath();
      ctx.moveTo(11, -2); ctx.lineTo(18, -4); ctx.lineTo(12, 1); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  Hex.Duck = Duck;
})(window);
