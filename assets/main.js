/* =========================================================================
   Hexcited — main.js
   Game state machine, rendering pipeline, HUD, level flow, and the finale.
   Ties together engine + entities + levels + audio. Attaches to Hex.Game.
   ========================================================================= */
(function (global) {
  "use strict";
  const Hex = global.Hex;
  const M = Hex.M;
  const A = Hex.Audio;
  const L = Hex.Levels;
  const BG = L.BG;
  const VIEW_W = L.VIEW_W, VIEW_H = L.VIEW_H;

  const STATE = {
    START: "start", L1: "l1", TRANSITION: "transition",
    L2: "l2", FINALE: "finale",
    L3A: "l3a", L3B: "l3b",
    WIN: "win", GAMEOVER: "gameover",
  };

  const BASE_SCROLL = 190;   // level-2 base auto-scroll speed (px/s)

  const Game = {
    init() {
      this.canvas = document.getElementById("game");
      this.ctx = this.canvas.getContext("2d");
      this.cam = new Hex.Camera(VIEW_W, VIEW_H);
      this.particles = new Hex.Particles(700);
      this.state = STATE.START;
      this.score = 0;
      this.pumpkins = 0;
      this.time = 0;
      this.paused = false;
      this.scrollSpeed = BASE_SCROLL;
      this.deathTimer = 0;
      this.finaleT = 0;
      this.flash = 0;
      this.ambientT = 0;
      this.bg = 1;          // which backdrop to draw on non-playing screens (1|2|3)
      this._bgSub = "a";    // for bg===3: "a" = the climb, "b" = the nest
      this.boss = null;
      this._transTo = "l2"; // where the transition "Continue" button leads

      Hex.Input.init();
      this._bindUI();

      this.loop = new Hex.Loop((dt) => this.step(dt), () => this.render());
      this.loop.start();
    },

    _bindUI() {
      this.ui = {
        hud: document.getElementById("hud"),
        start: document.getElementById("start"),
        transition: document.getElementById("transition"),
        win: document.getElementById("win"),
        gameover: document.getElementById("gameover"),
        pause: document.getElementById("pause"),
        scoreVal: document.getElementById("score-val"),
        pumpkinVal: document.getElementById("pumpkin-val"),
        hearts: document.getElementById("hud-hearts"),
        levelLabel: document.getElementById("hud-level"),
        winTally: document.getElementById("win-tally"),
        transTitle: document.getElementById("transition-title"),
        transText: document.getElementById("transition-text"),
        bossHp: document.getElementById("boss-hp"),
      };
      const start = () => { A.resume(); A.select(); this.startGame(); };
      document.getElementById("start-btn").addEventListener("click", start);
      document.getElementById("transition-btn").addEventListener("click", () => {
        A.select(); this.continueTransition();
      });
      document.getElementById("win-btn").addEventListener("click", () => {
        A.resume(); A.select(); this.startGame();
      });
      document.getElementById("gameover-btn").addEventListener("click", () => {
        A.select(); this.restartCurrent();
      });
    },

    show(el) { this.ui[el].classList.remove("hidden"); },
    hide(el) { this.ui[el].classList.add("hidden"); },

    /* --------------------------- flow control --------------------------- */
    startGame() {
      this.score = 0;
      this.pumpkins = 0;
      this.startLevel1();
    },

    // Jump straight into the broom level (handy for practice / exploring)
    startAtLevel2() {
      this.score = 0;
      this.pumpkins = 0;
      this.beginLevel2();
    },

    // Jump straight into the climb (level select / practice) — lands at 3a
    startAtLevel3() {
      this.score = 0;
      this.pumpkins = 0;
      this.startLevel3();
    },

    startLevel1() {
      this.level = L.buildLevel1();
      this.player = new Hex.Hexie(this.level.spawn.x, this.level.spawn.y);
      this.cam.setBounds(0, 0, this.level.width, this.level.height);
      this.cam.snapTo(this.player.x - VIEW_W / 2, 0);
      this.particles.clear();
      this.state = STATE.L1;
      this.bg = 1;
      this.deathTimer = 0;
      this.hide("start"); this.hide("transition"); this.hide("win");
      this.hide("gameover"); this.hide("pause");
      this.show("hud");
      this.ui.levelLabel.textContent = "Level 1 — The Graveyard";
      A.playMusic("level1");
      this.updateHUD();
    },

    toTransition() {
      this.state = STATE.TRANSITION;
      this._transTo = "l2";
      this.ui.transTitle.textContent = "Wendy is Free!";
      this.ui.transText.textContent =
        "Hop on the broom — fly to the rainbow and escape!";
      this.level.wendy.caged = false;
      this.level.wendy.free = true;
      A.win();
      this.cam.addShake(0.5);
      this.particles.burst(this.level.wendy.x + 15, this.level.wendy.y, 40, {
        color: ["#ffd24d", "#b48cff", "#fff", "#8be9fd"], speedMin: 80, speedMax: 300,
        lifeMin: 0.5, lifeMax: 1.1, glow: true, g: 200,
      });
      setTimeout(() => {
        if (this.state === STATE.TRANSITION) this.show("transition");
      }, 900);
    },

    // After the rainbow finale, hand off to Level 3 (the climb).
    toLevel3Transition() {
      this.state = STATE.TRANSITION;
      this._transTo = "l3a";
      this.ui.transTitle.textContent = "Over the Rainbow…";
      this.ui.transText.textContent =
        "But a giant bird has carried off Hexie's little sister to its nest atop " +
        "the great tree. Climb up and save her!";
      A.win();
      this.cam.addShake(0.4);
      setTimeout(() => {
        if (this.state === STATE.TRANSITION) this.show("transition");
      }, 700);
    },

    continueTransition() {
      if (this._transTo === "l3a") this.startLevel3();
      else this.beginLevel2();
    },

    beginLevel2() {
      this.level = L.buildLevel2();
      this.broom = new Hex.Broom(180, VIEW_H / 2 - 15);
      this.player = null;   // we're on the broom now — no on-foot cat to render
      this.cam.setBounds(0, 0, Infinity, VIEW_H);
      this.cam.snapTo(0, 0);
      this.particles.clear();
      this.state = STATE.L2;
      this.bg = 2;
      this.finaleT = 0;
      this.hide("start"); this.hide("transition"); this.hide("win");
      this.hide("gameover"); this.hide("pause");
      this.show("hud");
      this.ui.levelLabel.textContent = "Level 2 — Sky Escape";
      A.playMusic("level2");
      this.updateHUD();
    },

    toFinale() {
      this.state = STATE.FINALE;
      this.finaleT = 0;
      A.win();
      this.cam.addShake(0.4);
    },

    // Level 3a — the vertical climb up the great tree.
    startLevel3() {
      this.level = L.buildLevel3a();
      this.player = new Hex.Hexie(this.level.spawn.x, this.level.spawn.y);
      this.broom = null;
      this.boss = null;
      this.cam.setBounds(0, 0, this.level.width, this.level.height);
      this.cam.snapTo(this.player.x - VIEW_W / 2, this.player.y - VIEW_H / 2);
      this.particles.clear();
      this.state = STATE.L3A;
      this.bg = 3; this._bgSub = "a";
      this.deathTimer = 0;
      this.hide("start"); this.hide("transition"); this.hide("win");
      this.hide("gameover"); this.hide("pause");
      this.show("hud");
      this.ui.levelLabel.textContent = "Level 3 — The Climb";
      A.playMusic("level3");
      this.updateHUD();
    },

    // Level 3b — the nest / boss arena. This is the checkpoint (save spot).
    beginBoss() {
      this.level = L.buildLevel3b();
      this.player = new Hex.Hexie(this.level.spawn.x, this.level.spawn.y);
      this.broom = null;
      this.boss = new Hex.BirdBoss(this.level);
      this._bossBeaten = false;
      this.cam.setBounds(0, 0, VIEW_W, VIEW_H);
      this.cam.snapTo(0, 0);
      this.particles.clear();
      this.state = STATE.L3B;
      this.bg = 3; this._bgSub = "b";
      this.deathTimer = 0;
      this.hide("start"); this.hide("transition"); this.hide("win");
      this.hide("gameover"); this.hide("pause");
      this.show("hud");
      this.ui.levelLabel.textContent = "Level 3 — The Nest";
      A.playMusic("level3");
      this.updateHUD();
    },

    // The boss is beaten — free the captive sister with a celebratory burst.
    freeSister(lv) {
      if (lv && lv.sister) {
        lv.sister.free = true;
        this.particles.burst(lv.sister.x + 12, lv.sister.y, 36, {
          color: ["#ffd24d", "#b48cff", "#fff", "#8be9fd"], speedMin: 70, speedMax: 280,
          lifeMin: 0.5, lifeMax: 1.1, glow: true, g: 180,
        });
      }
      this.cam.addShake(0.5);
    },

    win() {
      this.state = STATE.WIN;
      A.stopMusic();
      this.show("win");
      const hpEntity = this.player || this.broom;
      const bonus = (hpEntity ? hpEntity.hp : 0) * 500;
      this.score += bonus;
      this.ui.winTally.innerHTML =
        `<div class="row"><span>🎃 Pumpkins</span><span class="v">${this.pumpkins}</span></div>` +
        `<div class="row"><span>❤ Health bonus</span><span class="v">${bonus}</span></div>` +
        `<div class="row total"><span>★ Total score</span><span class="v">${this.score}</span></div>`;
    },

    gameOver() {
      this.state = STATE.GAMEOVER;
      A.stopMusic();
      A.lose();
      this.show("gameover");
    },

    restartCurrent() {
      this.hide("gameover");
      switch (this._lastLevel) {
        case "2":  this.beginLevel2(); break;
        case "3a": this.startLevel3(); break;   // back to the foot of the tree
        case "3b": this.beginBoss();   break;   // checkpoint — back to the nest
        default:   this.startGame();
      }
    },

    addScore(n, x, y) {
      this.score += n;
      this.updateHUD();
      if (x != null) {
        this.particles.spawn({
          x, y: y - 10, vx: 0, vy: -60, g: 0, life: 0.8, size: 6,
          color: "#ffe9a8", glow: true, shrink: false,
        });
      }
    },

    updateHUD() {
      this.ui.scoreVal.textContent = this.score;
      this.ui.pumpkinVal.textContent = this.pumpkins;
      const hp = this.state === STATE.L2 || this.state === STATE.FINALE
        ? (this.broom ? this.broom.hp : 0)
        : (this.player ? this.player.hp : 0);
      const max = 3;
      let h = "";
      for (let i = 0; i < max; i++)
        h += `<span class="heart${i < hp ? "" : " empty"}">❤</span>`;
      this.ui.hearts.innerHTML = h;

      // Boss health pips — only during the nest duel.
      if (this.state === STATE.L3B && this.boss) {
        let b = "";
        for (let i = 0; i < this.boss.maxHp; i++)
          b += `<span class="pip${i < this.boss.hp ? "" : " empty"}">🦅</span>`;
        this.ui.bossHp.innerHTML = b;
        this.ui.bossHp.classList.remove("hidden");
      } else {
        this.ui.bossHp.classList.add("hidden");
      }
    },

    /* ------------------------------- STEP ------------------------------- */
    step(dt) {
      Hex.Input.beginFrame();
      this.time += dt;
      this.ambientT += dt;

      // global keys
      if (Hex.Input.wasPressed("mute")) A.toggleMute();
      // level select — jump to either level any time (great for practice)
      if (Hex.Input.wasPressed("level1") && this.state !== STATE.L1) {
        A.resume(); A.select(); this.startGame(); return;
      }
      if (Hex.Input.wasPressed("level2") && this.state !== STATE.L2) {
        A.resume(); A.select(); this.startAtLevel2(); return;
      }
      if (Hex.Input.wasPressed("level3") &&
          this.state !== STATE.L3A && this.state !== STATE.L3B) {
        A.resume(); A.select(); this.startAtLevel3(); return;
      }
      if (Hex.Input.wasPressed("start")) {
        if (this.state === STATE.START) { A.resume(); this.startGame(); return; }
        if (this.state === STATE.TRANSITION &&
            !this.ui.transition.classList.contains("hidden")) { this.continueTransition(); return; }
        if (this.state === STATE.WIN) { A.resume(); this.startGame(); return; }
        if (this.state === STATE.GAMEOVER) { this.restartCurrent(); return; }
      }
      if (Hex.Input.wasPressed("pause") && (this.state === STATE.L1 ||
          this.state === STATE.L2 || this.state === STATE.FINALE ||
          this.state === STATE.L3A || this.state === STATE.L3B)) {
        this.paused = !this.paused;
        if (this.paused) this.show("pause"); else this.hide("pause");
      }
      if (this.paused) return;

      this.cam.update();
      this.spawnAmbient(dt);

      if (this.state === STATE.L1) this.stepL1(dt);
      else if (this.state === STATE.L2) this.stepL2(dt);
      else if (this.state === STATE.FINALE) this.stepFinale(dt);
      else if (this.state === STATE.L3A) this.stepL3a(dt);
      else if (this.state === STATE.L3B) this.stepL3b(dt);

      this.particles.update(dt);
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2);
    },

    /* ---- ambient embers/dust drifting in screen space ---- */
    spawnAmbient(dt) {
      this._emberT = (this._emberT || 0) - dt;
      if (this._emberT <= 0) {
        this._emberT = 0.12;
        const camX = this.cam.x;
        this.particles.spawn({
          x: camX + M.rand(0, VIEW_W), y: this.cam.y + VIEW_H + 10,
          vx: M.rand(-10, 20), vy: M.rand(-30, -55), g: -8,
          life: M.rand(2.5, 4.5), size: M.rand(1.2, 2.6),
          color: ["#ff8a3d", "#ffd24d", "#b48cff"][M.randInt(0, 2)],
          glow: true, shrink: false, drag: 0.2,
        });
      }
    },

    /* ============================ LEVEL 1 STEP ========================= */
    stepL1(dt) {
      const lv = this.level;
      const p = this.player;

      if (!p.dead) {
        const prevBottom = p.y + p.h;
        p.update(dt, lv.solids, this);
        p._prevBottom = prevBottom;

        // pumpkins
        for (const pk of lv.pumpkins) {
          if (!pk.collected && M.aabb(p, pk)) {
            pk.collected = true;
            this.pumpkins++;
            this.addScore(50, pk.x + pk.w / 2, pk.y);
            A.collect();
            this.particles.burst(pk.x + pk.w / 2, pk.y + pk.h / 2, 14, {
              color: ["#ff8c1a", "#ffd24d", "#fff"], speedMin: 50, speedMax: 180,
              lifeMin: 0.3, lifeMax: 0.6, glow: true, g: 200,
            });
          }
          pk.update(dt);
        }

        // enemies
        for (const e of lv.enemies) {
          e.update(dt, lv.solids, this);
          if (e.dead) continue;
          if (M.aabb(p, e)) {
            const stomping = p.vy > 0 && (p._prevBottom <= e.y + 12);
            if (stomping) { e.stomp(this); p.bounce(); }
            else if (p.hurt(e.x + e.w / 2, this)) { /* hurt handled */ }
          }
        }

        // pit / fall death
        if (p.y > lv.height + 240) { p.dead = true; p.hp = 0; }

        // reach Wendy
        if (p.x + p.w > lv.goalX) this.toTransition();

        if (p.dead) this.deathTimer = 1.1;
      } else {
        // death fall continues briefly
        p.vy += 2200 * dt;
        p.y += p.vy * dt;
        this.deathTimer -= dt;
        if (this.deathTimer <= 0) { this._lastLevel = "1"; this.gameOver(); }
      }

      lv.wendy.update(dt);
      this.cam.follow(p, 0.1, p.dir * 60, -20);
      this.updateHUD();
    },

    /* ============================ LEVEL 2 STEP ========================= */
    stepL2(dt) {
      const lv = this.level;
      const b = this.broom;

      if (b.dead) {
        b.vy += 1400 * dt; b.y += b.vy * dt; b.tilt += dt;
        this.deathTimer -= dt;
        if (this.deathTimer <= 0) { this._lastLevel = "2"; this.gameOver(); }
        this.cam.x += this.scrollSpeed * dt * 0.3;
        return;
      }

      b.update(dt, lv.bounds, this);
      this.scrollSpeed = BASE_SCROLL * b.speed;
      this.cam.x += this.scrollSpeed * dt;
      b.x = this.cam.x + 180;

      // ducks
      for (const d of lv.ducks) {
        d.update(dt, 0);
        if (M.aabb(b, shrink(d, 5))) {
          if (b.hurt(this)) {
            // knock the broom back a touch
            b.vy = (b.cy < d.y ? -1 : 1) * 200;
          }
        }
      }

      // pumpkins
      for (const pk of lv.pumpkins) {
        if (!pk.collected && M.aabb(b, pk)) {
          pk.collected = true;
          this.pumpkins++;
          this.addScore(50, pk.x + pk.w / 2, pk.y);
          A.collect();
          this.particles.burst(pk.x + pk.w / 2, pk.y + pk.h / 2, 12, {
            color: ["#ff8c1a", "#ffd24d", "#fff"], speedMin: 50, speedMax: 160,
            lifeMin: 0.3, lifeMax: 0.6, glow: true, g: 0, drag: 1.5,
          });
        }
        pk.update(dt);
      }

      if (b.dead) this.deathTimer = 1.1;

      // reached rainbow -> finale
      if (b.x + b.w > lv.rainbowX) this.toFinale();

      this.cam.y = 0;
      this.updateHUD();
    },

    /* ============================ FINALE STEP ========================= */
    stepFinale(dt) {
      const lv = this.level;
      const b = this.broom;
      this.finaleT += dt;

      // auto-fly forward into the rainbow, accelerating
      this.scrollSpeed = M.lerp(this.scrollSpeed, 520, 0.04);
      this.cam.x += this.scrollSpeed * dt;
      b.x = this.cam.x + 180;
      // gentle steering still allowed + auto-center vertically
      const In = Hex.Input;
      if (In.isDown("up")) b.vy -= 900 * dt;
      else if (In.isDown("down")) b.vy += 900 * dt;
      else b.vy = M.approach(b.vy, (VIEW_H / 2 - 15 - b.y) * 2, 600 * dt);
      b.vy = M.clamp(b.vy, -300, 300);
      b.y = M.clamp(b.y + b.vy * dt, lv.bounds.top, lv.bounds.bottom - b.h);
      b.tilt = M.lerp(b.tilt, -0.15, 0.1);
      b.bobT += dt; b.tailPhase += dt * 14;

      // continuous celebration particles + trailing rainbow sparkles
      if (Math.random() < 0.9) {
        this.particles.spawn({
          x: this.cam.x + M.rand(0, VIEW_W), y: M.rand(0, VIEW_H),
          vx: M.rand(-40, -160), vy: M.rand(-30, 30), g: 0,
          life: M.rand(0.4, 1.0), size: M.rand(2, 5),
          color: ["#ff4d6d", "#ff8a3d", "#ffd24d", "#5bd75b", "#5b8aff", "#b48cff"][M.randInt(0, 5)],
          glow: true, shape: "star", drag: 1,
        });
      }

      this.cam.y = 0;
      // brighten, then hand off to Level 3 (the climb)
      this.flash = Math.min(1, this.finaleT / 3.2);
      if (this.finaleT > 3.4) { this.flash = 0; this.toLevel3Transition(); }
    },

    /* ============================ LEVEL 3a STEP ======================== */
    // The vertical climb. Modeled on stepL1 (platforming + stomp + pit death),
    // but the goal is at the TOP (goalY) and reaching it enters the nest.
    stepL3a(dt) {
      const lv = this.level;
      const p = this.player;

      if (!p.dead) {
        const prevBottom = p.y + p.h;
        p.update(dt, lv.solids, this);
        p._prevBottom = prevBottom;

        // pumpkins
        for (const pk of lv.pumpkins) {
          if (!pk.collected && M.aabb(p, pk)) {
            pk.collected = true;
            this.pumpkins++;
            this.addScore(50, pk.x + pk.w / 2, pk.y);
            A.collect();
            this.particles.burst(pk.x + pk.w / 2, pk.y + pk.h / 2, 14, {
              color: ["#ff8c1a", "#ffd24d", "#fff"], speedMin: 50, speedMax: 180,
              lifeMin: 0.3, lifeMax: 0.6, glow: true, g: 200,
            });
          }
          pk.update(dt);
        }

        // enemies (same stomp/hurt rules as level 1)
        for (const e of lv.enemies) {
          e.update(dt, lv.solids, this);
          if (e.dead) continue;
          if (M.aabb(p, e)) {
            const stomping = p.vy > 0 && (p._prevBottom <= e.y + 12);
            if (stomping) { e.stomp(this); p.bounce(); }
            else p.hurt(e.x + e.w / 2, this);
          }
        }

        // fell off the tree
        if (p.y > lv.height + 240) { p.dead = true; p.hp = 0; }

        // climbed to the top → into the nest (the checkpoint)
        if (p.onGround && p.y < lv.goalY) { this.beginBoss(); return; }

        if (p.dead) this.deathTimer = 1.1;
      } else {
        p.vy += 2200 * dt;
        p.y += p.vy * dt;
        this.deathTimer -= dt;
        if (this.deathTimer <= 0) { this._lastLevel = "3a"; this.gameOver(); }
      }

      this.cam.follow(p, 0.1, 0, -60);   // bias the view upward toward the climb
      this.updateHUD();
    },

    /* ============================ LEVEL 3b STEP ======================== */
    // The nest boss duel against the giant bird.
    stepL3b(dt) {
      const lv = this.level;
      const p = this.player;
      const boss = this.boss;

      if (!p.dead) {
        const prevBottom = p.y + p.h;
        p.update(dt, lv.solids, this);
        p._prevBottom = prevBottom;
        boss.update(dt, lv, this);

        // pumpkins
        for (const pk of lv.pumpkins) {
          if (!pk.collected && M.aabb(p, pk)) {
            pk.collected = true;
            this.pumpkins++;
            this.addScore(50, pk.x + pk.w / 2, pk.y);
            A.collect();
            this.particles.burst(pk.x + pk.w / 2, pk.y + pk.h / 2, 12, {
              color: ["#ff8c1a", "#ffd24d", "#fff"], speedMin: 50, speedMax: 160,
              lifeMin: 0.3, lifeMax: 0.6, glow: true, g: 200,
            });
          }
          pk.update(dt);
        }

        // head-stomp (only valid while perched) vs. body/swoop contact
        const head = boss.headRect();
        if (boss.state === "perch" && M.aabb(p, head)) {
          const stomping = p.vy > 0 && (p._prevBottom <= head.y + 12);
          if (stomping) { boss.hitHead(this); p.bounce(); }
          else boss.hurtPlayer(p, this);
        } else if (M.aabb(p, boss) &&
                   boss.state !== "stunned" && boss.state !== "defeated") {
          boss.hurtPlayer(p, this);
        }

        // victory beat — boss beaten, free the sister, then win
        if (boss.state === "defeated" && !this._bossBeaten) {
          this._bossBeaten = true;
          this.freeSister(lv);
          this.deathTimer = 1.6;
        }
        if (this._bossBeaten) {
          this.deathTimer -= dt;
          if (this.deathTimer <= 0) { this.win(); return; }
        }

        // fell out of the nest
        if (p.y > VIEW_H + 240) { p.dead = true; p.hp = 0; }

        if (p.dead) this.deathTimer = 1.1;
      } else {
        p.vy += 2200 * dt;
        p.y += p.vy * dt;
        this.deathTimer -= dt;
        if (this.deathTimer <= 0) { this._lastLevel = "3b"; this.gameOver(); }
      }

      this.cam.y = 0;
      this.updateHUD();
    },

    /* ------------------------------ RENDER ----------------------------- */
    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, VIEW_W, VIEW_H);

      if (this.state === STATE.L1) this.renderL1();
      else if (this.state === STATE.L2 || this.state === STATE.FINALE) this.renderL2();
      else if (this.state === STATE.L3A) this.renderL3a();
      else if (this.state === STATE.L3B) this.renderL3b();
      else if (this.state === STATE.START) this.renderMenuBackdrop();
      else if (this.state === STATE.TRANSITION) {
        // keep the backdrop of the level we just finished behind the card
        this._transTo === "l3a" ? this.renderL2() : this.renderL1();
      }
      // Paused / game-over / win: draw the backdrop of the level we're on.
      else if (this.bg === 3) (this._bgSub === "b" ? this.renderL3b() : this.renderL3aIfPossible());
      else if (this.bg === 2) this.renderL2();
      else this.renderL1IfPossible();

      // white flash (finale / impacts)
      if (this.flash > 0) {
        ctx.save();
        ctx.globalAlpha = this.flash * 0.85;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        ctx.restore();
      }
    },

    renderL1IfPossible() {
      if (this.level && this.player) this.renderL1();
      else this.renderMenuBackdrop();
    },

    renderL3aIfPossible() {
      if (this.level && this.player) this.renderL3a();
      else this.renderMenuBackdrop();
    },

    renderMenuBackdrop() {
      const ctx = this.ctx;
      BG.drawSky(ctx, L.L1_PALETTE);
      const stars = this._menuStars || (this._menuStars = makeMenuStars());
      BG.drawStars(ctx, stars, this.time * 6, 1, this.time);
      BG.drawMoon(ctx, 760, 110);
      BG.drawHills(ctx, this.time * 8, 0.2, 470, 120, "#241433", 1);
      BG.drawTreeline(ctx, this.time * 14, 0.4, 480, "#160d22");
      BG.drawFog(ctx, this.time * 10, 0.3, 470, this.time, "rgba(60,40,90,0.5)");
      this.particles.draw(ctx);
    },

    /* ---- LEVEL 1 RENDER ---- */
    renderL1() {
      const ctx = this.ctx;
      const lv = this.level;
      const camX = this.cam.x;

      BG.drawSky(ctx, L.L1_PALETTE);
      BG.drawStars(ctx, lv.farStars, camX, 0.05, this.time);
      BG.drawStars(ctx, lv.stars, camX, 0.12, this.time);
      BG.drawMoon(ctx, lv.moonX - camX * 0.04, lv.moonY);
      BG.drawHills(ctx, camX, 0.25, 470, 130, "#2a1840", 0);
      BG.drawHills(ctx, camX, 0.4, 500, 100, "#1d1030", 2);
      BG.drawTreeline(ctx, camX, 0.55, 500, "#140b1f");
      BG.drawFog(ctx, camX, 0.7, 455, this.time, "rgba(70,45,100,0.45)");

      ctx.save();
      this.cam.apply(ctx);

      // ground
      this.drawGround(ctx, lv);
      // scenery props
      for (const pr of lv.props) this.drawProp(ctx, pr, lv.groundY);
      // platforms
      for (const s of lv.solids) if (s.oneWay) this.drawPlatform(ctx, s);
      // pumpkins
      for (const pk of lv.pumpkins) pk.draw(ctx);
      // enemies
      for (const e of lv.enemies) e.draw(ctx);
      // Wendy + cage
      lv.wendy.draw(ctx);
      this.drawChurchBackdrop(ctx, lv.goalX, lv.groundY);
      // player shadow + player
      if (this.player) {
        this.drawShadow(ctx, this.player, lv.solids);
        this.player.draw(ctx);
      }
      // particles in world space
      this.particles.draw(ctx);

      ctx.restore();

      // foreground fog (screen space, drifting faster)
      BG.drawFog(ctx, camX, 0.95, 510, this.time * 1.4, "rgba(30,18,50,0.5)");
    },

    /* ---- LEVEL 2 RENDER ---- */
    renderL2() {
      const ctx = this.ctx;
      const lv = this.level;
      const camX = this.cam.x;

      BG.drawSky(ctx, L.L2_PALETTE);
      BG.drawStars(ctx, lv.farStars, camX, 0.05, this.time);
      BG.drawStars(ctx, lv.stars, camX, 0.12, this.time);
      BG.drawMoon(ctx, lv.moonX - camX * 0.03, lv.moonY);
      BG.drawHills(ctx, camX, 0.18, 500, 90, "#23184a", 0);
      BG.drawFog(ctx, camX, 0.45, 360, this.time, "rgba(90,60,140,0.35)");
      BG.drawFog(ctx, camX, 0.6, 470, this.time * 1.2, "rgba(120,70,150,0.35)");

      ctx.save();
      this.cam.apply(ctx);

      // rainbow (drawn at world rainbowX so it scrolls in)
      this.drawRainbow(ctx, lv.rainbowX, lv.bounds);

      for (const pk of lv.pumpkins) pk.draw(ctx);
      for (const d of lv.ducks) d.draw(ctx);
      this.drawBroomShadow(ctx);
      if (this.broom) this.broom.draw(ctx);
      this.particles.draw(ctx);

      ctx.restore();

      BG.drawFog(ctx, camX, 0.9, 520, this.time * 1.6, "rgba(40,25,70,0.4)");
    },

    /* ---- LEVEL 3a RENDER (the climb) ---- */
    renderL3a() {
      const ctx = this.ctx;
      const lv = this.level;

      BG.drawSky(ctx, L.L3_PALETTE);
      BG.drawMoon(ctx, lv.moonX, lv.moonY - this.cam.y * 0.05);

      ctx.save();
      this.cam.apply(ctx);

      // world-space starfield (scrolls with the climb, twinkles)
      ctx.save();
      ctx.fillStyle = "#dfeaff";
      for (const s of lv.stars) {
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(this.time * 1.5 + s.tw));
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }
      ctx.restore();

      this.drawTree(ctx, lv);
      for (const s of lv.solids) if (s.oneWay) this.drawBranch(ctx, s);
      for (const pr of lv.props) this.drawLeaf(ctx, pr);
      for (const pk of lv.pumpkins) pk.draw(ctx);
      for (const e of lv.enemies) e.draw(ctx);
      if (this.player) {
        this.drawShadow(ctx, this.player, lv.solids);
        this.player.draw(ctx);
      }
      this.particles.draw(ctx);

      ctx.restore();

      BG.drawFog(ctx, 0, 0, 470, this.time, "rgba(20,45,40,0.3)");
    },

    /* ---- LEVEL 3b RENDER (the nest / boss) ---- */
    renderL3b() {
      const ctx = this.ctx;
      const lv = this.level;

      BG.drawSky(ctx, L.L3_PALETTE);
      BG.drawStars(ctx, lv.farStars, 0, 0, this.time);
      BG.drawStars(ctx, lv.stars, 0, 0, this.time);
      BG.drawMoon(ctx, lv.moonX, lv.moonY);
      BG.drawFog(ctx, 0, 0, 380, this.time, "rgba(30,60,50,0.3)");

      ctx.save();
      this.cam.apply(ctx);

      this.drawNest(ctx, lv);
      for (const s of lv.solids) if (s.oneWay) this.drawBranch(ctx, s);
      for (const pk of lv.pumpkins) pk.draw(ctx);
      this.drawSister(ctx, lv);
      if (this.boss) this.boss.draw(ctx);
      if (this.player) {
        this.drawShadow(ctx, this.player, lv.solids);
        this.player.draw(ctx);
      }
      this.particles.draw(ctx);

      ctx.restore();

      BG.drawFog(ctx, 0, 0, 510, this.time * 1.3, "rgba(20,40,35,0.35)");
    },

    /* --------------------------- draw helpers -------------------------- */
    drawTree(ctx, lv) {
      // roots / forest floor at the foot of the tree
      Hex.draw.vgrad(ctx, -200, lv.groundY, VIEW_W + 400, 200,
        [[0, "#2a1c12"], [0.2, "#1b1410"], [1, "#0c0a08"]]);
      ctx.fillStyle = "#3a2a1a";
      ctx.fillRect(-200, lv.groundY, VIEW_W + 400, 4);
      // the trunk
      const t = lv.trunk;
      Hex.draw.vgrad(ctx, t.x, 190, t.w, lv.groundY - 190,
        [[0, "#5a3f24"], [0.5, "#4a3320"], [1, "#2e2014"]]);
      ctx.strokeStyle = "rgba(20,12,6,0.5)";
      ctx.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        const x = t.x + (t.w * i) / 4;
        ctx.beginPath();
        ctx.moveTo(x, 190); ctx.lineTo(x, lv.groundY);
        ctx.stroke();
      }
    },

    drawBranch(ctx, s) {
      // the full-width nest landing at the top of the climb
      if (s.w >= VIEW_W - 1) {
        Hex.draw.vgrad(ctx, s.x, s.y, s.w, 16, [[0, "#6a4a28"], [1, "#3a2814"]]);
        ctx.fillStyle = "rgba(50,110,70,0.8)";
        for (let x = s.x + 10; x < s.x + s.w; x += 46)
          ctx.fillRect(x, s.y - 4, 26, 5);
        return;
      }
      ctx.save();
      ctx.fillStyle = "#4a3320";
      Hex.draw.roundRect(ctx, s.x, s.y, s.w, s.h, 6);
      ctx.fill();
      ctx.fillStyle = "#6a4a28";
      ctx.fillRect(s.x + 2, s.y, s.w - 4, 3);
      // leafy tuft on the outer end
      ctx.fillStyle = "rgba(50,110,70,0.85)";
      const ex = s.x + s.w / 2;
      for (const [dx, dy] of [[0, -6], [-12, -2], [12, -2]]) {
        ctx.beginPath();
        ctx.arc(ex + dx, s.y + dy, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },

    drawLeaf(ctx, pr) {
      ctx.save();
      ctx.translate(pr.x, pr.y);
      ctx.scale(pr.flip ? -pr.s : pr.s, pr.s);
      ctx.fillStyle = "rgba(40,90,60,0.85)";
      for (const [dx, dy] of [[0, 0], [-10, 4], [10, 4], [0, -8]]) {
        ctx.beginPath();
        ctx.arc(dx, dy, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },

    drawNest(ctx, lv) {
      Hex.draw.vgrad(ctx, 0, lv.groundY, VIEW_W, 80,
        [[0, "#5a3f24"], [0.3, "#3a2814"], [1, "#1c130a"]]);
      ctx.strokeStyle = "rgba(90,64,36,0.9)";
      ctx.lineWidth = 6; ctx.lineCap = "round";
      for (let x = -20; x < VIEW_W + 20; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, lv.groundY + 6);
        ctx.quadraticCurveTo(x + 20, lv.groundY - 8, x + 40, lv.groundY + 6);
        ctx.stroke();
      }
    },

    drawSister(ctx, lv) {
      const s = lv.sister;
      if (!s) return;
      const bob = Math.sin(this.time * 3) * 1.5;
      ctx.save();
      ctx.translate(s.x + 14, s.y + 44);
      ctx.scale(0.8, 0.8);
      Hex.drawCat(ctx, { state: "idle", runPhase: 0, animT: this.time,
        tailPhase: this.time * 2, blinking: 0, earTwitch: 0 }, bob);
      // pink bow so she reads as Hexie's sister
      ctx.fillStyle = "#ff7aa8";
      ctx.beginPath();
      ctx.arc(2, -34 + bob, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // a little twig cage until she's freed
      if (!s.free) {
        ctx.save();
        ctx.strokeStyle = "rgba(120,90,50,0.85)";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(s.x - 6, s.y - 6, 40, 50);
        for (let i = s.x + 4; i < s.x + 34; i += 8) {
          ctx.beginPath();
          ctx.moveTo(i, s.y - 6); ctx.lineTo(i, s.y + 44);
          ctx.stroke();
        }
        ctx.restore();
      }
    },

    drawGround(ctx, lv) {
      for (const s of lv.solids) {
        if (s.oneWay) continue;
        // top crust
        Hex.draw.vgrad(ctx, s.x, s.y, s.w, s.h,
          [[0, "#3a2348"], [0.12, "#2a1838"], [1, "#140a1f"]]);
        // grass-ish glow rim
        ctx.fillStyle = "#5a3a6e";
        ctx.fillRect(s.x, s.y, s.w, 4);
        ctx.fillStyle = "rgba(150,90,180,0.5)";
        ctx.fillRect(s.x, s.y, s.w, 1.5);
      }
    },

    drawPlatform(ctx, s) {
      ctx.save();
      ctx.fillStyle = "#241634";
      Hex.draw.roundRect(ctx, s.x, s.y, s.w, s.h, 6);
      ctx.fill();
      ctx.fillStyle = "#4a2f63";
      ctx.fillRect(s.x + 2, s.y, s.w - 4, 3);
      ctx.fillStyle = "rgba(150,90,180,0.6)";
      ctx.fillRect(s.x + 2, s.y, s.w - 4, 1.2);
      ctx.restore();
    },

    drawProp(ctx, pr, groundY) {
      ctx.save();
      ctx.translate(pr.x, groundY);
      ctx.scale(pr.flip ? -pr.s : pr.s, pr.s);
      if (pr.type === "grave") {
        ctx.fillStyle = "#1c1228";
        Hex.draw.roundRect(ctx, -10, -34, 20, 34, 8);
        ctx.fill();
        ctx.fillStyle = "#2a1c3a";
        ctx.fillRect(-2, -28, 4, 12);
        ctx.fillRect(-7, -24, 14, 4);
      } else {
        // dead tree
        ctx.strokeStyle = "#160d22";
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, -54);
        ctx.moveTo(0, -34); ctx.lineTo(-14, -48);
        ctx.moveTo(0, -40); ctx.lineTo(14, -52);
        ctx.moveTo(0, -22); ctx.lineTo(-12, -30);
        ctx.stroke();
      }
      ctx.restore();
    },

    // The Church of Good Manners — looming structure where Wendy is held
    drawChurchBackdrop(ctx, x, groundY) {
      ctx.save();
      ctx.translate(x + 60, groundY);
      ctx.fillStyle = "#1a1230";
      // main hall
      ctx.fillRect(-10, -150, 150, 150);
      // steeple
      ctx.beginPath();
      ctx.moveTo(20, -150); ctx.lineTo(55, -240); ctx.lineTo(90, -150);
      ctx.closePath(); ctx.fill();
      // cross of "good manners"
      ctx.fillStyle = "#3a2a55";
      ctx.fillRect(52, -262, 6, 26);
      ctx.fillRect(44, -252, 22, 6);
      // glowing windows
      ctx.fillStyle = "rgba(255,180,90,0.5)";
      ctx.shadowColor = "rgba(255,160,80,0.6)";
      ctx.shadowBlur = 14;
      for (let wx = 10; wx < 130; wx += 34) {
        ctx.beginPath();
        ctx.moveTo(wx, -60); ctx.lineTo(wx + 10, -60);
        ctx.lineTo(wx + 10, -95); ctx.arc(wx + 5, -95, 5, 0, Math.PI, true);
        ctx.lineTo(wx, -60); ctx.fill();
      }
      ctx.restore();
    },

    drawShadow(ctx, e, solids) {
      // find ground just below entity
      let gy = null;
      for (const s of solids) {
        if (e.x + e.w > s.x && e.x < s.x + s.w && s.y >= e.y + e.h - 4) {
          if (gy === null || s.y < gy) gy = s.y;
        }
      }
      if (gy === null) return;
      const dist = M.clamp(1 - (gy - (e.y + e.h)) / 240, 0.2, 1);
      ctx.save();
      ctx.globalAlpha = 0.32 * dist;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(e.x + e.w / 2, gy - 1, (e.w / 2) * dist, 5 * dist, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },

    drawBroomShadow(ctx) {
      const b = this.broom;
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(b.cx, this.level.bounds.bottom + 14, 30, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },

    drawRainbow(ctx, x, bounds) {
      const colors = ["#ff4d6d", "#ff8a3d", "#ffd24d", "#5bd75b", "#5b8aff", "#b48cff"];
      ctx.save();
      const cy = (bounds.top + bounds.bottom) / 2 + 120;
      for (let i = 0; i < colors.length; i++) {
        ctx.strokeStyle = colors[i];
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 22;
        ctx.shadowColor = colors[i];
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(x + 120, cy, 300 - i * 22, Math.PI * 1.05, Math.PI * 1.95);
        ctx.stroke();
      }
      // sparkle pot of glow at base
      ctx.shadowBlur = 30;
      ctx.fillStyle = "rgba(255,240,200,0.4)";
      ctx.beginPath();
      ctx.arc(x + 120, cy - 230, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  };

  function shrink(r, by) {
    return { x: r.x + by, y: r.y + by, w: r.w - by * 2, h: r.h - by * 2 };
  }
  function makeMenuStars() {
    const s = [];
    for (let i = 0; i < 100; i++)
      s.push({ x: Math.random() * VIEW_W, y: Math.random() * VIEW_H,
        r: M.rand(0.5, 2), tw: M.rand(0, 6) });
    return s;
  }

  Hex.Game = Game;

  // boot
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", () => Game.init());
  else Game.init();
})(window);
