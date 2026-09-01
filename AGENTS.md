# AGENTS.md — 03-asteroids

## Stack
- Vanilla HTML5 Canvas + JS (ES6+) in a single file. No `package.json`, no bundler, no deps, no build/lint/test tooling.

## Run
- `open index.html` directly, or `npx serve .` → `http://localhost:3000`. No install step.
- Entrypoint: `index.html:22` loads `game.js` via `<script>` (global scope, `'use strict'`). Canvas `id="canvas"` 800×600.

## Structure
- `game.js` (~423 lines) is the entire game — no modules. Classes: `Bullet`, `Asteroid`, `Ship`, `Particle` + imperative state/loop.
- Game states: `playing` → `dead` (2s timer, `deadTimer`) → `gameover` (Space to restart via `initGame()`). Level progression in `nextLevel()` — `spawnAsteroids(3 + level)`.
- `index.html` / `favicon.svg` — static only.

## Conventions & Gotchas
- Code/comments/identifiers are in Spanish. Preserve existing language.
- Toroidal wrapping: `wrap()` at `game.js:27` — all movement uses it (ship, bullets, asteroids). `W`/`H` constants (800/600) hardcoded, not derived from canvas element.
- Input uses `e.code` (`Space`, `ArrowUp/Left/Right`) with `keys` + `justPressed` pattern (`game.js:9-24`). `pressed()` consumes the flag — call once per frame.
- Asteroid sizing: `RADII`/`SPEEDS`/`POINTS` indexed by `size` 1–3 (`game.js:61-63`). `size 3` = large (20 pts) → splits into two `size-1`. `split()` returns `[]` for `size 1`.
- Ship: 3 lives, 3s `invincible` blink on reset (`game.js:133,174`), drag `0.987`, thrust `260`, `shootCooldown` `0.2s`.
- `dt` clamped to `0.05s` in `loop()` (`game.js:415`) to avoid physics jumps.
- No tests or CI for this subproject — verify changes visually in browser. No formatter/linter config to follow.
