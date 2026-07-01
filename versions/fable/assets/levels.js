/* Hexcited — Hexie's Rescue
   levels.js — the three level layouts. build(G) fills G.solids / G.oneways /
   G.enemies / G.pickups / G.decos and returns level metadata. */
(function () {
  'use strict';
  const HX = window.Hexcited;
  const U = HX.util;

  function solid(G, x, y, w, h, kind) {
    const s = { x, y, w, h, kind: kind || 'ground' };
    G.solids.push(s);
    return s;
  }
  function oneway(G, x, y, w, kind, dir) {
    const s = { x, y, w, h: 14, kind: kind || 'slab', dir: dir || 1 };
    G.oneways.push(s);
    return s;
  }
  function pump(G, x, y) { G.pickups.push({ x, y, taken: false }); }
  function pumpRow(G, x0, n, dx, y) { for (let i = 0; i < n; i++) pump(G, x0 + i * dx, y); }
  function deco(G, kind, x, y, extra) { G.decos.push(Object.assign({ kind, x, y }, extra || {})); }

  /* ============================================ LEVEL 1: Graveyard Run */
  function buildGraveyard(G) {
    const GY = 460; // ground top
    const segs = [
      [0, 950], [1090, 710], [1930, 870], [2940, 760],
      [3840, 860], [4840, 700], [5680, 920],
    ];
    for (const [x, w] of segs) solid(G, x, GY, w, 200, 'ground');
    // level bounds
    solid(G, -80, -600, 80, 1600, 'wall');
    solid(G, 6600, -600, 80, 1600, 'wall');

    // crypt step-blocks (solid)
    solid(G, 1690, 408, 95, 52, 'crypt');
    solid(G, 3540, 398, 110, 62, 'crypt');
    solid(G, 4590, 412, 85, 48, 'crypt');

    // floating stone slabs (one-way)
    const slabs = [
      [300, 362, 110], [520, 296, 110],
      [1240, 352, 130], [1470, 290, 120],
      [2100, 360, 120], [2325, 300, 130], [2560, 352, 110],
      [3080, 340, 140],
      [4040, 352, 130], [4280, 290, 120],
      [5000, 360, 140], [5255, 300, 130],
      [5820, 358, 120], [6070, 300, 120],
    ];
    for (const [x, y, w] of slabs) oneway(G, x, y, w, 'slab');

    // churchfolk patrols (x, patrol min, patrol max)
    const walkers = [
      [600, 480, 830], [1300, 1150, 1460], [1620, 1480, 1670],
      [2180, 2000, 2380], [2560, 2450, 2780], [3200, 3000, 3420],
      [4080, 3900, 4300], [4460, 4350, 4560], [5050, 4900, 5250],
      [5420, 5320, 5520], [5900, 5750, 6120],
    ];
    for (const [x, a, b] of walkers) G.enemies.push(new HX.Walker(x, GY, a, b));
    // two elevated patrols
    G.enemies.push(new HX.Walker(2380, 300, 2340, 2440));
    G.enemies.push(new HX.Walker(5060, 360, 5015, 5125));

    // pumpkins
    pumpRow(G, 240, 4, 42, 430);
    for (const [x, y, w] of slabs) pumpRow(G, x + 18, Math.floor(w / 48), 44, y - 24);
    pump(G, 965, 402); pump(G, 1010, 386); pump(G, 1055, 402);          // gap 1 arc
    pump(G, 1815, 398); pump(G, 1863, 380); pump(G, 1911, 398);         // gap 2
    pumpRow(G, 1980, 5, 46, 430);
    pump(G, 2815, 398); pump(G, 2863, 380); pump(G, 2911, 398);         // gap 3
    pumpRow(G, 2980, 4, 46, 430);
    pump(G, 3715, 398); pump(G, 3763, 380); pump(G, 3811, 398);         // gap 4
    pumpRow(G, 3900, 5, 46, 430);
    pump(G, 4715, 398); pump(G, 4763, 380); pump(G, 4811, 398);         // gap 5
    pumpRow(G, 4900, 4, 46, 430);
    pump(G, 5555, 398); pump(G, 5603, 380); pump(G, 5651, 398);         // gap 6
    pumpRow(G, 5700, 4, 46, 430);
    pump(G, 1735, 384); pump(G, 3590, 372);                             // on crypts

    // decorations
    deco(G, 'sign', 170, GY, { text: 'WENDY AHEAD' });
    const r = U.seeded(42);
    for (const [x, w] of segs) {
      let dx = x + 60 + r() * 100;
      while (dx < x + w - 60) {
        const roll = r();
        if (roll < 0.34) deco(G, 'tomb', dx, GY, { tilt: (r() - 0.5) * 0.24 });
        else if (roll < 0.48) deco(G, 'cross', dx, GY, { tilt: (r() - 0.5) * 0.2 });
        else if (roll < 0.62) deco(G, 'bush', dx, GY);
        else if (roll < 0.72) deco(G, 'tree', dx, GY);
        else if (roll < 0.82) deco(G, 'fence', dx, GY);
        dx += 130 + r() * 160;
      }
    }
    for (const lx of [430, 1560, 2650, 3960, 5150, 6250]) deco(G, 'lantern', lx, GY);

    return {
      w: 6600, h: 540,
      spawn: { x: 90, y: GY },
      goal: { type: 'cage', x: 6420, y: GY },
    };
  }

  /* ============================================ LEVEL 2: Broom Flight */
  function buildFlight(G) {
    const D = 8200; // distance to the rainbow
    const r = U.seeded(7);
    let x = 1050;
    while (x < D - 500) {
      const fy = 120 + r() * 300;
      if (r() < 0.6) {
        // V formation of 5
        G.enemies.push(new HX.Duck(x, fy));
        for (let i = 1; i <= 2; i++) {
          G.enemies.push(new HX.Duck(x + i * 42, fy - i * 30));
          G.enemies.push(new HX.Duck(x + i * 42, fy + i * 30));
        }
      } else {
        // column with a gap to thread
        G.enemies.push(new HX.Duck(x, Math.max(90, fy - 105)));
        G.enemies.push(new HX.Duck(x + 20, fy));
        G.enemies.push(new HX.Duck(x, Math.min(470, fy + 105)));
      }
      // pumpkin trail between waves
      const px = x + 190;
      const py = 130 + r() * 280;
      for (let i = 0; i < 7; i++)
        pump(G, px + i * 52, U.clamp(py + Math.sin(i * 0.85 + r() * 6) * 95, 90, 470));
      x += 460 + r() * 220;
    }
    // celebration arc right before the rainbow
    for (let i = 0; i < 9; i++)
      pump(G, D - 300 + i * 44, 300 - Math.sin((i / 8) * Math.PI) * 160);

    return {
      w: D + 1400, h: 540,
      dist: D,
      spawn: { x: 200, y: 270 },
      goal: { type: 'rainbow', x: D + 520, y: 470 },
    };
  }

  /* ============================================ LEVEL 3: The Climb & The Nest */
  function buildClimb(G) {
    const LH = 4800;
    solid(G, 0, 4600, 960, 220, 'ground');
    solid(G, -80, -600, 80, LH + 1200, 'wall');
    solid(G, 960, -600, 80, LH + 1200, 'wall');

    // the great trunk (decorative — branches carry the collision)
    deco(G, 'trunk', 0, -60, { x: 388, y: -60, w: 184, h: LH - 130 });

    const r = U.seeded(99);
    let y = 4490;
    let side = 1;
    let count = 0;
    while (y > 640) {
      const w = 155 + r() * 80;
      let s;
      if (side > 0) s = oneway(G, 468, y, w, 'branch', 1);
      else s = oneway(G, 492 - w, y, w, 'branch', -1);
      // pumpkins on some branches
      if (r() < 0.45) pump(G, s.x + s.w * (0.35 + r() * 0.4), y - 24);
      // occasional far ledge near the wall with a bonus cluster
      if (count % 5 === 3) {
        const lw = 110 + r() * 40;
        const lx = side > 0 ? 30 : 930 - 30 - lw;
        const ledge = oneway(G, lx, y - 40, lw, 'branch', side > 0 ? -1 : 1);
        ledge.dir = side > 0 ? 1 : -1; // free-floating look
        pumpRow(G, lx + 16, 3, (lw - 32) / 2, y - 66);
        deco(G, 'leaves', lx + lw / 2, y - 90);
      }
      if (count % 4 === 2) deco(G, 'leaves', 480 + (r() - 0.5) * 240, y - 30);
      y -= 96 + r() * 18;
      side = -side;
      count++;
    }
    // approach branches to the nest
    oneway(G, 468, 560, 190, 'branch', 1);
    oneway(G, 300, 565, 192, 'branch', -1);
    pump(G, 560, 536);
    pump(G, 390, 541);

    // the nest (solid top — the boss arena floor)
    solid(G, 330, 430, 300, 42, 'nest');

    // ambience at the bottom
    for (const bx of [120, 300, 660, 840]) deco(G, 'bush', bx, 4600);
    deco(G, 'sign', 200, 4600, { text: 'UP! UP! UP!' });

    return {
      w: 960, h: LH,
      spawn: { x: 140, y: 4600 },
      goal: { type: 'nest', x: 480, y: 430 },
      nestTop: 430,
    };
  }

  HX.Levels = [
    {
      name: 'Graveyard Run',
      sub: 'Level 1',
      story: 'The Church of Good Manners has locked Wendy away.\nRun the moonlit graveyard, stomp the churchfolk,\nand reach her cage!',
      type: 'foot',
      music: 'grave',
      build: buildGraveyard,
    },
    {
      name: 'Broom Flight',
      sub: 'Level 2',
      story: 'Escape by broom at dawn! Steer with ↑ / ↓,\nspeed up and slow down with → / ←.\nDodge the duck squadrons — fly for the rainbow!',
      type: 'fly',
      music: 'flight',
      build: buildFlight,
    },
    {
      name: 'The Climb & The Nest',
      sub: 'Level 3',
      story: 'Disaster! A giant bird snatched Wendy at the rainbow!\nClimb the great tree, dodge the swoop-birds…\nthen stomp the beast’s head THREE times.',
      type: 'climb',
      music: 'climb',
      build: buildClimb,
    },
  ];
})();
