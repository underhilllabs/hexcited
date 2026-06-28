/* =========================================================================
   Hexcited — levels.js
   Level 1 (side-scroller) layout, level 2 (broom flight) config, and the
   layered parallax atmospheric backgrounds. Attaches to Hex.Levels.
   ========================================================================= */
(function (global) {
  "use strict";
  const Hex = (global.Hex = global.Hex || {});
  const M = Hex.M;

  const VIEW_W = 960, VIEW_H = 540;
  const GROUND_Y = 460;

  /* ------------------------------------------------------------------ */
  /* Static star field + scenery generated once and reused (parallax)   */
  /* ------------------------------------------------------------------ */
  function makeStars(n, w, h) {
    const s = [];
    for (let i = 0; i < n; i++)
      s.push({ x: Math.random() * w, y: Math.random() * h,
        r: M.rand(0.5, 1.8), tw: M.rand(0, 6) });
    return s;
  }

  /* ============================== LEVEL 1 ============================== */
  function buildLevel1() {
    const solids = [];
    // continuous-ish ground with a few gaps
    const groundSegs = [
      [0, 1200], [1320, 1900], [2050, 2600], [2750, 3800], [3950, 4600],
    ];
    for (const [x0, x1] of groundSegs)
      solids.push({ x: x0, y: GROUND_Y, w: x1 - x0, h: 200 });

    // floating platforms (silhouette stone slabs)
    const plats = [
      [360, 360, 120], [560, 290, 90], [820, 360, 110],
      [1380, 380, 110], [1560, 300, 120], [1740, 360, 100],
      [2120, 370, 120], [2330, 300, 100], [2560, 360, 90],
      [2900, 380, 120], [3120, 310, 110], [3340, 360, 120], [3560, 300, 100],
      [4000, 370, 130], [4220, 300, 120],
    ];
    for (const [x, y, w] of plats)
      solids.push({ x, y, w, h: 22, oneWay: true });

    // pumpkins
    const pumpkins = [];
    const pumpPos = [
      [400, 320], [600, 250], [860, 320], [1080, 410],
      [1420, 340], [1600, 260], [1780, 320], [1980, 410],
      [2170, 330], [2380, 260], [2600, 320], [2820, 410],
      [2960, 340], [3170, 270], [3390, 320], [3610, 260],
      [3820, 410], [4050, 330], [4270, 260], [4450, 410],
    ];
    for (const [x, y] of pumpPos) pumpkins.push(new Hex.Pumpkin(x, y));

    // enemies (churchfolk patrols on the ground + a couple platforms)
    const enemies = [];
    const enemyPos = [
      [700, GROUND_Y, 110], [1080, GROUND_Y, 90], [1640, GROUND_Y, 120],
      [2250, GROUND_Y, 110], [2480, GROUND_Y, 100], [2950, GROUND_Y, 130],
      [3300, GROUND_Y, 120], [3560, 300, 60], [4100, GROUND_Y, 120],
      [4350, GROUND_Y, 100],
    ];
    for (const [x, y, r] of enemyPos) enemies.push(new Hex.Churchfolk(x, y, r));

    // decorative scenery (gravestones / dead trees) — purely visual
    const props = [];
    for (let x = 120; x < 4600; x += M.rand(180, 320)) {
      props.push({ x, type: Math.random() < 0.35 ? "tree" : "grave",
        s: M.rand(0.8, 1.3), flip: Math.random() < 0.5 });
    }

    const wendy = new Hex.Wendy(4720, GROUND_Y - 40);

    return {
      width: 4900,
      height: VIEW_H,
      groundY: GROUND_Y,
      solids, pumpkins, enemies, props, wendy,
      spawn: { x: 80, y: GROUND_Y - 40 },
      goalX: 4700,
      stars: makeStars(120, VIEW_W, VIEW_H),
      farStars: makeStars(60, VIEW_W, VIEW_H),
      moonX: 760, moonY: 110,
    };
  }

  /* ============================== LEVEL 2 ============================== */
  function buildLevel2() {
    const bounds = { top: 60, bottom: 500 };
    // Pre-generate duck formations + pumpkins along a long flight path.
    const ducks = [];
    const pumpkins = [];

    // total flight length (world units) before the rainbow
    const flightLen = 7200;

    // V-formations and lines of ducks
    let x = 1100;
    while (x < flightLen - 600) {
      const pattern = M.randInt(0, 2);
      const cy = M.rand(140, 420);
      if (pattern === 0) {
        // V formation
        for (let i = 0; i < 5; i++) {
          const off = i;
          ducks.push(new Hex.Duck(x + off * 34, cy - off * 22,
            { amp: 10, freq: 1.6, phase: i }));
          if (i > 0)
            ducks.push(new Hex.Duck(x + off * 34, cy + off * 22,
              { amp: 10, freq: 1.6, phase: i + 3 }));
        }
      } else if (pattern === 1) {
        // vertical wall with a gap
        const gap = M.randInt(1, 3);
        for (let i = 0; i < 5; i++) {
          if (i === gap || i === gap + 1) continue;
          ducks.push(new Hex.Duck(x, bounds.top + 30 + i * 90,
            { amp: 8, freq: 2.2, phase: i }));
        }
      } else {
        // sine wave train
        for (let i = 0; i < 6; i++)
          ducks.push(new Hex.Duck(x + i * 70, cy, { amp: 40, freq: 2, phase: i * 0.7 }));
      }
      x += M.rand(480, 760);
    }

    // FINALE GAUNTLET — dense escape run just before the rainbow
    const gauntletStart = flightLen - 1500;
    for (let gx = gauntletStart; gx < flightLen - 300; gx += 200) {
      const gap = M.randInt(1, 3);
      for (let i = 0; i < 5; i++) {
        if (i === gap) continue;
        ducks.push(new Hex.Duck(gx, bounds.top + 20 + i * 92,
          { amp: 14, freq: 3, phase: i + gx }));
      }
    }

    // pumpkin trails (reward weaving)
    for (let px = 700; px < flightLen - 400; px += M.rand(220, 380)) {
      const cy = M.rand(120, 440);
      const count = M.randInt(3, 6);
      for (let i = 0; i < count; i++)
        pumpkins.push(new Hex.Pumpkin(px + i * 34, cy + Math.sin(i * 0.8) * 40));
    }

    return {
      flightLen,
      rainbowX: flightLen,
      finaleX: flightLen + 1400,    // gauntlet runs a bit past the rainbow
      bounds,
      ducks, pumpkins,
      stars: makeStars(140, VIEW_W, VIEW_H),
      farStars: makeStars(70, VIEW_W, VIEW_H),
      moonX: 820, moonY: 90,
    };
  }

  /* ========================= LEVEL 3a — THE CLIMB ===================== */
  // A VERTICAL climb up a giant tree. Same level-object shape as level 1
  // (solids / oneWay branches), just very tall with the goal at the TOP
  // (goalY) instead of the right (goalX).
  //
  // IMPORTANT — reachability: Hexie's max jump is ~91px (measured), so every
  // branch must sit no more than ~80px above the one below it, and the trunk
  // is DECORATIVE (not a solid) so the cat can zig-zag freely between branches.
  const BRANCH_GAP_MIN = 68, BRANCH_GAP_MAX = 80;   // < 91px jump, with margin
  const NEST_GAP = 78;

  function buildLevel3a() {
    const height = 1800;
    const groundY = height - 80;          // 1720 — foot of the tree
    const trunkX = VIEW_W / 2 - 35;       // trunk metadata (decorative only)
    const trunkW = 70;

    const solids = [];
    // foot of the tree — solid ground slab
    solids.push({ x: -200, y: groundY, w: VIEW_W + 400, h: 200 });

    // branches — a gentle zig-zag up a central lane. Small left/right offset
    // keeps a big horizontal overlap so each branch is an easy hop from the
    // last. All oneWay so the cat jumps up THROUGH one and lands on top.
    const branches = [];
    let side = -1;
    let y = groundY - 80;                 // first branch within a single jump
    while (y > 360) {
      const w = 170;
      const cx = VIEW_W / 2 + side * 45;  // ±45 offset → ~80px overlap
      const b = { x: cx - w / 2, y, w, h: 18, oneWay: true };
      solids.push(b);
      branches.push(b);
      side = -side;
      y -= M.rand(BRANCH_GAP_MIN, BRANCH_GAP_MAX);
    }

    // nest landing at the very top — standing here ends the climb. Placed a
    // single jump above the highest branch (full width, oneWay).
    const topY = branches[branches.length - 1].y;
    const nestY = topY - NEST_GAP;
    solids.push({ x: 0, y: nestY, w: VIEW_W, h: 18, oneWay: true });

    // pumpkins on alternating branches
    const pumpkins = [];
    branches.forEach((b, idx) => {
      if (idx % 2 === 0)
        pumpkins.push(new Hex.Pumpkin(b.x + b.w / 2 - 11, b.y - 30));
    });

    // swoop birds — nest off to the side every few branches and dive across
    // the climbing lane to harry Hexie. Alternate which edge they roost on so
    // attacks come from both directions as the cat ascends.
    const enemies = [];
    branches.forEach((b, idx) => {
      if (idx >= 2 && idx % 3 === 2) {
        const left = idx % 6 === 2;
        const ex = left ? 120 : VIEW_W - 146;
        enemies.push(new Hex.SwoopBird(ex, b.y - 70, { face: left ? 1 : -1 }));
      }
    });

    // decorative foliage clumps (non-collidable) along the trunk
    const props = [];
    for (let py = groundY - 120; py > nestY + 40; py -= M.rand(150, 230)) {
      props.push({ x: VIEW_W / 2 + (Math.random() < 0.5 ? -95 : 95),
        y: py, type: "leaf", s: M.rand(0.8, 1.4), flip: Math.random() < 0.5 });
    }

    return {
      width: VIEW_W,
      height,
      groundY,
      trunk: { x: trunkX, w: trunkW },
      solids, pumpkins, enemies, props,
      wendy: null,
      spawn: { x: 200, y: groundY - 40 },
      // reaching the nest landing (p.y ≈ nestY-30) trips the goal; the highest
      // branch (p.y ≈ topY-30) sits safely below it.
      goalY: nestY + 20,
      stars: makeStars(120, VIEW_W, height),
      farStars: makeStars(70, VIEW_W, height),
      moonX: 760, moonY: 150,
    };
  }

  /* ========================= LEVEL 3b — THE NEST ====================== */
  // A single-screen boss arena (the nest). Fixed camera. The giant bird boss
  // is created separately in main.js; this just lays out the floor, ledges,
  // the captive sister, and the bird's hover/perch altitudes.
  function buildLevel3b() {
    const groundY = 470;
    const solids = [
      { x: 0, y: groundY, w: VIEW_W, h: 80 },        // nest floor
      { x: -40, y: -200, w: 40, h: VIEW_H + 200 },   // left containment wall
      { x: VIEW_W, y: -200, w: 40, h: VIEW_H + 200 },// right containment wall
      // twig ledges for height — kept within a single jump of the floor
      // (~96px max) so Hexie can actually reach them, then the boss head.
      { x: 150, y: 392, w: 150, h: 16, oneWay: true },
      { x: 660, y: 392, w: 150, h: 16, oneWay: true },
    ];

    const pumpkins = [
      new Hex.Pumpkin(210, 352),
      new Hex.Pumpkin(720, 352),
      new Hex.Pumpkin(VIEW_W / 2 - 11, 296),
    ];

    return {
      width: VIEW_W,
      height: VIEW_H,
      groundY,
      solids, pumpkins,
      enemies: [],
      props: [],
      spawn: { x: VIEW_W / 2 - 17, y: groundY - 40 },
      sister: { x: 80, y: groundY - 56 },
      hoverY: 90,                 // boss hover altitude (head group sits here)
      perchY: groundY - 96,       // boss perch altitude (head reachable)
      stars: makeStars(100, VIEW_W, VIEW_H),
      farStars: makeStars(50, VIEW_W, VIEW_H),
      moonX: 480, moonY: 90,
    };
  }

  /* ===================== PARALLAX BACKGROUND DRAW ====================== */
  // Drawn in SCREEN space (not affected by camera translate) using camX to
  // offset each layer by a different factor.
  const BG = {
    drawSky(ctx, palette) {
      Hex.draw.vgrad(ctx, 0, 0, VIEW_W, VIEW_H, palette);
    },

    drawMoon(ctx, x, y, glow) {
      ctx.save();
      ctx.shadowColor = "rgba(220,210,255,0.7)";
      ctx.shadowBlur = 50;
      ctx.fillStyle = "#f3ecd9";
      ctx.beginPath();
      ctx.arc(x, y, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // craters
      ctx.fillStyle = "rgba(180,170,150,0.35)";
      ctx.beginPath(); ctx.arc(x - 12, y - 8, 8, 0, Math.PI * 2);
      ctx.arc(x + 14, y + 6, 6, 0, Math.PI * 2);
      ctx.arc(x + 2, y + 18, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    },

    drawStars(ctx, stars, camX, factor, t) {
      ctx.save();
      for (const s of stars) {
        let sx = (s.x - camX * factor) % VIEW_W;
        if (sx < 0) sx += VIEW_W;
        const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + s.tw));
        ctx.globalAlpha = a;
        ctx.fillStyle = "#fff";
        ctx.fillRect(sx, s.y, s.r, s.r);
      }
      ctx.restore();
    },

    // Rolling silhouette hills (one repeating layer)
    drawHills(ctx, camX, factor, baseY, height, color, seed) {
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, VIEW_H);
      const step = 60;
      const off = (camX * factor) % step;
      for (let sx = -step; sx <= VIEW_W + step; sx += step) {
        const wx = sx + off;
        const wIdx = Math.floor((sx + camX * factor) / step);
        const h = baseY - (0.5 + 0.5 * Math.sin(wIdx * 0.7 + seed)) * height
                        - (0.5 + 0.5 * Math.sin(wIdx * 0.23 + seed)) * height * 0.4;
        ctx.lineTo(wx, h);
      }
      ctx.lineTo(VIEW_W, VIEW_H);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },

    // Silhouette dead trees along a mid layer
    drawTreeline(ctx, camX, factor, baseY, color) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      const spacing = 220;
      const off = -(camX * factor) % spacing;
      for (let i = -1; i <= VIEW_W / spacing + 1; i++) {
        const x = i * spacing + off;
        const idx = Math.floor((camX * factor) / spacing) + i;
        const h = 70 + (idx % 3) * 22;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x, baseY);
        ctx.lineTo(x, baseY - h);
        ctx.stroke();
        // bare branches
        ctx.lineWidth = 3;
        for (const [dx, dy, len] of [[-1, -1, 18], [1, -1, 22], [-1, -0.6, 14], [1, -0.5, 16]]) {
          ctx.beginPath();
          ctx.moveTo(x, baseY - h * 0.7);
          ctx.lineTo(x + dx * len, baseY - h * 0.7 + dy * len);
          ctx.stroke();
        }
      }
      ctx.restore();
    },

    // Drifting fog band
    drawFog(ctx, camX, factor, y, t, color) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = color;
      const blobW = 260;
      const off = -((camX * factor + t * 12) % blobW);
      for (let x = -blobW; x < VIEW_W + blobW; x += blobW) {
        ctx.beginPath();
        ctx.ellipse(x + off + blobW / 2, y + Math.sin((x + t * 30) * 0.01) * 8,
          blobW * 0.8, 36, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
  };

  Hex.Levels = { buildLevel1, buildLevel2, buildLevel3a, buildLevel3b,
    BG, GROUND_Y, VIEW_W, VIEW_H,
    L1_PALETTE: [
      [0, "#1a0e2e"], [0.45, "#3a1a52"], [0.78, "#7a3a6a"], [1, "#c25a4a"],
    ],
    L2_PALETTE: [
      [0, "#0b1030"], [0.4, "#1e2a6a"], [0.72, "#5a3a8a"], [1, "#c25a8a"],
    ],
    L3_PALETTE: [
      [0, "#06121a"], [0.4, "#0d2233"], [0.72, "#234a44"], [1, "#3a6e52"],
    ],
  };
})(window);
