// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Level 3 — "The Climb" (3a) + "The Nest" boss duel (3b).
 *
 * Covers: reaching the climb via level-select, climbing into the nest
 * (checkpoint), defeating the bird with 3 head-stomps → WIN, the 5-second
 * head-shake stun being a true safe window, and the checkpoint behavior —
 * dying in 3b restarts at 3b (the nest), dying in 3a restarts at 3a (the
 * foot of the tree). Mirrors the patterns in level2-death-restart.spec.js.
 */

async function waitForGameReady(page) {
  await page.waitForFunction(() => {
    const g = window.Hex && window.Hex.Game;
    return !!(g && g.state && g.loop);
  });
}

// Confirms the render/update loop is still advancing (didn't freeze).
async function expectLoopAlive(page) {
  const t0 = await page.evaluate(() => window.Hex.Game.time);
  await page.waitForFunction((prev) => window.Hex.Game.time > prev + 0.1, t0, {
    timeout: 2000,
  });
}

// The Level 3 sky is L3_PALETTE — its top band (#06121a) is distinct from L1/L2.
async function expectLevel3Sky(page) {
  const avg = await page.evaluate(() => {
    const c = document.getElementById("game");
    const ctx = c.getContext("2d");
    const { data } = ctx.getImageData(0, 0, c.width, 30);
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
    return { r: r / n, g: g / n, b: b / n };
  });
  const L1 = [26, 14, 46], L2 = [11, 16, 48], L3 = [6, 18, 26];
  const dist = (a, ref) => Math.hypot(a.r - ref[0], a.g - ref[1], a.b - ref[2]);
  const msg = `sky should be Level 3, got rgb(${avg.r.toFixed(0)},${avg.g.toFixed(0)},${avg.b.toFixed(0)})`;
  expect(dist(avg, L3), msg).toBeLessThan(dist(avg, L1));
  expect(dist(avg, L3), msg).toBeLessThan(dist(avg, L2));
}

// From the title screen, press "3" to jump into the climb (level select).
async function enterClimb(page) {
  await page.keyboard.press("Digit3");
  await page.waitForFunction(() => window.Hex.Game.state === "l3a");
}

// Enter the nest boss arena (the checkpoint).
async function enterNest(page) {
  await page.evaluate(() => window.Hex.Game.beginBoss());
  await page.waitForFunction(() => window.Hex.Game.state === "l3b");
}

// Land one valid head-stomp by driving the real boss damage path.
async function stompBossHead(page) {
  return page.evaluate(() => {
    const g = window.Hex.Game, b = g.boss, p = g.player;
    b.state = "perch"; b.stateT = 0;          // force the vulnerable window
    const h = b.headRect();
    p.x = h.x + h.w / 2 - p.w / 2;            // line the cat up over the head
    p.y = h.y - p.h - 2;
    p.vy = 200; p._prevBottom = h.y - 1;       // descending onto the head
    return b.hitHead(g);                       // the real decrement + state change
  });
}

// Installs a tiny in-page autopilot that drives REAL input through the game
// loop: each frame it steers Hexie toward the next branch up and jumps when
// grounded. This climbs 3a using the actual jump/collision physics, so it
// fails (times out) if any branch is out of jump reach.
async function installClimbAutopilot(page) {
  await page.evaluate(() => {
    const g = window.Hex.Game;
    if (!g.__autoPatched) {
      g.__autoPatched = true;
      const orig = g.step.bind(g);
      g.step = (dt) => { if (window.__ap) window.__pilot(); return orig(dt); };
      window.__pilot = () => {
        const G = window.Hex.Game, In = window.Hex.Input;
        if (G.state !== "l3a" || !G.player) {
          In.down.left = In.down.right = In.down.jump = false;
          return;
        }
        const p = G.player, feet = p.y + p.h;
        let t = null;   // lowest oneWay platform above the cat's feet
        for (const s of G.level.solids) {
          if (!s.oneWay) continue;
          if (s.y < feet - 4 && (!t || s.y > t.y)) t = s;
        }
        const tcx = t ? t.x + t.w / 2 : p.x + p.w / 2;
        const dx = tcx - (p.x + p.w / 2);
        In.down.left = dx < -8;
        In.down.right = dx > 8;
        In.down.jump = true;                       // hold for full jump height
        if (p.onGround) In._queuedPressed.jump = true;
      };
    }
    window.__ap = true;
  });
}

test.describe("Level 3 — Climb + Nest boss", () => {
  test("reach the climb via level-select", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    await page.goto("/index.html");
    await waitForGameReady(page);
    await enterClimb(page);

    expect(await page.locator("#hud-level").innerText()).toMatch(/the climb/i);
    expect(await page.evaluate(() => !!window.Hex.Game.player)).toBe(true);
    await expectLoopAlive(page);
    expect(pageErrors).toEqual([]);
  });

  test("climbing to the top enters the nest (checkpoint)", async ({ page }) => {
    await page.goto("/index.html");
    await waitForGameReady(page);
    await enterClimb(page);

    // Drop the cat onto the top "nest landing" and let the real goal trigger.
    await page.evaluate(() => {
      const g = window.Hex.Game;
      g.player.x = 120; g.player.y = 150; g.player.vx = 0; g.player.vy = 0;
    });
    await page.waitForFunction(() => window.Hex.Game.state === "l3b");

    expect(await page.locator("#hud-level").innerText()).toMatch(/the nest/i);
    expect(await page.evaluate(() => window.Hex.Game.boss.hp)).toBe(3);
    await expectLoopAlive(page);
    await expectLevel3Sky(page);   // the nest arena shows the open Level 3 sky
  });

  test("three head-stomps defeat the boss → WIN", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    await page.goto("/index.html");
    await waitForGameReady(page);
    await enterClimb(page);
    await enterNest(page);

    // Hit 1 and 2 should stun (boss still alive).
    expect(await stompBossHead(page)).toBe(true);
    expect(await page.evaluate(() => window.Hex.Game.boss.state)).toBe("stunned");
    expect(await page.evaluate(() => window.Hex.Game.boss.hp)).toBe(2);

    expect(await stompBossHead(page)).toBe(true);
    expect(await page.evaluate(() => window.Hex.Game.boss.hp)).toBe(1);
    expect(await page.evaluate(() => window.Hex.Game.boss.state)).toBe("stunned");

    // Hit 3 defeats it.
    expect(await stompBossHead(page)).toBe(true);
    expect(await page.evaluate(() => window.Hex.Game.boss.hp)).toBe(0);
    expect(await page.evaluate(() => window.Hex.Game.boss.state)).toBe("defeated");

    // The victory beat frees the sister and reaches the win screen.
    await page.waitForFunction(() => window.Hex.Game.state === "win", null, { timeout: 6000 });
    await expect(page.locator("#win")).toBeVisible();
    expect(await page.evaluate(() => window.Hex.Game.level.sister.free)).toBe(true);
    expect(pageErrors).toEqual([]);
  });

  test("the head-shake stun is a true safe window (no chain hits)", async ({ page }) => {
    await page.goto("/index.html");
    await waitForGameReady(page);
    await enterClimb(page);
    await enterNest(page);

    expect(await stompBossHead(page)).toBe(true);
    expect(await page.evaluate(() => window.Hex.Game.boss.state)).toBe("stunned");

    // While stunned the boss cannot be hit again — hitHead must be rejected.
    const second = await page.evaluate(() => window.Hex.Game.boss.hitHead(window.Hex.Game));
    expect(second).toBe(false);
    expect(await page.evaluate(() => window.Hex.Game.boss.hp)).toBe(2);

    // After ~5s the stun ends and the boss returns to hovering.
    await page.evaluate(() => {
      const b = window.Hex.Game.boss;
      b.stateT = 4.99;
      b.update(0.05, window.Hex.Game.level, window.Hex.Game);
    });
    expect(await page.evaluate(() => window.Hex.Game.boss.state)).toBe("hover");
  });

  test("dying in the nest (3b) restarts at the nest, not the foot of the tree", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    await page.goto("/index.html");
    await waitForGameReady(page);
    await enterClimb(page);
    await enterNest(page);

    await page.evaluate(() => {
      const g = window.Hex.Game;
      while (!g.player.dead) { g.player.invuln = 0; g.player.hp = 1; g.player.hurt(0, g); }
      g.deathTimer = 1.1;
    });
    await page.waitForFunction(() => window.Hex.Game.state === "gameover", null, { timeout: 5000 });
    expect(await page.evaluate(() => window.Hex.Game._lastLevel)).toBe("3b");

    await page.locator("#gameover-btn").click();
    await page.waitForFunction(() => window.Hex.Game.state === "l3b");
    expect(await page.locator("#hud-level").innerText()).toMatch(/the nest/i);
    expect(await page.evaluate(() => window.Hex.Game.boss && window.Hex.Game.boss.hp)).toBe(3);
    await expectLoopAlive(page);
    expect(pageErrors).toEqual([]);
  });

  test("dying in the climb (3a) restarts at the foot of the tree", async ({ page }) => {
    await page.goto("/index.html");
    await waitForGameReady(page);
    await enterClimb(page);

    // Fall off the tree.
    await page.evaluate(() => {
      const g = window.Hex.Game;
      g.player.y = g.level.height + 300;
    });
    await page.waitForFunction(() => window.Hex.Game.state === "gameover", null, { timeout: 5000 });
    expect(await page.evaluate(() => window.Hex.Game._lastLevel)).toBe("3a");

    await page.locator("#gameover-btn").click();
    await page.waitForFunction(() => window.Hex.Game.state === "l3a");
    expect(await page.locator("#hud-level").innerText()).toMatch(/the climb/i);
    await expectLoopAlive(page);
  });

  // The headline request: actually PLAY THROUGH the whole of Level 3 —
  // climb the tree branch-by-branch with real physics, then beat the boss.
  test("full run-through: climb the tree, then defeat the boss → WIN", async ({ page }) => {
    test.setTimeout(60000);   // a real climb takes ~10s of game time
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    await page.goto("/index.html");
    await waitForGameReady(page);
    await enterClimb(page);

    // Climb 3a for real. If a branch were out of jump reach, the cat would get
    // stuck on it and this would time out — exactly the bug being guarded.
    const footY = await page.evaluate(() => window.Hex.Game.player.y);
    await installClimbAutopilot(page);
    await page.waitForFunction(() => window.Hex.Game.state === "l3b", null, { timeout: 40000 });
    await page.evaluate(() => { window.__ap = false; });

    // Sanity: we genuinely ascended (the foot is near the bottom of a tall level).
    expect(footY).toBeGreaterThan(1000);
    expect(await page.evaluate(() => window.Hex.Game.boss.hp)).toBe(3);

    // Now finish the boss: three real head-stomps.
    for (let i = 0; i < 3; i++) {
      expect(await stompBossHead(page)).toBe(true);
    }
    expect(await page.evaluate(() => window.Hex.Game.boss.state)).toBe("defeated");

    await page.waitForFunction(() => window.Hex.Game.state === "win", null, { timeout: 6000 });
    await expect(page.locator("#win")).toBeVisible();
    expect(await page.evaluate(() => window.Hex.Game.level.sister.free)).toBe(true);
    expect(pageErrors).toEqual([]);
  });
});
