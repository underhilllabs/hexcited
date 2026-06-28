# Scorecard — <MODEL NAME>

- **Model:** <provider / model id / version>
- **Date tested:** YYYY-MM-DD
- **Prompt used:** `prompt-fixed.txt` | `prompt-open.txt`
- **Turns / hints given:** <e.g. single turn, no hints>
- **Output location:** <path or link to the saved build>
- **How served:** `python3 -m http.server 8123` → http://127.0.0.1:8123/index.html
- **Browser:** <e.g. Chromium 126>

## Verification checklist

Tick what passed; a failure here caps Playability well below 10.

- [ ] Loads over http:// with an empty browser console
- [ ] No external network requests; no external asset files
- [ ] Every level is completable end to end; win state reachable
- [ ] Driving into floors/walls/ceilings never clips the player
- [ ] Death leads to a working restart (no page reload, no broken state)
- [ ] Resizing / ~30s runtime doesn't degrade or desync the loop
- [ ] Audio is synthesized live (mute works; no audio files)

## Scores

Score each 0–10. Weighted = score × weight ÷ 10.

| # | Category | Weight | Score (0–10) | Weighted | Notes |
|---|----------|:---:|:---:|:---:|-------|
| 1 | Playability & correctness | 30 |  |  |  |
| 2 | Completeness vs. spec | 20 |  |  |  |
| 3 | Game feel / juice | 20 |  |  |  |
| 4 | Code quality & structure | 15 |  |  |  |
| 5 | Ambition beyond baseline | 15 |  |  |  |
|   | **TOTAL** | **100** |  | **/100** |  |

## What worked

-

## What broke / was missing

-

## Disclosed cuts (model said it skipped these)

-

## Undisclosed gaps (claimed but absent/broken)

-

## One-line verdict

>
