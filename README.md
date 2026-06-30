# 🥕 Carrot Quest

A clean, crisp **pixel-art** precision platformer inspired by the **Dadish**
series. You play a little veggie parent rescuing their missing kids across four
strongly-themed worlds — hop chunky platforms, bounce off springs, dodge saws
and spikes, grab keys to open locked doors, and stomp grumpy food-blobs.

Built from scratch with **vanilla HTML5 Canvas + JavaScript** — no engine, no
build step, no image files. Characters are authored as pixel maps with automatic
heavy navy outlines, tiles are generated as chunky layered environmental pieces,
and everything is upscaled with nearest-neighbour for clean, crisp pixels.

## ▶️ Play

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000     # then visit http://localhost:8000
```

No dependencies, no install.

## 🎮 Controls

| Action | Keys |
| ------ | ---- |
| Move   | `←` `→` or `A` `D` |
| Jump   | `Space`, `↑`, `W`, `Z`, or `J` |
| Restart level | `R` |
| Back to level select | `Esc` |
| Mute / unmute | `M` |

On touch devices, on-screen buttons appear automatically.

## 🌍 The four worlds

- **Forest** — bright sky-blue background, leafy trees, tan dirt platforms with
  grassy tops, crates, and a playful outdoor mood.
- **Space Lab** — dark navy interiors, purple metal panels with bolts, orange
  ledges, a moon and starfield, machinery in the background.
- **Frozen Lab** — pale cracked ice blocks, blue frozen waterfalls, hanging
  icicles, white spikes, purple key-crates, narrow vertical routes.
- **Construction** — magenta sky, brick platforms, orange scaffolding,
  spinning saw blades, city silhouettes, and an obstacle-course feel.

## 🌟 Features

- **8 compact puzzle-room levels** (2 per world) — hazards, keys, and routes
  are all visible at once; challenge comes from timing and route planning.
- **Crisp pixel art**: simple, readable shapes with heavy near-black navy
  outlines; chunky layered tiles (dark border, bright top edge, material face,
  seams/bolts/cracks, shaded underside).
- **Layered backgrounds** for depth — far stars/moon/mountains/city, midground
  trees/machinery/waterfalls, foreground platforms.
- **Tight game-feel**: variable jump height, coyote time, jump buffering, and
  frame-based walk/jump animation.
- **Mechanics**: rescue all kids to unlock the exit; keys dissolve whole locked
  doors; **springs** bounce you high; **moving platforms** carry you; **saws**
  and **spikes** are instant-death hazards; stomp enemies from above.
- **Progress saving**: completed levels unlock the next and remember your best
  death count (`localStorage`).
- **Synthesized sound** via the Web Audio API — no audio files.

## 🛠️ Project structure

```
index.html        # canvas + script tags
css/style.css     # layout, pixel-crisp scaling, touch buttons
js/audio.js       # tiny Web Audio sound engine
js/sprites.js     # pixel-art engine: sprite maps, tile builders, themes
js/levels.js      # ASCII tilemaps + moving-platform data
js/game.js        # engine: physics, collision, camera, render, menus, loop
```

### Level format

Levels are ASCII maps. Tile legend:

| Char | Meaning | Char | Meaning |
| ---- | ------- | ---- | ------- |
| `#`  | solid block        | `S` | spring / bounce pad |
| `=`  | one-way platform   | `X` | saw blade (deadly) |
| `^`  | spike (deadly)     | `B` | crate (solid) |
| `K`  | key                | `L` | locked box (door) |
| `C`  | kid (rescue)       | `E` | walking enemy |
| `P`  | player spawn       | `G` | exit door |

Add a level by appending to `LEVELS` in `js/levels.js`; optional `movers`
add moving platforms.

---

Made as a Dadish-style spin-off. Have fun! 🥕
