# Model Capability Benchmark — "Build a Platformer"

This folder turns the Hexie design brief into a reproducible test of a model's
ability to build an interesting, polished game from a single prompt.

## Files

- **`prompt-fixed.txt`** — Reproduce the exact Hexie's Rescue spec (3 levels +
  boss). Use this for apples-to-apples comparison; you can diff each model's
  output against the reference build in this repo's `index.html` / `assets/`.
- **`prompt-open.txt`** — Same requirements and constraints, but the model
  invents its own world and theme. Use this to test creativity and taste.
- **`rubric.md`** — Weighted 0–100 scoring rubric and a verification checklist.
  Apply it to either prompt's output.
- **`results/`** — One scorecard per model run. Copy `results/TEMPLATE.md` to
  `results/<model>-<prompt>.md`, fill it in, then add a row to
  `results/SUMMARY.md` (the leaderboard).

## How to run a test

1. Give one prompt file, verbatim, to the model under test in a fresh session.
2. Save its output to a clean folder and serve it statically:
   `python3 -m http.server 8123`
3. Play through every level with the console open.
4. Score with `rubric.md`. Grade the running game, not the model's description.
5. Copy `results/TEMPLATE.md` to a new scorecard, record your scores, and add a
   row to `results/SUMMARY.md`.

## Tips for fair comparison

- Use the same prompt text, no extra hints, and a single turn (or a fixed number
  of turns) per model.
- Keep the environment identical: same browser, same "serve statically" step.
- Record the console, a completion run, and the final score per category so
  results are auditable later.
