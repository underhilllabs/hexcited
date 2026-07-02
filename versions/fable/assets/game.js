/* Hexcited — Hexie's Rescue
   game.js — state machine, fixed-timestep loop, camera, HUD, screens. */
(function () {
  'use strict';
  const HX = window.Hexcited;
  const U = HX.util, I = HX.Input, FX = HX.FX, A = HX.Audio, Art = HX.Art;
  const W = HX.W, H = HX.H, DT = HX.DT;

  const G = (HX.Game = {
    canvas: null, ctx: null, dpr: 1,
    state: 'title', stateT: 0, t: 0,
    score: 0, pumps: 0, lives: 3,
    levelIndex: 0, level: null,
    player: null,
    cam: { x: 0, y: 0 },
    solids: [], oneways: [], enemies: [], pickups: [], decos: [],
    boss: null, bossActive: false,
    goal: null,
    wendyFree: false,
    deathHandled: false,
    swoopTimer: 3.5,
    rescueFlags: {},
    shortcutUsed: false, // 1/2/3 level jumps disqualify the run from the table
    pendingRank: -1,     // highlight row on the hiscores screen (-1 = none)
    entryInitials: null,
    entryCursor: 0,
  });

  /* ================================================= boot & loop */
  function boot() {
    G.canvas = document.getElementById('game');
    G.dpr = Math.min(2, window.devicePixelRatio || 1);
    G.canvas.width = W * G.dpr;
    G.canvas.height = H * G.dpr;
    G.ctx = G.canvas.getContext('2d');
    I.init();
    A.playMusic('title'); // queued until the first keypress unlocks audio
    let last = performance.now();
    let acc = 0;
    function frame(now) {
      requestAnimationFrame(frame);
      let d = (now - last) / 1000;
      last = now;
      if (d > 0.25) d = 0.25;
      acc += d;
      let n = 0;
      while (acc >= DT && n < 5) {
        update(DT);
        acc -= DT;
        n++;
      }
      if (n === 5) acc = 0;
      render();
      I.endFrame();
    }
    requestAnimationFrame(frame);
  }

  function setState(s) {
    G.state = s;
    G.stateT = 0;
  }

  /* ================================================= level lifecycle */
  function startLevel(i) {
    G.levelIndex = i;
    G.solids = [];
    G.oneways = [];
    G.enemies = [];
    G.pickups = [];
    G.decos = [];
    G.boss = null;
    G.bossActive = false;
    G.wendyFree = false;
    G.deathHandled = false;
    G.swoopTimer = 3.5;
    FX.reset();
    const def = HX.Levels[i];
    const meta = def.build(G);
    G.level = Object.assign({}, def, meta);
    G.goal = meta.goal;
    G.player = new HX.Player(meta.spawn.x, meta.spawn.y);
    // snap camera to its target immediately
    if (def.type === 'climb') G.cam = { x: 0, y: U.clamp(G.player.y - H * 0.6, 0, meta.h - H) };
    else if (def.type === 'fly') G.cam = { x: G.player.x - 240, y: 0 };
    else G.cam = { x: U.clamp(G.player.x - W * 0.42, 0, meta.w - W), y: 0 };
    A.stopMusic();
    setState('intro');
  }

  function newRun() {
    G.score = 0;
    G.pumps = 0;
    G.lives = 3;
    G.shortcutUsed = false;
    startLevel(0);
  }

  function nextLevel() {
    if (G.levelIndex < 2) startLevel(G.levelIndex + 1);
    else {
      setState('win');
      A.stopMusic();
      A.sfx('win');
    }
  }

  function startRescue() {
    setState('rescue');
    G.rescueFlags = {};
    G.score += 1000;
    FX.addText(G.player.x, G.player.y - 70, '+1000', '#8affc1');
    const ty = G.level.type;
    if (ty === 'foot') {
      A.stopMusic();
      A.sfx('break');
      G.wendyFree = true;
      FX.shards(G.goal.x, G.goal.y - 55, 16);
      FX.shake(8, 0.35);
    } else if (ty === 'fly') {
      A.stopMusic();
      A.sfx('rescue');
    } else {
      A.stopMusic();
      G.wendyFree = true;
      A.sfx('rescue');
    }
  }

  /* ================================================= update */
  function update(dt) {
    G.t += dt;
    G.stateT += dt;
    A.tick();

    if (I.pressed('mute') && G.state !== 'initials') A.toggleMute();

    // 1/2/3 — jump straight to a level
    const jumps = [['lvl1', 0], ['lvl2', 1], ['lvl3', 2]];
    for (const [key, idx] of jumps) {
      if (I.pressed(key) &&
          ['title', 'intro', 'play', 'pause', 'rescue', 'gameover'].indexOf(G.state) >= 0) {
        A.resume();
        A.sfx('select');
        if (G.state === 'title' || G.state === 'gameover') { G.score = 0; G.pumps = 0; G.lives = 3; }
        G.shortcutUsed = true;
        startLevel(idx);
        return;
      }
    }

    switch (G.state) {
      case 'title':
        if (I.pressed('hiscores')) {
          A.sfx('select');
          G.pendingRank = -1;
          setState('hiscores');
        } else if (I.pressed('confirm')) {
          A.sfx('select');
          newRun();
        }
        break;
      case 'intro':
        if (I.pressed('confirm')) {
          A.sfx('select');
          setState('play');
          A.playMusic(G.level.music);
        }
        break;
      case 'play':
        if (I.pressed('pause')) {
          setState('pause');
          A.suspend();
          break;
        }
        updatePlay(dt);
        break;
      case 'pause':
        if (I.pressed('pause') || I.pressed('confirm')) {
          setState('play');
          A.resume();
        }
        break;
      case 'rescue':
        updateRescue(dt);
        break;
      case 'gameover':
        if (I.pressed('confirm')) {
          A.sfx('select');
          G.lives = 3;
          startLevel(G.levelIndex);
        }
        break;
      case 'win':
        if (I.pressed('confirm')) {
          A.sfx('select');
          if (!G.shortcutUsed && HX.Scores.qualifies(G.score)) {
            G.entryInitials = [null, null, null];
            G.entryCursor = 0;
            setState('initials');
          } else {
            setState('title');
            A.playMusic('title');
          }
        }
        break;
      case 'initials':
        updateInitials();
        break;
      case 'hiscores':
        if (I.pressed('confirm') || I.pressed('hiscores')) {
          A.sfx('select');
          const fromWin = G.pendingRank >= 0;
          G.pendingRank = -1;
          setState('title');
          if (fromWin) A.playMusic('title'); // title visits already have it playing
        }
        break;
    }
  }

  const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function updateInitials() {
    const slots = G.entryInitials;
    if (I.typed.length) {
      // a typed letter may also be a mapped key (A/D/W/S…) — it only types here
      for (const ch of I.typed) {
        slots[G.entryCursor] = ch;
        G.entryCursor = Math.min(2, G.entryCursor + 1);
        A.sfx('collect');
      }
    } else {
      if (I.pressed('left') && G.entryCursor > 0) { G.entryCursor--; A.sfx('collect'); }
      if (I.pressed('right') && G.entryCursor < 2) { G.entryCursor++; A.sfx('collect'); }
      const spin = (I.pressed('up') ? 1 : 0) - (I.pressed('down') ? 1 : 0);
      if (spin) {
        const cur = slots[G.entryCursor];
        const i = cur ? AZ.indexOf(cur) : (spin > 0 ? -1 : 1);
        slots[G.entryCursor] = AZ[(i + spin + 26) % 26];
        A.sfx('collect');
      }
      if (I.pressed('back')) {
        if (slots[G.entryCursor]) slots[G.entryCursor] = null;
        else if (G.entryCursor > 0) slots[--G.entryCursor] = null;
        A.sfx('collect');
      }
    }
    if (I.pressed('confirm') && slots.some((c) => c)) {
      const initials = slots.map((c) => c || '·').join('');
      G.pendingRank = HX.Scores.insert(initials, G.score, G.pumps);
      A.sfx('select');
      setState('hiscores');
    }
  }

  function updatePlay(dt) {
    if (FX.stop > 0) { FX.stop -= dt; return; } // hitstop: freeze the world
    const P = G.player, L = G.level;

    if (L.type === 'fly') P.updateFly(dt, G);
    else P.updateFoot(dt, G);
    FX.update(dt);

    /* enemies */
    for (let i = G.enemies.length - 1; i >= 0; i--) {
      const e = G.enemies[i];
      e.update(dt, G);
      if (e.gone) G.enemies.splice(i, 1);
    }

    /* ambient particles */
    if (L.type === 'climb' && Math.random() < dt * 2.2) {
      FX.spawn({
        x: G.cam.x + U.rand(0, W), y: G.cam.y + U.rand(0, H),
        vx: U.rand(-14, 14), vy: U.rand(-20, -6),
        life: U.rand(2, 3.5), size: 1.8, color: '#d8ff9a', type: 'dot', alpha: 0.8,
      });
    }

    /* level-3 swoop bird spawner */
    if (L.type === 'climb' && !G.bossActive && !P.dead && P.y > 900 && P.y < 4500) {
      G.swoopTimer -= dt;
      if (G.swoopTimer <= 0) {
        G.swoopTimer = U.rand(2.8, 4.4);
        const dir = U.chance(0.5) ? 1 : -1;
        G.enemies.push(new HX.Swooper(dir > 0 ? -50 : W + 50, P.y - 190, dir));
        A.sfx('flap');
      }
    }

    /* pumpkin pickups */
    if (!P.dead) {
      const pb = P.box;
      for (const p of G.pickups) {
        if (p.taken) continue;
        if (U.aabb(pb.l, pb.t, P.w, P.h, p.x - 12, p.y - 14, 24, 26)) {
          p.taken = true;
          G.pumps++;
          G.score += 100;
          A.sfx('collect');
          FX.sparkle(p.x, p.y, '#ffb74e');
          FX.addText(p.x, p.y - 18, '+100');
        }
      }
    }

    /* enemy contact */
    if (!P.dead) {
      const pb = P.box;
      for (const e of G.enemies) {
        if (e.dead || e.hit) continue;
        const centered = !(e instanceof HX.Walker);
        const et = centered ? e.y - e.h / 2 : e.y - e.h;
        const eb = { x: e.x - e.w / 2, y: et, w: e.w, h: e.h };
        if (!U.aabb(pb.l, pb.t, P.w, P.h, eb.x, eb.y, eb.w, eb.h)) continue;
        if (L.type === 'fly') {
          if (P.hurt(e.x, G)) e.knock();
        } else if (e.stompable && P.vy > 0 && P.prevBottom <= eb.y + e.h * 0.55) {
          e.stomp();
          // swoop-birds dive fast and never hold still — worth double
          const pts = e instanceof HX.Swooper ? 400 : 200;
          G.score += pts;
          A.sfx('stomp');
          FX.dust(e.x, eb.y + e.h, 8);
          FX.burst(e.x, et + 6, 6, { speed: 110, life: 0.5, size: 3, color: '#c8c2d8', type: 'spark' });
          FX.addText(e.x, et - 10, '+' + pts);
          FX.shake(3, 0.12);
          FX.hit(0.05);
          P.vy = (I.down('jump') || I.down('up')) ? -800 : -500;
          P.jumping = true;
          P.sy = 1.25;
        } else {
          P.hurt(e.x, G);
        }
      }
    }

    /* boss fight */
    if (L.type === 'climb') {
      if (!G.bossActive && !P.dead && P.y < 660) {
        G.bossActive = true;
        G.boss = new HX.Boss(480, L.nestTop);
        A.playMusic('boss');
      }
      const B = G.boss;
      if (B) {
        B.update(dt, G, P);
        if (!B.dead && !P.dead) {
          const pb2 = P.box;
          if (B.state === 'perch') {
            const hb = B.headBox();
            if (P.vy > 0 && P.prevBottom <= hb.y + hb.h * 0.75 &&
                U.aabb(pb2.l, pb2.t, P.w, P.h, hb.x, hb.y, hb.w, hb.h)) {
              if (B.stompHit(P)) {
                G.score += 500;
                P.vy = -640;
                P.jumping = true;
                P.sy = 1.3;
              }
            }
          } else if (B.dangerous()) {
            const bb = B.bodyBox();
            if (U.aabb(pb2.l, pb2.t, P.w, P.h, bb.x, bb.y, bb.w, bb.h)) P.hurt(B.x, G);
          }
        }
        if (B.doneFor && G.state === 'play') {
          startRescue();
          return;
        }
      }
    }

    /* goal / completion */
    if (!P.dead) {
      if (L.type === 'foot' && P.x > G.goal.x - 62 && Math.abs(P.y - G.goal.y) < 90) {
        startRescue();
        return;
      }
      if (L.type === 'fly' && P.x > G.goal.x - 30) {
        startRescue();
        return;
      }
    }

    /* pit falls (level 1) */
    if (L.type === 'foot' && !P.dead && P.y > L.h + 90) {
      P.hearts--;
      A.sfx('hurt');
      FX.shake(6, 0.3);
      if (P.hearts <= 0) {
        P.dead = true;
        P.deadT = 1.2; // already off-screen, wrap up quickly
        A.sfx('die');
      } else {
        P.respawn();
      }
    }

    /* death → lives → game over */
    if (P.dead && P.deadT > 1.5 && !G.deathHandled) {
      G.deathHandled = true;
      G.lives--;
      A.stopMusic();
      if (G.lives > 0) startLevel(G.levelIndex);
      else setState('gameover');
      return;
    }

    updateCamera(dt);
  }

  function updateCamera(dt) {
    const P = G.player, L = G.level;
    if (L.type === 'fly') {
      G.cam.x = P.x - 240;
      G.cam.y = 0;
    } else if (L.type === 'climb') {
      G.cam.x = 0;
      G.cam.y = U.damp(G.cam.y, U.clamp(P.y - H * 0.6, 0, L.h - H), 6, dt);
    } else {
      const target = U.clamp(P.x - W * 0.42 + P.face * 30, 0, L.w - W);
      G.cam.x = U.damp(G.cam.x, target, 6, dt);
      G.cam.y = 0;
    }
  }

  function updateRescue(dt) {
    const P = G.player, L = G.level, t = G.stateT, F = G.rescueFlags;
    FX.update(dt);
    P.t += dt;
    P.invuln = 0;

    if (L.type === 'foot') {
      P.vx = 0;
      if (t > 0.9 && !F.jingle) {
        F.jingle = true;
        A.sfx('rescue');
        FX.hearts(G.goal.x - 40, G.goal.y - 60, 9);
      }
      if (t > 2 && !F.hearts2) {
        F.hearts2 = true;
        FX.hearts(P.x, P.y - 40, 6);
      }
      if (t > 3.4) nextLevel();
    } else if (L.type === 'fly') {
      P.x += 230 * dt;
      P.y = U.damp(P.y, 265, 3, dt);
      P.angle = U.damp(P.angle || 0, 0, 5, dt);
      if (Math.random() < dt * 22) {
        FX.sparkle(P.x + U.rand(-50, 60), P.y + U.rand(-40, 40),
          ['#e5484d', '#f2c94c', '#6fcf97', '#56ccf2', '#9b51e0'][U.irand(0, 4)], 3);
      }
      G.cam.x = P.x - 240;
      if (t > 3) nextLevel();
    } else {
      P.vx = 0;
      P.updateFoot(dt, G); // let Hexie land on the nest naturally
      if (t > 0.8 && !F.hearts) {
        F.hearts = true;
        FX.hearts(480, L.nestTop - 50, 10);
      }
      if (t > 2 && !F.hearts2) {
        F.hearts2 = true;
        FX.hearts(P.x, P.y - 40, 6);
        A.sfx('rescue');
      }
      if (t > 3.8) nextLevel();
      updateCamera(dt);
    }
  }

  /* ================================================= render */
  function txt(ctx, str, x, y, size, color, align, weight) {
    ctx.font = (weight || 800) + ' ' + size + "px 'Trebuchet MS', Verdana, sans-serif";
    ctx.textAlign = align || 'center';
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }
  function txtGlow(ctx, str, x, y, size, color, glow) {
    ctx.save();
    ctx.shadowColor = glow || color;
    ctx.shadowBlur = 22;
    txt(ctx, str, x, y, size, color);
    ctx.restore();
  }

  function render() {
    const ctx = G.ctx;
    ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    switch (G.state) {
      case 'title': renderTitle(ctx); break;
      case 'intro': renderIntro(ctx); break;
      case 'play':
      case 'pause':
      case 'rescue':
      case 'gameover':
        renderWorld(ctx);
        if (G.state === 'pause') renderPause(ctx);
        if (G.state === 'rescue') renderRescueBanner(ctx);
        if (G.state === 'gameover') renderGameOver(ctx);
        break;
      case 'win': renderWin(ctx); break;
      case 'initials': renderInitials(ctx); break;
      case 'hiscores': renderHiscores(ctx); break;
    }
  }

  function renderWorld(ctx) {
    Art.bg(G, ctx);
    const off = FX.offset();
    ctx.save();
    ctx.translate(-Math.round(G.cam.x) + off.x, -Math.round(G.cam.y) + off.y);
    Art.decos(G, ctx);
    Art.terrain(G, ctx);
    drawGoal(ctx);
    for (const p of G.pickups) if (!p.taken) Art.pumpkin(ctx, p.x, p.y, G.t, 1);
    for (const e of G.enemies) e.draw(ctx);
    if (G.boss) G.boss.draw(ctx);
    G.player.draw(ctx, G.level.type === 'fly' ? 'fly' : 'foot');
    FX.draw(ctx);
    ctx.restore();
    Art.fore(G, ctx);
    Art.vignette(ctx);
    renderHUD(ctx);
  }

  function drawGoal(ctx) {
    const g = G.goal, L = G.level;
    if (!g) return;
    if (g.type === 'cage') {
      if (G.wendyFree) {
        Art.cage(ctx, g.x, g.y, true, G.t);
        Art.wendy(ctx, { x: g.x - 58, y: g.y, face: -1, pose: 'cheer', t: G.t });
      } else {
        Art.wendy(ctx, { x: g.x, y: g.y - 12, face: -1, pose: 'cage', t: G.t });
        Art.cage(ctx, g.x, g.y, false, G.t);
      }
    } else if (g.type === 'rainbow') {
      if (g.x - 340 < G.cam.x + W + 200) Art.rainbow(ctx, g.x, g.y, G.t);
    } else if (g.type === 'nest') {
      const pose = G.wendyFree ? 'cheer' : G.bossActive ? 'sad' : 'wave';
      Art.wendy(ctx, { x: 480, y: L.nestTop + 8, face: G.player.x < 480 ? -1 : 1, pose, t: G.t });
    }
  }

  function renderHUD(ctx) {
    const P = G.player;
    // hearts
    for (let i = 0; i < 3; i++) Art.heart(ctx, 28 + i * 26, 26, 2.6, i < P.hearts);
    // lives
    for (let i = 0; i < G.lives; i++) Art.catIcon(ctx, 26 + i * 24, 54, 1.25);
    // pumpkin counter
    Art.pumpkin(ctx, W - 118, 26, 0, 0.85);
    txt(ctx, '× ' + G.pumps, W - 100, 32, 18, '#ffd9a0', 'left');
    txt(ctx, 'SCORE ' + G.score, W - 24, 58, 15, 'rgba(235,225,255,0.9)', 'right');
    // level tag
    txt(ctx, G.level.sub + ' — ' + G.level.name, W / 2, 26, 14, 'rgba(235,225,255,0.55)');
    if (A.muted) txt(ctx, 'MUTED (M)', W / 2, 46, 12, 'rgba(255,180,120,0.8)');
    // boss health
    if (G.boss && !G.boss.dead) {
      txt(ctx, 'GIANT BIRD', W / 2, H - 38, 13, 'rgba(255,210,160,0.9)');
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i < G.boss.hp ? '#ff8a3d' : 'rgba(255,138,61,0.2)';
        ctx.fillRect(W / 2 - 48 + i * 34, H - 30, 28, 9);
      }
    }
    // flight progress
    if (G.level.type === 'fly' && G.state !== 'rescue') {
      const k = U.clamp(G.player.x / G.level.dist, 0, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      U.rr(ctx, W / 2 - 130, 38, 260, 8, 4);
      ctx.fill();
      ctx.fillStyle = '#ffd66e';
      U.rr(ctx, W / 2 - 130, 38, Math.max(8, 260 * k), 8, 4);
      ctx.fill();
      Art.pumpkin(ctx, W / 2 - 130 + 260 * k, 42, 0, 0.5);
    }
  }

  /* ---------------- screens ---------------- */
  function fakeCamBG(ctx) {
    // graveyard backdrop for title (no level loaded)
    const saveLevel = G.level, saveCam = G.cam;
    G.level = { type: 'foot' };
    G.cam = { x: G.t * 12, y: 0 };
    Art.bgGrave(G, ctx);
    G.level = saveLevel;
    G.cam = saveCam;
  }

  function renderTitle(ctx) {
    fakeCamBG(ctx);
    // ground strip
    const g = ctx.createLinearGradient(0, 470, 0, 540);
    g.addColorStop(0, '#241633');
    g.addColorStop(1, '#130b1e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 470, W, 70);
    ctx.fillStyle = '#3c5c40';
    ctx.fillRect(0, 470, W, 6);

    // stars behind the title
    txtGlow(ctx, 'HEXCITED', W / 2, 150, 84, '#c9a9ff', '#8a5cf5');
    txt(ctx, '⭑  H E X I E ’ S   R E S C U E  ⭑', W / 2, 192, 22, '#ffd66e');

    // the cast
    ctx.save();
    ctx.translate(W / 2 - 170, 470);
    ctx.scale(2.4, 2.4);
    Art.hexie(ctx, { x: 0, y: 0, face: 1, pose: 'idle', t: G.t, sy: 1, blink: (G.t % 3.1) < 0.12 });
    ctx.restore();
    ctx.save();
    ctx.translate(W / 2 + 190, 470);
    ctx.scale(1.9, 1.9);
    Art.wendy(ctx, { x: 0, y: 0, face: -1, pose: 'wave', t: G.t });
    ctx.restore();
    Art.pumpkin(ctx, W / 2 + 60, 448, G.t, 1.3);
    Art.pumpkin(ctx, W / 2 - 40, 456, G.t + 2, 1);

    txt(ctx, 'The Church of Good Manners has captured Wendy the Witch.', W / 2, 250, 17, 'rgba(240,232,255,0.92)');
    txt(ctx, 'Her loyal cat Hexie must get her back!', W / 2, 274, 17, 'rgba(240,232,255,0.92)');

    txt(ctx, '← → / A D  move      SPACE  jump (hold for higher)', W / 2, 322, 15, 'rgba(200,190,230,0.85)');
    txt(ctx, 'P  pause      M  mute      H  high scores      1 / 2 / 3  jump to level', W / 2, 346, 15, 'rgba(200,190,230,0.85)');
    txt(ctx, 'Stomp enemies from above. Collect the mini pumpkins!', W / 2, 370, 15, 'rgba(200,190,230,0.85)');

    if (Math.floor(G.t * 1.6) % 2 === 0)
      txtGlow(ctx, 'PRESS ENTER', W / 2, 420, 26, '#8affc1', '#2fbf71');
    Art.vignette(ctx);
  }

  function renderIntro(ctx) {
    Art.bg(G, ctx);
    ctx.fillStyle = 'rgba(8,4,16,0.62)';
    ctx.fillRect(0, 0, W, H);
    const L = G.level;
    txt(ctx, L.sub.toUpperCase(), W / 2, 168, 20, '#ffd66e');
    txtGlow(ctx, L.name, W / 2, 222, 52, '#c9a9ff', '#8a5cf5');
    const lines = L.story.split('\n');
    lines.forEach((s, i) => txt(ctx, s, W / 2, 280 + i * 28, 17, 'rgba(240,232,255,0.92)'));
    // lives display
    for (let i = 0; i < G.lives; i++) Art.catIcon(ctx, W / 2 - (G.lives - 1) * 16 + i * 32, 392, 1.6);
    if (Math.floor(G.stateT * 1.6) % 2 === 0)
      txtGlow(ctx, 'PRESS ENTER', W / 2, 448, 24, '#8affc1', '#2fbf71');
    Art.vignette(ctx);
  }

  function renderPause(ctx) {
    ctx.fillStyle = 'rgba(8,4,16,0.6)';
    ctx.fillRect(0, 0, W, H);
    txtGlow(ctx, 'PAUSED', W / 2, H / 2 - 10, 46, '#c9a9ff', '#8a5cf5');
    txt(ctx, 'P or ENTER to resume  ·  M to mute', W / 2, H / 2 + 30, 16, 'rgba(230,220,250,0.85)');
  }

  function renderRescueBanner(ctx) {
    const msgs = { foot: 'WENDY IS FREE!', fly: 'OVER THE RAINBOW!', climb: 'THE BEAST IS BEATEN!' };
    const k = Math.min(1, G.stateT * 3);
    const pop = 1 + Math.sin(Math.min(Math.PI, G.stateT * 6)) * 0.15;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(W / 2, 120);
    ctx.scale(pop, pop);
    txtGlow(ctx, msgs[G.level.type], 0, 0, 40, '#ffd66e', '#ff9a3d');
    ctx.restore();
  }

  function renderGameOver(ctx) {
    ctx.fillStyle = 'rgba(26,4,10,0.72)';
    ctx.fillRect(0, 0, W, H);
    txtGlow(ctx, 'GAME OVER', W / 2, H / 2 - 40, 56, '#ff5f6d', '#a11a2e');
    txt(ctx, 'The Church of Good Manners prevails… for now.', W / 2, H / 2 + 6, 17, 'rgba(240,225,235,0.9)');
    txt(ctx, 'SCORE ' + G.score + '   ·   ' + G.pumps + ' pumpkins', W / 2, H / 2 + 36, 16, '#ffd9a0');
    if (Math.floor(G.stateT * 1.6) % 2 === 0)
      txtGlow(ctx, 'PRESS ENTER TO TRY AGAIN', W / 2, H / 2 + 86, 21, '#8affc1', '#2fbf71');
  }

  function renderWin(ctx) {
    fakeCamBG(ctx);
    ctx.fillStyle = 'rgba(8,4,16,0.35)';
    ctx.fillRect(0, 0, W, H);
    Art.rainbow(ctx, W / 2, 560, G.t);
    txtGlow(ctx, 'WENDY IS FREE!', W / 2, 140, 58, '#ffd66e', '#ff9a3d');
    txt(ctx, 'Hexie stomped the giant bird and saved the day.', W / 2, 186, 18, 'rgba(240,232,255,0.95)');

    ctx.save();
    ctx.translate(W / 2 - 70, 400);
    ctx.scale(2, 2);
    Art.hexie(ctx, { x: 0, y: 0, face: 1, pose: 'idle', t: G.t, sy: 1, blink: (G.t % 3.1) < 0.12 });
    ctx.restore();
    ctx.save();
    ctx.translate(W / 2 + 70, 400);
    ctx.scale(1.8, 1.8);
    Art.wendy(ctx, { x: 0, y: 0, face: -1, pose: 'cheer', t: G.t });
    ctx.restore();
    // floating hearts between them
    for (let i = 0; i < 3; i++) {
      const hy = 320 - ((G.t * 30 + i * 40) % 90);
      ctx.globalAlpha = 1 - ((G.t * 30 + i * 40) % 90) / 90;
      Art.heart(ctx, W / 2 + Math.sin(G.t * 2 + i * 2) * 18, hy, 2.4, true);
      ctx.globalAlpha = 1;
    }

    txt(ctx, 'FINAL SCORE  ' + G.score, W / 2, 452, 26, '#8affc1');
    txt(ctx, G.pumps + ' mini pumpkins collected', W / 2, 482, 16, 'rgba(240,232,255,0.85)');
    const highScore = !G.shortcutUsed && HX.Scores.qualifies(G.score);
    if (highScore) {
      const pop = 1 + Math.sin(G.t * 5) * 0.06;
      ctx.save();
      ctx.translate(W / 2 - 210, 444);
      ctx.rotate(-0.12);
      ctx.scale(pop, pop);
      txtGlow(ctx, 'NEW HIGH SCORE!', 0, 0, 22, '#ffd66e', '#ff9a3d');
      ctx.restore();
    }
    if (Math.floor(G.t * 1.6) % 2 === 0)
      txt(ctx, highScore ? 'PRESS ENTER TO ENTER YOUR INITIALS' : 'PRESS ENTER FOR TITLE',
        W / 2, 516, 17, '#ffd66e');
    Art.vignette(ctx);
  }

  function renderInitials(ctx) {
    fakeCamBG(ctx);
    ctx.fillStyle = 'rgba(8,4,16,0.7)';
    ctx.fillRect(0, 0, W, H);
    txtGlow(ctx, 'NEW HIGH SCORE!', W / 2, 130, 48, '#ffd66e', '#ff9a3d');
    txt(ctx, 'SCORE ' + G.score + '   ·   ' + G.pumps + ' pumpkins', W / 2, 172, 18, 'rgba(240,232,255,0.92)');
    txt(ctx, 'ENTER YOUR INITIALS', W / 2, 232, 20, '#c9a9ff');

    const slotW = 76, gap = 26, x0 = W / 2 - (slotW * 3 + gap * 2) / 2;
    for (let i = 0; i < 3; i++) {
      const x = x0 + i * (slotW + gap);
      const active = i === G.entryCursor;
      ctx.save();
      if (active) { ctx.shadowColor = '#8a5cf5'; ctx.shadowBlur = 24; }
      ctx.fillStyle = active ? 'rgba(80,55,140,0.55)' : 'rgba(40,28,70,0.55)';
      U.rr(ctx, x, 268, slotW, 92, 10);
      ctx.fill();
      ctx.strokeStyle = active ? '#c9a9ff' : 'rgba(150,130,200,0.5)';
      ctx.lineWidth = active ? 3 : 2;
      U.rr(ctx, x, 268, slotW, 92, 10);
      ctx.stroke();
      ctx.restore();
      const ch = G.entryInitials[i];
      if (ch) txtGlow(ctx, ch, x + slotW / 2, 336, 54, '#fff2d8', '#ffd66e');
      if (active && Math.floor(G.t * 2.4) % 2 === 0)
        txt(ctx, '_', x + slotW / 2, 348, 44, '#8affc1');
    }

    txt(ctx, 'TYPE A–Z      ← → move      ↑ ↓ spin letter      BACKSPACE erase', W / 2, 420, 15, 'rgba(200,190,230,0.85)');
    if (Math.floor(G.t * 1.6) % 2 === 0)
      txtGlow(ctx, 'PRESS ENTER TO SAVE', W / 2, 470, 22, '#8affc1', '#2fbf71');
    Art.vignette(ctx);
  }

  function renderHiscores(ctx) {
    fakeCamBG(ctx);
    ctx.fillStyle = 'rgba(8,4,16,0.7)';
    ctx.fillRect(0, 0, W, H);
    txtGlow(ctx, 'HIGH SCORES', W / 2, 92, 44, '#c9a9ff', '#8a5cf5');
    Art.pumpkin(ctx, W / 2 - 190, 82, G.t, 1.1);
    Art.pumpkin(ctx, W / 2 + 190, 82, G.t + 2, 1.1);

    const list = HX.Scores.list;
    if (!list.length) {
      txt(ctx, 'NO SCORES YET — GO RESCUE WENDY!', W / 2, H / 2, 22, 'rgba(240,232,255,0.9)');
    } else {
      const rowH = 34, y0 = 148;
      for (let i = 0; i < list.length; i++) {
        const e = list[i], y = y0 + i * rowH;
        const mine = i === G.pendingRank;
        if (mine) {
          ctx.save();
          ctx.shadowColor = '#ffd66e';
          ctx.shadowBlur = 18;
          ctx.fillStyle = 'rgba(255,214,110,0.14)';
          U.rr(ctx, W / 2 - 240, y - 22, 480, 30, 8);
          ctx.fill();
          ctx.restore();
        }
        const c = mine ? '#ffd66e' : i === 0 ? '#ffe9b0' : 'rgba(235,225,255,0.9)';
        txt(ctx, (i + 1) + '.', W / 2 - 210, y, 19, c, 'right');
        txt(ctx, e.initials, W / 2 - 130, y, 19, c);
        txt(ctx, String(e.score), W / 2 + 120, y, 19, c, 'right');
        Art.pumpkin(ctx, W / 2 + 158, y - 6, 0, 0.55);
        txt(ctx, '× ' + e.pumps, W / 2 + 172, y, 14, 'rgba(255,217,160,0.8)', 'left');
      }
    }

    if (Math.floor(G.t * 1.6) % 2 === 0)
      txt(ctx, 'PRESS ENTER FOR TITLE', W / 2, 516, 17, '#ffd66e');
    Art.vignette(ctx);
  }

  boot();
})();
