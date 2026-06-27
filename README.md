# Hexcited — Hexie's Rescue

A polished 2D side-scrolling platformer built as a single, self-contained static
web page — no build step, no framework, no bundler. Everything is vanilla HTML5
Canvas and JavaScript, with all music and sound effects synthesized live in the
browser via the Web Audio API.

> The **Church of Good Manners** has captured **Wendy the Witch**. Only her loyal
> black cat, **Hexie**, can save her. Run, leap, and stomp through the moonlit
> graveyard — then take to the skies on Wendy's broom and soar over the rainbow
> to freedom.

## Level 1: the Graveyard

<img width="2509" height="1236" alt="image" src="https://github.com/user-attachments/assets/caf26779-7c54-4d81-90eb-e42a30098630" />



## Level 2 screenshot

<img width="2509" height="1236" alt="image" src="https://github.com/user-attachments/assets/f1d7613d-ed73-4c33-be8f-812d6afca7c2" />


## Gameplay

The game has two distinct levels:

- **Level 1 — Graveyard Run.** A classic Mario-style side-scroller. Run and jump
  through a moonlit graveyard, stomp enemies from above, collect mini pumpkins,
  and rescue Wendy.
- **Level 2 — Broom Flight.** A one-way auto-flight stage. Steer Wendy's broom up
  and down, speed up or slow down to dodge ducks flying in formation, grab more
  pumpkins, and race toward a giant rainbow at the end.

## Controls

| Action | Keys |
| --- | --- |
| Move (on foot) | `←` `→` / `A` `D` |
| Jump (hold to jump higher) | `Space` |
| Steer (on broom) | `↑` `↓` / `W` `S` |
| Speed up / slow down (broom) | `Space` / `Shift` |
| Mute | `M` |
| Pause | `P` |
| Jump to a level | `1` / `2` |
| Start / continue | `Enter` |

Stomp enemies from above to defeat them; touching them from the side hurts you.

## Features

- Smooth 60fps movement with a fixed-timestep loop, gravity, and acceleration
- Reliable AABB collision — no clipping through floors or walls
- A camera that smoothly scrolls to follow the player
- Layered parallax atmospheric backgrounds and a cohesive art style
- Rich character animation (idle / run / jump)
- Particle effects, screen shake, and juicy game feel on every jump, stomp, and hit
- Fully synthesized music and SFX (jump, collect, stomp, hurt, win) — no audio assets
- Start, level-transition, win, game-over, and pause screens

## Running

Because the game uses the Web Audio API and loads several scripts, serve it over
HTTP rather than opening `index.html` from the filesystem:

```bash
python3 -m http.server 8123
```

Then open <http://127.0.0.1:8123/index.html> and press `Enter` to begin.

## Project structure

```
index.html              # Markup, screens/overlays, and script includes
assets/
  style.css             # Layout, overlays, CRT scanline/vignette styling
  audio.js              # Web Audio API music and sound-effect synthesis
  engine.js             # Math utils, input, camera, collision, particles, game loop
  entities.js           # Player, enemies, pumpkins, and other game objects
  levels.js             # Level 1/2 layouts and parallax backgrounds
  main.js               # Game state, screen flow, and wiring it all together
prompt.txt              # The original design brief for the game
tests/                  # Playwright browser tests
playwright.config.js    # Test runner config (serves the game, runs in Chromium)
```

All code attaches to a single global `Hex` namespace.

## Tests

End-to-end tests run in a real browser via [Playwright](https://playwright.dev/),
which spins up the local server automatically:

```bash
npm install      # first time only, to fetch Playwright
npm test
```
