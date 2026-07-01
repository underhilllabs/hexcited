/* Hexcited — Hexie's Rescue
   entities.js — player physics, enemies, boss. */
(function () {
  'use strict';
  const HX = window.Hexcited;
  const U = HX.util;
  const FX = HX.FX;
  const A = HX.Audio;
  const Art = HX.Art;

  const GRAV = 2300;
  const MAX_FALL = 1000;

  /* box helper: entities use x = center, y = feet */
  function boxOf(e) {
    return { l: e.x - e.w / 2, t: e.y - e.h, r: e.x + e.w / 2, b: e.y };
  }
  HX.boxOf = boxOf;

  function overlaps(b, s) {
    return b.l < s.x + s.w && b.r > s.x && b.t < s.y + s.h && b.b > s.y;
  }

  /* ================================================= PLAYER (Hexie) */
  HX.Player = class Player {
    constructor(x, y) {
      this.x = x; this.y = y;
      this.w = 32; this.h = 28;
      this.vx = 0; this.vy = 0;
      this.face = 1;
      this.onGround = false;
      this.coyote = 0;
      this.jbuf = 0;
      this.jumping = false;
      this.hearts = 3;
      this.invuln = 0;
      this.hurtT = 0;
      this.t = Math.random() * 10;
      this.sy = 1;
      this.angle = 0;
      this.dead = false;
      this.deadT = 0;
      this.safeX = x; this.safeY = y; this.safeT = 0;
      this.prevBottom = y;
      // level-2 flight
      this.flySpeed = 260;
    }

    get box() { return boxOf(this); }

    /* ---------------- on-foot platforming ---------------- */
    updateFoot(dt, G) {
      const I = HX.Input;
      this.t += dt;
      this.invuln = Math.max(0, this.invuln - dt);
      this.coyote -= dt;
      this.jbuf -= dt;
      this.sy = U.damp(this.sy, 1, 14, dt);

      if (this.dead) {
        this.deadT += dt;
        this.vy += GRAV * dt;
        this.y += this.vy * dt;
        this.angle += 7 * dt;
        return;
      }

      if (this.hurtT > 0) {
        this.hurtT -= dt;
      } else {
        const left = I.down('left'), right = I.down('right');
        const accel = this.onGround ? 3200 : 2100;
        if (left && !right) { this.vx -= accel * dt; this.face = -1; }
        else if (right && !left) { this.vx += accel * dt; this.face = 1; }
        else {
          const fr = (this.onGround ? 3000 : 500) * dt;
          if (Math.abs(this.vx) <= fr) this.vx = 0;
          else this.vx -= U.sgn(this.vx) * fr;
        }
        this.vx = U.clamp(this.vx, -330, 330);
      }

      // jump buffer + coyote time
      if (I.pressed('jump') || I.pressed('up')) this.jbuf = 0.12;
      if (this.jbuf > 0 && this.coyote > 0 && this.hurtT <= 0) {
        this.vy = -790;
        this.jumping = true;
        this.coyote = 0;
        this.jbuf = 0;
        this.sy = 1.28;
        A.sfx('jump');
        FX.dust(this.x, this.y, 5);
      }
      // variable jump height: release to cut the jump short
      if (this.jumping && !I.down('jump') && !I.down('up') && this.vy < -280) this.vy = -280;

      this.vy += GRAV * dt;
      if (this.vy > MAX_FALL) this.vy = MAX_FALL;

      const wasAir = !this.onGround;
      const fallVy = this.vy;
      this.moveAndCollide(dt, G.solids, G.oneways);

      if (this.onGround) {
        this.coyote = 0.1;
        this.jumping = false;
        if (wasAir && fallVy > 380) {
          this.sy = 0.72;
          FX.dust(this.x, this.y, fallVy > 750 ? 10 : 6);
          A.sfx('land');
          if (fallVy > 850) FX.shake(4, 0.15);
        }
        // remember a safe respawn spot
        this.safeT += dt;
        if (this.safeT > 0.25) { this.safeX = this.x; this.safeY = this.y; }
      } else {
        this.safeT = 0;
      }
    }

    /* robust axis-separated AABB resolution — X first, then Y */
    moveAndCollide(dt, solids, oneways) {
      // X axis
      this.x += this.vx * dt;
      let b = this.box;
      for (const s of solids) {
        if (overlaps(b, s)) {
          if (this.x < s.x + s.w / 2) this.x = s.x - this.w / 2;
          else this.x = s.x + s.w + this.w / 2;
          this.vx = 0;
          b = this.box;
        }
      }
      // Y axis
      const prevB = this.y;
      const prevT = this.y - this.h;
      this.prevBottom = prevB;
      this.y += this.vy * dt;
      b = this.box;
      this.onGround = false;
      for (const s of solids) {
        if (!overlaps(b, s)) continue;
        if (this.vy > 0 && prevB <= s.y + 0.01) {
          this.y = s.y; this.vy = 0; this.onGround = true;
        } else if (this.vy < 0 && prevT >= s.y + s.h - 0.01) {
          this.y = s.y + s.h + this.h; this.vy = 0;
        } else {
          // fallback: smallest vertical push-out
          const upPen = b.b - s.y;
          const downPen = s.y + s.h - b.t;
          if (upPen <= downPen) { this.y = s.y; if (this.vy > 0) { this.vy = 0; this.onGround = true; } }
          else { this.y = s.y + s.h + this.h; if (this.vy < 0) this.vy = 0; }
        }
        b = this.box;
      }
      // one-way platforms: only land when coming from above
      if (this.vy >= 0) {
        for (const s of oneways) {
          if (overlaps(b, s) && prevB <= s.y + 4) {
            this.y = s.y; this.vy = 0; this.onGround = true;
            b = this.box;
          }
        }
      }
    }

    /* ---------------- broom flight (level 2) ---------------- */
    updateFly(dt, G) {
      const I = HX.Input;
      this.t += dt;
      this.invuln = Math.max(0, this.invuln - dt);

      if (this.dead) {
        this.deadT += dt;
        this.vy += GRAV * 0.7 * dt;
        this.y += this.vy * dt;
        this.x += this.flySpeed * 0.4 * dt;
        this.angle += 5 * dt;
        return;
      }

      // steer up/down
      const up = I.down('up') || I.down('jump');
      const down = I.down('down');
      if (up && !down) this.vy -= 1700 * dt;
      else if (down && !up) this.vy += 1700 * dt;
      else this.vy = U.damp(this.vy, 0, 6, dt);
      this.vy = U.clamp(this.vy, -330, 330);

      // throttle
      let target = 280;
      if (I.down('right')) target = 430;
      else if (I.down('left')) target = 170;
      this.flySpeed = U.damp(this.flySpeed, target, 3, dt);

      this.x += this.flySpeed * dt;
      this.y += this.vy * dt;
      if (this.y < 70) { this.y = 70; this.vy = Math.max(0, this.vy); }
      if (this.y > HX.H - 50) { this.y = HX.H - 50; this.vy = Math.min(0, this.vy); }
      this.angle = U.clamp(this.vy * 0.0009, -0.3, 0.3) - (this.flySpeed - 280) * 0.0003;

      // broom sparkle trail
      if (Math.random() < dt * 30) {
        FX.spawn({
          x: this.x - 60, y: this.y + 12 + U.rand(-6, 6),
          vx: -60, vy: U.rand(-15, 15),
          life: 0.5, size: 2.5, color: '#c9a9ff', type: 'star', spin: 4,
        });
      }
    }

    hurt(fromX, G) {
      if (this.invuln > 0 || this.dead) return false;
      this.hearts--;
      A.sfx('hurt');
      FX.shake(7, 0.3);
      FX.hit(0.06);
      FX.burst(this.x, this.y - 14, 8, { speed: 100, life: 0.4, size: 3, color: '#ff5f8f', type: 'dot' });
      if (this.hearts <= 0) {
        this.die();
        return true;
      }
      this.invuln = 1.6;
      this.hurtT = 0.32;
      this.vx = U.sgn(this.x - (fromX !== undefined ? fromX : this.x - 1)) * 260;
      this.vy = -330;
      return true;
    }

    die() {
      if (this.dead) return;
      this.dead = true;
      this.deadT = 0;
      this.vy = -640;
      this.vx = 0;
      A.sfx('die');
      FX.shake(9, 0.4);
    }

    respawn() {
      this.x = this.safeX;
      this.y = this.safeY - 4;
      this.vx = 0; this.vy = 0;
      this.invuln = 2;
    }

    pose(mode) {
      if (this.dead) return 'dead';
      if (mode === 'fly') return 'broom';
      if (this.hurtT > 0) return 'hurt';
      if (!this.onGround) return this.vy < 0 ? 'jump' : 'fall';
      if (Math.abs(this.vx) > 20) return 'run';
      return 'idle';
    }

    draw(ctx, mode) {
      // invulnerability blink
      if (this.invuln > 0 && !this.dead && Math.floor(this.t * 16) % 2 === 0) return;
      if (mode === 'fly') {
        Art.broomTrio(ctx, { x: this.x, y: this.y, angle: this.angle, t: this.t });
      } else {
        Art.hexie(ctx, {
          x: this.x, y: this.y,
          face: this.face,
          pose: this.pose(mode),
          t: this.t,
          sy: this.sy,
          angle: this.dead ? this.angle : 0,
          blink: (this.t % 3.1) < 0.12,
        });
      }
    }
  };

  /* ================================================= WALKER (churchfolk) */
  HX.Walker = class Walker {
    constructor(x, y, minX, maxX) {
      this.x = x; this.y = y;
      this.w = 26; this.h = 46;
      this.minX = minX; this.maxX = maxX;
      this.face = U.chance(0.5) ? 1 : -1;
      this.speed = U.rand(52, 74);
      this.t = Math.random() * 10;
      this.dead = false;
      this.squash = 0;
      this.stompable = true;
      this.gone = false;
    }
    update(dt) {
      this.t += dt;
      if (this.dead) {
        this.squash += dt;
        if (this.squash > 0.8) this.gone = true;
        return;
      }
      this.x += this.face * this.speed * dt;
      if (this.x < this.minX) { this.x = this.minX; this.face = 1; }
      if (this.x > this.maxX) { this.x = this.maxX; this.face = -1; }
    }
    stomp() {
      this.dead = true;
      this.stompable = false;
      this.squash = 0;
    }
    draw(ctx) { Art.churchman(ctx, this); }
  };

  /* ================================================= DUCK (level 2) */
  HX.Duck = class Duck {
    constructor(x, y) {
      this.x = x; this.y = y;
      this.baseY = y;
      this.w = 30; this.h = 18;
      this.vx = U.rand(-150, -110);
      this.phase = Math.random() * 6.3;
      this.t = Math.random() * 10;
      this.face = -1;
      this.hit = false;
      this.rot = 0;
      this.vy = 0;
      this.gone = false;
      this.stompable = false;
    }
    update(dt, G) {
      this.t += dt;
      if (this.hit) {
        this.rot += 9 * dt;
        this.vy += 1500 * dt;
        this.y += this.vy * dt;
        this.x += this.vx * 0.5 * dt;
        if (this.y > HX.H + 60) this.gone = true;
        return;
      }
      this.x += this.vx * dt;
      this.y = this.baseY + Math.sin(this.t * 4 + this.phase) * 14;
      if (G.player && this.x < G.player.x - 620) this.gone = true;
    }
    knock() {
      this.hit = true;
      this.vy = -220;
      A.sfx('quack');
      FX.feathers(this.x, this.y, 7, '#d8c9a8');
    }
    draw(ctx) { Art.duck(ctx, this); }
  };

  /* ================================================= SWOOPER (level 3) */
  HX.Swooper = class Swooper {
    constructor(x, y, dir) {
      this.x = x; this.y = y;
      this.x0 = x; this.y0 = y;
      this.w = 30; this.h = 18;
      this.dir = dir;         // travel direction
      this.face = dir;
      this.prog = 0;
      this.t = Math.random() * 10;
      this.dead = false;
      this.gone = false;
      this.stompable = true;
    }
    update(dt, G) {
      this.t += dt;
      if (this.dead) {
        this.y += 500 * dt;
        this.x += this.dir * 60 * dt;
        if (this.y > this.y0 + 900) this.gone = true;
        return;
      }
      // arcing dive: horizontal sweep with a sine plunge
      this.prog += dt;
      this.x = this.x0 + this.dir * 270 * this.prog;
      this.y = this.y0 + 190 * Math.sin(Math.min(this.prog * 1.7, Math.PI));
      if (this.prog * 1.7 > Math.PI + 0.4 || this.x < -80 || this.x > HX.W + 80) this.gone = true;
      if (Math.random() < dt * 2) A.sfx('flap');
    }
    stomp() {
      this.dead = true;
      this.stompable = false;
      FX.feathers(this.x, this.y, 9, '#3a4470');
    }
    draw(ctx) { Art.swooper(ctx, this); }
  };

  /* ================================================= GIANT BIRD (boss) */
  HX.Boss = class Boss {
    constructor(cx, nestTop) {
      this.cx = cx;                 // arena center
      this.nestTop = nestTop;
      this.x = cx; this.y = -120;   // flies in from above
      this.w = 120; this.h = 70;
      this.face = 1;
      this.hp = 3;
      this.rage = 0;
      this.state = 'enter';
      this.t = 0;
      this.st = 0;                  // time in state
      this.flash = 0;
      this.fold = 0;                // wings folded (perched)
      this.headDrop = 0;
      this.sx = 0; this.sy0 = 0;    // swoop start
      this.tx = 0; this.ty = 0;     // swoop target
      this.dead = false;
      this.doneFor = false;
    }

    /* stompable head hitbox — only meaningful while perched */
    headBox() {
      return { x: this.x + this.face * 34 - 22, y: this.y - 26 + this.headDrop * 22 - 18, w: 44, h: 34 };
    }
    bodyBox() {
      return { x: this.x - 45, y: this.y - 28, w: 90, h: 62 };
    }

    setState(s) { this.state = s; this.st = 0; }

    update(dt, G, P) {
      this.t += dt;
      this.st += dt;
      this.flash = Math.max(0, this.flash - dt * 2.5);
      const speedUp = 1 + this.rage * 0.22;

      switch (this.state) {
        case 'enter': {
          const k = Math.min(1, this.st / 1.6);
          this.y = U.lerp(-120, this.nestTop - 260, 1 - (1 - k) * (1 - k));
          this.x = this.cx;
          this.fold = U.damp(this.fold, 0, 8, dt);
          if (k >= 1) {
            HX.Audio.sfx('screech');
            FX.shake(6, 0.3);
            this.setState('hover');
          }
          break;
        }
        case 'hover': {
          this.fold = U.damp(this.fold, 0, 8, dt);
          this.headDrop = U.damp(this.headDrop, 0, 8, dt);
          this.y = U.damp(this.y, this.nestTop - 250 + Math.sin(this.t * 2.4) * 12, 4, dt);
          this.x = U.damp(this.x, U.clamp(P.x, this.cx - 220, this.cx + 220), 2.2, dt);
          this.face = P.x >= this.x ? 1 : -1;
          if (this.st > 1.5 / speedUp) {
            // telegraph then swoop
            HX.Audio.sfx('screech');
            this.sx = this.x;
            this.sy0 = this.y;
            this.tx = U.clamp(P.x, this.cx - 300, this.cx + 300);
            this.ty = Math.min(this.nestTop - 30, Math.max(P.y - 20, this.nestTop - 160));
            this.face = this.tx >= this.x ? 1 : -1;
            this.setState('aim');
          }
          break;
        }
        case 'aim': {
          this.y += Math.sin(this.st * 40) * 1.2; // menacing shudder
          if (this.st > 0.38) this.setState('swoop');
          break;
        }
        case 'swoop': {
          const dur = 0.95 / speedUp;
          const k = Math.min(1, this.st / dur);
          const endX = this.sx + (this.tx - this.sx) * 2.1; // fly past the target
          this.x = U.lerp(this.sx, endX, k);
          this.y = this.sy0 + (this.ty - this.sy0) * Math.sin(Math.PI * k);
          if (k > 0.3 && k < 0.75 && Math.random() < dt * 20) {
            FX.spawn({ x: this.x - this.face * 50, y: this.y + 10, vx: -this.face * 60, vy: U.rand(-20, 20), life: 0.4, size: 3, color: 'rgba(255,255,255,0.5)', type: 'spark' });
          }
          if (k >= 1) {
            this.swoops = (this.swoops || 0) + 1;
            if (this.swoops % 2 === 0 || this.rage === 0) this.setState('perchIn');
            else this.setState('hover');
          }
          break;
        }
        case 'perchIn': {
          // land on the nest rim
          const px = this.cx + (P.x > this.cx ? -140 : 140);
          this.x = U.damp(this.x, px, 6, dt);
          this.y = U.damp(this.y, this.nestTop - 32, 6, dt);
          this.fold = U.damp(this.fold, 1, 6, dt);
          this.face = this.cx >= this.x ? 1 : -1;
          if (Math.abs(this.y - (this.nestTop - 32)) < 4 && Math.abs(this.x - px) < 8) {
            FX.dust(this.x, this.nestTop, 8);
            FX.shake(4, 0.2);
            this.setState('perch');
          }
          break;
        }
        case 'perch': {
          // vulnerable: head drops down, panting
          this.headDrop = U.damp(this.headDrop, 1, 6, dt);
          this.fold = 1;
          if (this.st > 2.5 - this.rage * 0.35) {
            this.headDrop = 0;
            this.setState('hover');
          }
          break;
        }
        case 'hitstun': {
          this.fold = 1;
          this.y = this.nestTop - 32 + Math.sin(this.st * 34) * 3;
          if (this.st > 0.9) {
            this.rage++;
            this.setState('hover');
          }
          break;
        }
        case 'dying': {
          this.angleSpin = (this.angleSpin || 0) + dt * 3;
          this.x += Math.sin(this.st * 6) * 120 * dt;
          this.y += 260 * dt;
          this.fold = 0;
          if (Math.random() < dt * 25) FX.feathers(this.x + U.rand(-40, 40), this.y + U.rand(-20, 20), 2, '#a06b2c');
          if (this.st > 2.2) { this.doneFor = true; }
          break;
        }
      }
    }

    /* returns true if the hit landed */
    stompHit(P) {
      if (this.state !== 'perch') return false;
      this.hp--;
      this.flash = 0.6;
      this.headDrop = 0;
      HX.Audio.sfx('bossHit');
      FX.shake(10, 0.4);
      FX.hit(0.09);
      FX.feathers(this.x + this.face * 34, this.y - 10, 12, '#a06b2c');
      FX.addText(this.x, this.y - 70, this.hp > 0 ? 'STOMP!' : 'FINISHED!', '#ffd66e');
      if (this.hp <= 0) {
        this.dead = true;
        HX.Audio.sfx('screech');
        this.setState('dying');
      } else {
        this.setState('hitstun');
      }
      return true;
    }

    /* player takes contact damage only while the boss is attacking */
    dangerous() {
      return this.state === 'swoop' || this.state === 'aim';
    }

    draw(ctx) {
      ctx.save();
      if (this.state === 'dying') {
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.sin(this.st * 5) * 0.5);
        ctx.translate(-this.x, -this.y);
      }
      Art.boss(ctx, this);
      ctx.restore();
    }
  };
})();
