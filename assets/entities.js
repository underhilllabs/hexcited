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

  /* ===================== LEVEL 3a: SWOOP BIRD ========================== */
  // A small bird that nests beside the climb and periodically dives in a
  // downward arc to swipe at Hexie, then loops back up to its perch. Side
  // contact hurts; stomp it from above to pop it (same rules as Churchfolk).
  class SwoopBird {
    constructor(x, y, opts) {
      opts = opts || {};
      this.w = 26; this.h = 18;
      this.homeX = x; this.homeY = y;
      this.x = x; this.y = y;
      this.range = opts.range != null ? opts.range : 430;   // trigger radius
      this.maxDepth = opts.depth != null ? opts.depth : 190; // dive distance
      this.face = opts.face != null ? opts.face : 1;         // perched facing
      this.dead = false;
      this.squish = 0;
      this.vy = 0;
      this.state = "perch";      // perch | dive | return
      this.cooldown = M.rand(0.8, 2.2);
      this.t = 0;
      this.dir = -1;
      this.flap = M.rand(0, 6);
      this.bob = M.rand(0, Math.PI * 2);
      this.arcW = 200; this.depth = this.maxDepth;
      this.fromX = x; this.fromY = y;
    }
    update(dt, solids, game) {
      if (this.dead) {                 // popped — tumble away
        this.vy += 1800 * dt;
        this.y += this.vy * dt;
        return;
      }
      this.flap += dt * 20;
      const p = game.player;

      if (this.state === "perch") {
        this.bob += dt * 3;
        this.x = this.homeX;
        this.y = this.homeY + Math.sin(this.bob) * 4;
        this.cooldown -= dt;
        if (this.cooldown <= 0 && p && !p.dead) {
          const dx = p.cx - (this.x + this.w / 2);
          const dy = p.y - this.y;
          if (Math.abs(dx) < this.range && dy > -60 && dy < this.range) {
            this.state = "dive";
            this.t = 0;
            this.dir = dx >= 0 ? 1 : -1;
            this.fromX = this.x; this.fromY = this.y;
            this.arcW = M.clamp(Math.abs(dx) + 70, 120, 300);
            this.depth = M.clamp(dy + 40, 90, this.maxDepth);
            A.swoop();
          }
        }
      } else if (this.state === "dive") {
        // parametric down-and-up arc, returning to perch altitude
        this.t = Math.min(1, this.t + dt * 1.5);
        this.x = this.fromX + this.dir * this.arcW * this.t;
        this.y = this.fromY + Math.sin(this.t * Math.PI) * this.depth;
        if (this.t >= 1) {
          this.state = "return";
          this.t = 0;
          this.fromX = this.x; this.fromY = this.y;
        }
      } else {                          // return — ease back to the perch
        this.t = Math.min(1, this.t + dt * 0.9);
        const k = this.t * this.t * (3 - 2 * this.t);   // smoothstep
        this.x = M.lerp(this.fromX, this.homeX, k);
        this.y = M.lerp(this.fromY, this.homeY, k);
        if (this.t >= 1) {
          this.state = "perch";
          this.cooldown = M.rand(1.4, 3.0);
        }
      }
    }
    stomp(game) {
      this.dead = true;
      this.vy = -260;
      this.squish = 1;
      A.stomp();
      game.cam.addShake(0.3);
      game.addScore(120, this.x + this.w / 2, this.y);
      game.particles.burst(this.x + this.w / 2, this.y + this.h / 2, 16, {
        color: ["#9a8cff", "#d8c8ff", "#fff", "#5a4a8a"], speedMin: 60, speedMax: 220,
        lifeMin: 0.3, lifeMax: 0.7, glow: true, g: 500,
      });
    }
    draw(ctx) {
      const cx = this.x + this.w / 2;
      const cy = this.y + this.h / 2;
      ctx.save();
      ctx.translate(cx, cy);
      if (this.dead) {
        this.squish = Math.max(0, this.squish - 0.04);
        ctx.globalAlpha = this.squish;
        ctx.scale(this.dir < 0 ? -1 : 1, 1);
        ctx.rotate(0.7);
      } else {
        const facing = this.state === "perch" ? this.face : this.dir;
        ctx.scale(facing, 1);
        // nose-down tilt through the dive
        if (this.state === "dive") ctx.rotate(Math.sin(this.t * Math.PI) * 0.5);
      }
      // body
      ctx.fillStyle = "#3a2c5c";
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // head
      ctx.beginPath();
      ctx.arc(8, -3, 5, 0, Math.PI * 2);
      ctx.fill();
      // beak
      ctx.fillStyle = "#e0a23a";
      ctx.beginPath();
      ctx.moveTo(12, -3); ctx.lineTo(19, -1); ctx.lineTo(12, 1); ctx.closePath();
      ctx.fill();
      // eye
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(9, -4, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1a0f2a";
      ctx.beginPath(); ctx.arc(9.3, -4, 0.8, 0, Math.PI * 2); ctx.fill();
      // flapping wing
      ctx.fillStyle = "#5a4a8a";
      const wf = Math.sin(this.flap) * 9;
      ctx.beginPath();
      ctx.moveTo(-1, -1);
      ctx.quadraticCurveTo(-8, -9 - wf, -15, -2 - wf * 0.3);
      ctx.quadraticCurveTo(-8, 1, -1, 1);
      ctx.closePath();
      ctx.fill();
      // tail
      ctx.fillStyle = "#3a2c5c";
      ctx.beginPath();
      ctx.moveTo(-9, -1); ctx.lineTo(-16, -3); ctx.lineTo(-10, 2); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  Hex.SwoopBird = SwoopBird;

  /* ===================== LEVEL 3 BOSS: THE GIANT BIRD ================== */
  // A great raptor guarding its nest. It hovers high, swoops across the arena
  // (side contact hurts Hexie), then briefly perches low with its head within
  // reach. Stomp the head to damage it; each hit sends it into a 5-second
  // head-shake stun (a safe window) before it resumes. Three hits and it falls.
  const BOSS = {
    intro: 1.5, hover: 1.2, swoop: 1.6, perch: 2.5, stunned: 5.0,
  };

  class BirdBoss {
    constructor(arena) {
      this.w = 150; this.h = 86;
      this.homeCx = (arena && arena.width ? arena.width : 960) / 2;
      this.hoverY = arena ? arena.hoverY : 90;
      this.perchY = arena ? arena.perchY : 374;
      this.x = this.homeCx - this.w / 2;
      this.y = this.hoverY - 120;     // swoops in from above during intro
      this.vy = 0;
      this.hp = 3;
      this.maxHp = 3;
      this.dead = false;              // for symmetry; "defeated" state is canonical
      this.state = "intro";
      this.stateT = 0;
      this.side = -1;                 // alternates swoop/perch direction
      this.swoopFrom = 0; this.swoopTo = 0;
      this.headShakeT = 0;
      this.wing = 0; this.bob = M.rand(0, 6); this.tilt = 0;
    }

    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }

    // The stompable head region (top-front of the bird).
    headRect() {
      return { x: this.cx - 26, y: this.y, w: 52, h: 40 };
    }

    _setState(s) {
      this.state = s;
      this.stateT = 0;
      if (s === "swoop") {
        this.side = -this.side;
        const a = 200, b = (this.homeCx * 2) - 200;
        if (this.side < 0) { this.swoopFrom = a; this.swoopTo = b; }
        else { this.swoopFrom = b; this.swoopTo = a; }
        A.swoop();
      } else if (s === "stunned") {
        this.headShakeT = 0;
      }
    }

    // Player landed on the head. Only vulnerable while perched.
    hitHead(game) {
      if (this.state !== "perch") return false;
      this.hp--;
      A.stomp();
      game.cam.addShake(0.55);
      game.addScore(300, this.cx, this.y + 8);
      game.particles.burst(this.cx, this.y + 12, 24, {
        color: ["#d8c8ff", "#fff", "#8a6a3a", "#ffd24d"], speedMin: 60, speedMax: 260,
        lifeMin: 0.3, lifeMax: 0.8, glow: true, g: 400,
      });
      if (this.hp <= 0) {
        this._setState("defeated");
        this.vy = -220; this.dead = true;
      } else {
        this._setState("stunned");
      }
      return true;
    }

    hurtPlayer(player, game) {
      return player.hurt(this.cx, game);
    }

    update(dt, arena, game) {
      this.stateT += dt;
      this.bob += dt * 2.4;
      this.wing += dt * (this.state === "swoop" ? 18 : 9);

      switch (this.state) {
        case "intro": {
          this.x = M.lerp(this.x, this.homeCx - this.w / 2, 0.06);
          this.y = M.lerp(this.y, this.hoverY, 0.06);
          this.tilt = M.lerp(this.tilt, 0, 0.1);
          if (this.stateT >= BOSS.intro) this._setState("hover");
          break;
        }
        case "hover": {
          this.x = M.lerp(this.x, this.homeCx - this.w / 2, 0.08);
          this.y = this.hoverY + Math.sin(this.bob) * 8;
          // lean toward the swoop side as a telegraph in the last beat
          const tele = this.stateT > BOSS.hover - 0.4 ? this.side * 0.25 : 0;
          this.tilt = M.lerp(this.tilt, tele, 0.15);
          if (this.stateT >= BOSS.hover) this._setState("swoop");
          break;
        }
        case "swoop": {
          const u = M.clamp(this.stateT / BOSS.swoop, 0, 1);
          const cx = M.lerp(this.swoopFrom, this.swoopTo, u);
          this.x = cx - this.w / 2;
          this.y = this.hoverY + Math.sin(u * Math.PI) * (this.perchY - this.hoverY) * 1.15;
          this.tilt = (this.swoopTo - this.swoopFrom > 0 ? 1 : -1) * 0.35 * Math.sin(u * Math.PI);
          if (this.stateT >= BOSS.swoop) this._setState("perch");
          break;
        }
        case "perch": {
          // settle at an edge with the head low + reachable
          const px = this.side < 0 ? 260 : (this.homeCx * 2) - 260;
          this.x = M.lerp(this.x, px - this.w / 2, 0.2);
          this.y = M.lerp(this.y, this.perchY, 0.25);
          this.tilt = M.lerp(this.tilt, 0, 0.2);
          if (this.stateT >= BOSS.perch) this._setState("hover");
          break;
        }
        case "stunned": {
          this.headShakeT += dt;
          this.y = this.perchY + Math.sin(this.bob * 1.5) * 3;
          this.tilt = Math.sin(this.headShakeT * 26) * 0.12;
          if (this.stateT >= BOSS.stunned) this._setState("hover");
          break;
        }
        case "defeated": {
          this.vy += 1200 * dt;
          this.y += this.vy * dt;
          this.tilt += dt * 1.6;
          if (Math.random() < 0.6) {
            game.particles.spawn({
              x: this.cx + M.rand(-40, 40), y: this.cy + M.rand(-20, 20),
              vx: M.rand(-40, 40), vy: M.rand(-20, 60), g: 200,
              life: M.rand(0.4, 0.9), size: M.rand(2, 4),
              color: ["#d8c8ff", "#8a6a3a", "#fff"][M.randInt(0, 2)], glow: true,
            });
          }
          break;
        }
      }
    }

    draw(ctx) {
      const cx = this.cx;
      const bodyY = this.y + 50;
      ctx.save();
      ctx.translate(cx, bodyY);
      ctx.rotate(this.tilt);

      const stunned = this.state === "stunned";
      const facing = this.side < 0 ? -1 : 1;

      // --- wings (behind body) ---
      const wf = Math.sin(this.wing) * (this.state === "swoop" ? 26 : 14);
      ctx.fillStyle = "#1d2a3a";
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.quadraticCurveTo(dir * 60, -30 - wf, dir * 96, 6 - wf * 0.5);
        ctx.quadraticCurveTo(dir * 60, 18, 0, 14);
        ctx.closePath();
        ctx.fill();
      }

      // --- body ---
      ctx.fillStyle = "#2c3a52";
      ctx.beginPath();
      ctx.ellipse(0, 0, 52, 34, 0, 0, Math.PI * 2);
      ctx.fill();
      // breast highlight
      ctx.fillStyle = "#3b4d6b";
      ctx.beginPath();
      ctx.ellipse(facing * 8, 6, 34, 24, 0, 0, Math.PI * 2);
      ctx.fill();

      // --- tail ---
      ctx.fillStyle = "#1d2a3a";
      ctx.beginPath();
      ctx.moveTo(-facing * 40, 4);
      ctx.lineTo(-facing * 78, -8);
      ctx.lineTo(-facing * 78, 16);
      ctx.closePath();
      ctx.fill();

      // talons
      ctx.strokeStyle = "#c98a3a";
      ctx.lineWidth = 4; ctx.lineCap = "round";
      for (const tx of [-14, 14]) {
        ctx.beginPath();
        ctx.moveTo(tx, 30); ctx.lineTo(tx, 40);
        ctx.stroke();
      }

      // --- neck + head group (head sits near the top of the AABB) ---
      ctx.save();
      // head center, relative to bodyY, is at (~facing*10, this.y-bodyY+20)
      const headLocalY = (this.y - bodyY) + 18;
      const headLocalX = facing * 10;
      // head-shake wobble while stunned
      ctx.translate(headLocalX, headLocalY);
      if (stunned) ctx.rotate(Math.sin(this.headShakeT * 30) * 0.5);
      // neck
      ctx.strokeStyle = "#2c3a52";
      ctx.lineWidth = 16; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, 30); ctx.lineTo(0, 6);
      ctx.stroke();
      // head
      ctx.fillStyle = "#2c3a52";
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      // crest feathers
      ctx.fillStyle = "#1d2a3a";
      ctx.beginPath();
      ctx.moveTo(-6, -12); ctx.lineTo(-14, -26); ctx.lineTo(0, -14);
      ctx.lineTo(12, -28); ctx.lineTo(6, -10); ctx.closePath();
      ctx.fill();
      // hooked beak
      ctx.fillStyle = "#e0a23a";
      ctx.beginPath();
      ctx.moveTo(facing * 10, -2);
      ctx.lineTo(facing * 30, 2);
      ctx.lineTo(facing * 12, 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#c07f24";
      ctx.beginPath();
      ctx.moveTo(facing * 22, 3); ctx.lineTo(facing * 30, 2); ctx.lineTo(facing * 24, 7);
      ctx.closePath();
      ctx.fill();
      // glowing eye(s)
      if (stunned) {
        // dizzy "x" eyes during the shake
        ctx.strokeStyle = "#ffd24d"; ctx.lineWidth = 2;
        for (const ex of [facing * 4, facing * 12]) {
          ctx.beginPath();
          ctx.moveTo(ex - 3, -6); ctx.lineTo(ex + 3, 0);
          ctx.moveTo(ex + 3, -6); ctx.lineTo(ex - 3, 0);
          ctx.stroke();
        }
      } else {
        ctx.save();
        ctx.shadowColor = "#ff5a3d"; ctx.shadowBlur = 12;
        ctx.fillStyle = "#ffb14d";
        ctx.beginPath();
        ctx.arc(facing * 6, -3, 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#2a0e00";
        ctx.beginPath();
        ctx.arc(facing * 6, -3, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();   // head group

      ctx.restore();   // bird
    }
  }
  Hex.BirdBoss = BirdBoss;
})(window);
