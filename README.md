# 🥬 Radish Rescue

A cute, tight precision platformer inspired by the **Dadish** series. You play
a little radish parent on a mission to rescue all your missing veggie kids —
hop across platforms, stomp grumpy blobs, grab keys to open locked doors, and
dodge spikes to reach the exit.

Built from scratch with **vanilla HTML5 Canvas + JavaScript** — no engine, no
build step, no asset files. Every sprite (hero, kids, enemies, keys, doors,
scenery) is drawn procedurally at runtime, so it stays crisp at any size.

![title](https://img.shields.io/badge/play-in%20your%20browser-ff5d7a)

## ▶️ Play

Just open `index.html` in a browser. Or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
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

## 🌟 Features

- **8 hand-built levels** across **4 themed worlds** — Grassland, Desert,
  Cave, and Ice — each with its own palette and scenery.
- **Tight game-feel**: variable jump height, coyote time, jump buffering, and
  squash-&-stretch animation for responsive, forgiving controls.
- **Rescue the kids**: every level hides veggie children you must collect before
  the exit door unlocks.
- **Keys & doors**: grab a key to dissolve a whole locked door blocking your path.
- **Stompable enemies**: bounce on grumpy blobs from above — or get hurt walking
  into them.
- **Hazards**: spikes and bottomless pits send you back to the start (with a
  death counter so you can chase a low-death clear).
- **Progress saving**: completed levels unlock the next and remember your best
  death count (stored in `localStorage`).
- **Synthesized sound** via the Web Audio API — no audio files needed.

## 🗺️ How to win a level

1. Rescue **all** the kids (counter shown top-left).
2. The exit door unlocks (🔒 disappears).
3. Reach the door to clear the level.

## 🛠️ Project structure

```
index.html        # canvas + script tags
css/style.css     # layout, pixel-crisp scaling, touch buttons
js/audio.js       # tiny Web Audio sound engine
js/sprites.js     # procedural canvas drawing of every character/object
js/levels.js      # ASCII tilemaps + theme palettes
js/game.js        # engine: physics, collision, camera, menus, game loop
```

### Level format

Levels are ASCII maps. Tile legend:

| Char | Meaning |
| ---- | ------- |
| `#`  | solid ground/wall |
| `=`  | one-way platform (jump up through it) |
| `^`  | spike (deadly) |
| `K`  | key |
| `L`  | locked block (part of a door) |
| `C`  | collectible kid |
| `E`  | walking enemy |
| `P`  | player spawn |
| `G`  | exit door |

Add a new level by appending an entry to `LEVELS` in `js/levels.js`.

---

Made as a Dadish-style spin-off. Have fun! 🍅
