# Hexcited — Future Plan

Ideas for where the game goes after v1 (three levels + boss + high-score table).
Rough priority order: the loop is small and pays off immediately; the new level is
the bigger, more exciting project.

## 1. Arcade loop (NG+) — small effort, big payoff

After beating the boss, the run continues into **Round 2** instead of ending.
Score carries across rounds, so the high-score table starts measuring *how deep
you get*, not just *did you collect everything* — which also makes the score
ceiling skill-gated instead of farmable.

**Implementation sketch** (~30 lines, all knobs are already plain numbers):

- Add a `G.loop` counter (starts at 1). On beating the boss, instead of `win`,
  show a "ROUND 2!" banner and `startLevel(0)` with the counter bumped.
  Decide a final round (e.g. loop 3) that still ends at the true win screen —
  or let it run forever, pure arcade.
- Thread a difficulty multiplier `k = 1 + (loop - 1) * 0.15` into:
  - Walker patrol speed (`entities.js` Walker).
  - Duck wave density — shrink the wave spacing in `buildFlight`
    (`x += 460 + r() * 220` → divide by `k`).
  - Swooper spawn timer (`game.js`, currently `U.rand(2.8, 4.4)` → divide by `k`).
  - Boss: +1 hp per loop and/or scale swoop speed (Boss already has rage scaling
    to build on).
- Rewards/juice: +1 life on completing a loop, palette shift per loop
  (tint the bg draws), round number in the HUD and on the high-score table
  (store `loop` in the score entry).
- Seeded layouts stay identical across loops — fair and learnable, like real
  arcade games.

## 2. Remix rules per loop — middle path

If pure speed scaling feels cheap, give each loop one *rule twist* instead
(or in addition):

- **L1 at night**: darker bg, lanterns become the only light pools
  (draw a darkness overlay with radial holes at lantern positions).
- **L2 wind gusts**: periodic vertical push forces during flight.
- **L3 double swoopers**: spawn two at once from opposite sides.

More flavor than a multiplier, way less work than new levels.

## 3. New level: "The Long Way Home" — apartment switchback (Bart's idea)

A fourth board where Hexie runs through an apartment building (or a row of
houses): run **all the way right**, jump/climb **up a floor**, run **all the way
back left**, repeat — a zig-zag ascent with the camera following both axes.

Two flavors (could even be the same level in two halves):

- **Interior**: apartment floors as long corridors. Right end has a stairwell /
  stacked furniture to hop up; left end a fire-escape window. Décor: doors,
  wallpaper, lamps, potted plants, sleeping tenants(!). Enemies: churchfolk
  patrolling the hallways, maybe a new "landlord" walker that's faster.
- **Rooftops**: run right along the street level past a row of houses, then jump
  across the rooftops heading back left — gaps between roofs, chimneys as
  obstacles, TV antennas, clotheslines. Great parallax opportunity (city skyline
  + moon).

**Engine fit** (all pieces exist, one small camera addition needed):

- Geometry is trivial with the current builders: each floor is a long
  `solid(...)` strip, ceilings/floors stack every ~130px (comfortably under the
  129px jump apex — or use `oneway` gaps at the turn-around ends so you jump up
  through the floor, exactly like the tree branches).
- Level would be wider than one screen AND tall — e.g. `w: 2400, h: 2000` —
  which needs a **new camera mode**: `updateCamera` currently does x-follow
  (`foot`), y-follow (`climb`), or lock (`fly`). Add a `type: 'switchback'`
  (or a `freeCam: true` flag on the level meta) that damps both axes:
  `cam.x → clamp(P.x - W*0.5)`, `cam.y → clamp(P.y - H*0.6)`. ~6 lines.
- Backgrounds: a new `Art.bgApartment` (interior wallpaper bands per floor) or
  reuse/extend `bgGrave`'s skyline for the rooftop variant.
- Music: one new 32-step song in `audio.js` SONGS — jaunty "sneaking through
  the building" feel.
- Where it slots in the story: between L1 and L2? ("Hexie cuts through town to
  reach the broom") — or after L3 as the loop-2 opener so the new content lands
  where returning players are.

**Design notes for the switchback feel:**

- The turn-arounds are the signature moment — make them readable: a glowing
  window, an arrow sign (deco 'sign' already exists), pumpkins arcing up
  through the gap.
- Alternate the direction of enemy patrols per floor so the player is always
  running "against traffic" on odd floors.
- Pumpkin trails along each corridor reward full traversal; a bonus cluster on
  a balcony reachable only by skipping a floor gap keeps experts engaged.
- Rooftop variant: gaps between roofs must respect the ~129px apex / ~40px
  horizontal-gap rules established by the L3 reachability audit (see
  scratchpad `climb.js` BFS approach — reuse it to verify this level too).

## 4. Small follow-ups / open questions

- **Swooper farming**: score is technically unbounded by parking on a branch
  and stomping swoopers (+400 each, infinite spawner). Left as-is for now;
  if the table needs protecting, cap awarded swooper stomps per run (~10) or
  stop spawns after N. The arcade loop (item 1) mostly solves this socially —
  depth beats farming.
- Store the round/loop number and maybe date in high-score entries when the
  loop ships (`scores.js` schema is versioned via the `.v1` key — bump to
  `.v2` with a migration if the shape changes).
