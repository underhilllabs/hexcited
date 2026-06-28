# Scoring Rubric — Game-Building Capability Test

Use this rubric to grade any model's output for either `prompt-fixed.txt`
(reproduce the Hexie spec) or `prompt-open.txt` (open creative brief). Score each
category 0–10, multiply by its weight, and sum to a final score out of 100.

Grade the **running game**, not the prose the model wrote about it. Serve the
output statically and play it before scoring.

| # | Category | Weight | What a 10 looks like |
|---|----------|:---:|----------------------|
| 1 | **Playability & correctness** | 30 | Loads with zero console errors. Controls are responsive. Collision is solid — the player never clips through floors/walls, never falls through a platform, never gets stuck. Every level is completable start to finish. No softlocks. |
| 2 | **Completeness vs. spec** | 20 | Every listed baseline requirement is present *and functional* — not stubbed, not "present but broken." Win/lose/restart states all work. |
| 3 | **Game feel / "juice"** | 20 | Jump feels satisfying (coyote time, variable height, squash/stretch). Particles, screen shake, and synthesized audio fire on the right events. Animation reads as alive, not static. |
| 4 | **Code quality & structure** | 15 | Readable, organized, no dead code. Honors the stack constraints (no forbidden libs/CDNs/asset files). A fixed-timestep or otherwise frame-rate-independent loop. |
| 5 | **Ambition beyond baseline** | 15 | The model went past the floor with taste — cohesive art direction, a memorable mechanic, polish on transitions/screens. Surprising in a good way, not bloated. |

**Final score = Σ (category score × weight / 10).**

## Verification checklist (run before scoring)

Tick each; a failure caps category 1 well below 10.

- [ ] Serves over `http://` and loads with an empty browser console.
- [ ] No external network requests (no CDN scripts, no fetched images/audio/fonts).
- [ ] Player can complete every level and reach the win state.
- [ ] Death/game-over leads to a working restart (no reload required, no broken state).
- [ ] No clipping: drive the player into floors, walls, and ceilings deliberately.
- [ ] Resizing the window or running ~30s doesn't degrade or desync the loop.
- [ ] Audio is synthesized live (mute toggle works; no `.mp3`/`.wav`/`.ogg` files).

## Anti-gaming notes

- A feature **claimed** in the model's summary but **absent or broken** in the
  running game scores as absent. Trust the build, not the description.
- Placeholder/stub assets (`TODO: add sprite`, blank rectangles labeled as art,
  empty audio functions) do not count toward completeness.
- If the model cut scope, it should say so explicitly. Undisclosed missing
  requirements are penalized harder than disclosed ones.
