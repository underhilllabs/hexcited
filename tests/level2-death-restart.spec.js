// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Verifies the level-2 restart rule and that the screen stays alive:
 * when Hexie & Wendy die on the broom (Level 2 — Sky Escape), the game must
 *   1. show a Game Over screen (not crash / freeze), and
 *   2. drop the player back into Level 2 — not Level 1 — on "Try Again".
 *
 * Two entry paths are covered, because they behave differently:
 *   - starting the game and stepping into Level 2, and
 *   - jumping straight to Level 2 from the title screen via the "2" key
 *     (this path never creates the on-foot cat, which is what used to make
 *      the Game Over backdrop freeze).
 */

// Waits for the game object to exist and the fixed-timestep loop to be running.
async function waitForGameReady(page) {
  await page.waitForFunction(() => {
    const g = window.Hex && window.Hex.Game;
    return !!(g && g.state && g.loop);
  });
}

// Confirms the render/update loop is still advancing (i.e. it did not freeze
// because render threw and stopped re-arming requestAnimationFrame).
async function expectLoopAlive(page) {
  const t0 = await page.evaluate(() => window.Hex.Game.time);
  await page.waitForFunction(
    (prev) => window.Hex.Game.time > prev + 0.1,
    t0,
    { timeout: 2000 }
  );
}

// Samples the top sky band of the canvas and asserts it's the Level 2 sky
// (L2_PALETTE) rather than the Level 1 / title-screen sky (L1_PALETTE).
// This is what the player actually sees behind the Game Over card — the
// original bug drew the Level 1 backdrop here.
async function expectLevel2Sky(page) {
  const avg = await page.evaluate(() => {
    const c = document.getElementById("game");
    const ctx = c.getContext("2d");
    const { data } = ctx.getImageData(0, 0, c.width, 30); // top sky band
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
    return { r: r / n, g: g / n, b: b / n };
  });
  const L1_TOP = [26, 14, 46];  // #1a0e2e
  const L2_TOP = [11, 16, 48];  // #0b1030
  const dist = (a, ref) => Math.hypot(a.r - ref[0], a.g - ref[1], a.b - ref[2]);
  expect(
    dist(avg, L2_TOP),
    `sky should be the Level 2 palette, got rgb(${avg.r.toFixed(0)},${avg.g.toFixed(0)},${avg.b.toFixed(0)})`
  ).toBeLessThan(dist(avg, L1_TOP));
}

// Drains the broom's health through the real hurt() path until it dies.
async function killBroom(page) {
  await page.evaluate(() => {
    const g = window.Hex.Game;
    while (!g.broom.dead) {
      g.broom.invuln = 0; // bypass the i-frames between hits
      g.broom.hurt(g);
    }
    g.deathTimer = 1.1; // let the death animation play out
  });
  await page.waitForFunction(() => window.Hex.Game.state === "gameover", null, {
    timeout: 5000,
  });
}

// Asserts a healthy, fresh Level 2 with a live loop and no errors thrown.
async function expectFreshLevel2(page, pageErrors) {
  await page.waitForFunction(() => window.Hex.Game.state === "l2");
  expect(await page.locator("#hud-level").innerText()).toMatch(/level 2/i);
  await expect(page.locator("#gameover")).toBeHidden();
  await expect(page.locator("#hud")).toBeVisible();

  const broom = await page.evaluate(() => ({
    exists: !!window.Hex.Game.broom,
    dead: window.Hex.Game.broom.dead,
    hp: window.Hex.Game.broom.hp,
  }));
  expect(broom).toEqual({ exists: true, dead: false, hp: 3 });

  await expectLoopAlive(page); // the screen must not be frozen
  expect(pageErrors, "no uncaught errors during the flow").toEqual([]);
}

test.describe("Level 2 — Sky Escape", () => {
  test("dying in level 2 (entered via level 1) restarts at level 2, no freeze", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    await page.goto("/index.html");
    await waitForGameReady(page);

    // Start the game, then step into the broom level via the level-select key.
    await page.locator("#start-btn").click();
    await page.waitForFunction(() => window.Hex.Game.state === "l1");
    await page.keyboard.press("Digit2");
    await page.waitForFunction(() => window.Hex.Game.state === "l2");

    // Fly forward a moment so we're genuinely "running through" the level.
    await page.keyboard.down("Space");
    await page.waitForTimeout(400);
    await page.keyboard.up("Space");
    expect(await page.evaluate(() => window.Hex.Game.cam.x)).toBeGreaterThan(0);

    await killBroom(page);
    await expect(page.locator("#gameover")).toBeVisible();
    expect(await page.evaluate(() => window.Hex.Game._lastLevel)).toBe(2);
    // Game Over screen itself must keep ticking, not freeze, and show the sky.
    await expectLoopAlive(page);
    await expectLevel2Sky(page);

    await page.locator("#gameover-btn").click();
    await expectFreshLevel2(page, pageErrors);
  });

  test("dying in level 2 (entered via '2' on the start screen) restarts at level 2, no freeze", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    await page.goto("/index.html");
    await waitForGameReady(page);

    // The user's repro: from the title screen, press "2" to jump straight to
    // Level 2 — without ever starting Level 1, so no on-foot cat is created.
    expect(await page.evaluate(() => window.Hex.Game.state)).toBe("start");
    await page.keyboard.press("Digit2");
    await page.waitForFunction(() => window.Hex.Game.state === "l2");
    // Confirm we really took the broom-only path (no player cat).
    expect(await page.evaluate(() => window.Hex.Game.player)).toBeFalsy();

    await killBroom(page);
    await expect(page.locator("#gameover")).toBeVisible();
    await expectLoopAlive(page);   // must not freeze on the Game Over screen
    await expectLevel2Sky(page);   // and must show the Level 2 sky, not Level 1

    await page.locator("#gameover-btn").click();
    await expectFreshLevel2(page, pageErrors);
  });
});
