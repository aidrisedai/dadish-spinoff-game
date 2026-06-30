/* Carrot Quest — main engine.
   Clean pixel-art precision platformer. World is authored in base pixels
   (1 art-pixel = 1 unit) and upscaled with nearest-neighbour for crisp pixels. */
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;     // 960 x 540
  const SCALE = 3;
  const BASE_W = W / SCALE, BASE_H = H / SCALE;  // 320 x 180
  ctx.imageSmoothingEnabled = false;

  // ---------------------------------------------------------------- state
  const State = { TITLE: 0, SELECT: 1, PLAY: 2, WIN: 3, COMPLETE: 4 };
  let state = State.TITLE;
  let level, levelIndex = 0;
  let unlocked = loadProgress();
  let bestDeaths = {};

  // game-feel constants (tuned for 16px tiles)
  const GRAVITY = 0.34, MOVE = 0.55, FRICTION = 0.80, AIRACC = 0.42;
  const MAX_RUN = 2.4, JUMP_V = 5.9, MAX_FALL = 7.6;
  const COYOTE = 7, BUFFER = 8, SPRING_V = 9.7, STOMP_V = 4.6;

  // ---------------------------------------------------------------- input
  const keys = {};
  const press = { jump: false };
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump', KeyJ: 'jump'
  };
  addEventListener('keydown', (e) => {
    const k = KEYMAP[e.code];
    if (k) { e.preventDefault(); if (!keys[k]) press[k] = true; keys[k] = true; }
    if (e.code === 'KeyM') { const m = Sound.toggleMute(); flash(m ? 'Muted' : 'Sound on'); }
    handleMenuKey(e.code);
    Sound.resume();
  });
  addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });

  const touchWrap = document.getElementById('touch-controls');
  if ('ontouchstart' in window || navigator.maxTouchPoints) touchWrap.classList.remove('hidden');
  touchWrap.querySelectorAll('.tbtn').forEach((btn) => {
    const k = btn.dataset.key;
    const on = (e) => { e.preventDefault(); if (!keys[k]) press[k] = true; keys[k] = true; Sound.resume(); };
    const off = (e) => { e.preventDefault(); keys[k] = false; };
    btn.addEventListener('touchstart', on, { passive: false });
    btn.addEventListener('touchend', off, { passive: false });
    btn.addEventListener('touchcancel', off, { passive: false });
    btn.addEventListener('mousedown', on); btn.addEventListener('mouseup', off);
    btn.addEventListener('mouseleave', off);
  });

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (W / r.width);
    const my = (e.clientY - r.top) * (H / r.height);
    handleMenuClick(mx, my);
    Sound.resume();
  });

  // ---------------------------------------------------------------- progress
  function loadProgress() { try { return JSON.parse(localStorage.getItem('cq_unlocked')) || 1; } catch { return 1; } }
  function saveProgress() { try { localStorage.setItem('cq_unlocked', JSON.stringify(unlocked)); } catch {} }

  let flashMsg = '', flashT = 0;
  function flash(m) { flashMsg = m; flashT = 90; }

  // ---------------------------------------------------------------- level load
  function loadLevel(i) {
    levelIndex = i;
    const data = LEVELS[i];
    const rows = data.map;
    const cols = Math.max(...rows.map((r) => r.length));
    const grid = [];
    const kids = [], enemies = [], keysArr = [], spikes = [], saws = [], springs = [], springMap = {};
    let spawn = { x: 32, y: 32 }, goal = null;

    for (let y = 0; y < rows.length; y++) {
      grid[y] = [];
      const row = rows[y];
      for (let x = 0; x < cols; x++) {
        const c = row[x] || '.';
        let t = 0;
        const pxp = x * TILE, pyp = y * TILE;
        switch (c) {
          case '#': t = 1; break;
          case '=': t = 2; break;
          case 'L': t = 3; break;
          case 'B': t = 4; break;
          case 'S': t = 5; { const sp = { cx: x, cy: y, anim: 0 }; springs.push(sp); springMap[x + ',' + y] = sp; } break;
          case '^': spikes.push({ x: pxp, y: pyp }); break;
          case 'X': saws.push({ x: pxp + 8, y: pyp + 8, r: 9, rot: x }); break;
          case 'C': kids.push({ x: pxp + 5, y: pyp + 5, w: 6, h: 6, got: false }); break;
          case 'K': keysArr.push({ x: pxp + 5, y: pyp + 3, w: 6, h: 10, got: false }); break;
          case 'E': enemies.push(makeEnemy(pxp, pyp)); break;
          case 'P': spawn = { x: pxp, y: pyp }; break;
          case 'G': goal = { x: pxp - 1, y: pyp - TILE + 2, w: 18, h: 30 }; break;
        }
        grid[y][x] = t;
      }
    }
    if (!goal) goal = { x: (cols - 2) * TILE, y: 32, w: 18, h: 30 };

    const movers = (data.movers || []).map(m => {
      const x = m.tx * TILE, y = m.ty * TILE, w = m.tw * TILE;
      const span = m.dist * TILE;
      return {
        x, y, w, h: 7, axis: m.axis, speed: m.speed, dir: 1,
        min: m.axis === 'x' ? x : y, max: (m.axis === 'x' ? x : y) + span,
        px: x, py: y, dx: 0, dy: 0
      };
    });

    level = {
      data, themeKey: data.theme, theme: Art.THEMES[data.theme], cache: Art.themeCache(data.theme),
      grid, cols, rows: rows.length,
      kids, enemies, keys: keysArr, spikes, saws, springs, springMap, movers, goal, spawn,
      worldW: cols * TILE, worldH: rows.length * TILE,
      keysHeld: 0, kidsTotal: kids.length, kidsGot: 0,
      particles: [], t: 0, deaths: 0
    };
    resetPlayer();
    cam.x = 0; cam.y = 0;
  }

  function makeEnemy(px, py) {
    return { x: px + 2, y: py + 4, w: 12, h: 12, vx: 0.6, vy: 0, face: 1, alive: true, dead: 0 };
  }

  // ---------------------------------------------------------------- player
  const player = {
    x: 0, y: 0, w: 10, h: 12, vx: 0, vy: 0,
    onGround: false, face: 1, coyote: 0, buffer: 0,
    anim: 0, hurt: 0, dead: false, deadT: 0, jumpHeld: false, spawnRing: 0
  };
  function resetPlayer() {
    player.x = level.spawn.x + (TILE - player.w) / 2;
    player.y = level.spawn.y + (TILE - player.h);
    player.vx = player.vy = 0;
    player.onGround = false; player.dead = false; player.deadT = 0; player.hurt = 0; player.face = 1;
    player.spawnRing = 70;
  }

  // ---------------------------------------------------------------- camera
  const cam = { x: 0, y: 0 };
  function updateCamera() {
    const tx = player.x + player.w / 2 - BASE_W / 2;
    const ty = player.y + player.h / 2 - BASE_H * 0.58;
    cam.x += (tx - cam.x) * 0.14;
    cam.y += (ty - cam.y) * 0.14;
    cam.x = clamp(cam.x, 0, Math.max(0, level.worldW - BASE_W));
    cam.y = clamp(cam.y, -20, Math.max(0, level.worldH - BASE_H));
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------------------------------------------------------------- collision
  const isSolid = (t) => t === 1 || t === 3 || t === 4;
  function solidAt(cx, cy) {
    if (cy < 0) return 0;
    if (cx < 0 || cx >= level.cols || cy >= level.rows) return 1;
    return isSolid(level.grid[cy] && level.grid[cy][cx]) ? 1 : 0;
  }
  function tileType(cx, cy) {
    if (cx < 0 || cx >= level.cols || cy < 0 || cy >= level.rows) return 0;
    return (level.grid[cy] && level.grid[cy][cx]) || 0;
  }

  // ---------------------------------------------------------------- update
  function update() {
    level.t++;
    if (player.spawnRing > 0) player.spawnRing--;
    for (const s of level.springs) if (s.anim > 0) s.anim--;
    for (const sw of level.saws) sw.rot += 0.18;
    if (player.dead) { updateDeath(); return; }

    const accel = player.onGround ? MOVE : AIRACC;
    if (keys.left && !keys.right) { player.vx -= accel; player.face = -1; }
    else if (keys.right && !keys.left) { player.vx += accel; player.face = 1; }
    else { player.vx *= player.onGround ? FRICTION : 0.94; }
    player.vx = clamp(player.vx, -MAX_RUN, MAX_RUN);
    if (Math.abs(player.vx) < 0.04) player.vx = 0;

    if (press.jump) { player.buffer = BUFFER; press.jump = false; }
    if (player.buffer > 0) player.buffer--;
    if (player.coyote > 0) player.coyote--;
    if (player.buffer > 0 && player.coyote > 0) {
      player.vy = -JUMP_V; player.onGround = false; player.coyote = 0; player.buffer = 0;
      player.jumpHeld = true; Sound.jump();
    }
    if (!keys.jump && player.vy < -2.2) { player.vy *= 0.5; player.jumpHeld = false; }

    player.vy += GRAVITY;
    if (player.vy > MAX_FALL) player.vy = MAX_FALL;

    updateMovers();
    moveX(player.vx);
    moveY(player.vy);
    rideMovers();

    if (Math.abs(player.vx) > 0.3 && player.onGround) player.anim++;
    if (player.hurt > 0) player.hurt--;

    // collectibles
    for (const kid of level.kids) if (!kid.got && aabb(player, kid)) {
      kid.got = true; level.kidsGot++; Sound.collect();
      burst(kid.x + 3, kid.y + 3, '#ff6488', 12);
      flash(`Kid rescued!  ${level.kidsGot}/${level.kidsTotal}`);
    }
    for (const k of level.keys) if (!k.got && aabb(player, k)) {
      k.got = true; level.keysHeld++; Sound.key(); burst(k.x + 3, k.y + 4, '#ffd23f', 10);
    }
    if (level.keysHeld > 0) tryUnlock();

    updateEnemies();
    for (const sw of level.saws) {
      const dx = (player.x + player.w / 2) - sw.x, dy = (player.y + player.h / 2) - sw.y;
      if (dx * dx + dy * dy < (sw.r + 5) * (sw.r + 5)) { kill(); break; }
    }
    for (const s of level.spikes)
      if (aabbBox(player, s.x + 2, s.y + 7, TILE - 4, TILE - 7)) { kill(); break; }

    if (player.y > level.worldH + 60) kill();
    if (level.kidsGot >= level.kidsTotal && aabb(player, level.goal)) winLevel();

    updateParticles();
    updateCamera();
    if (flashT > 0) flashT--;
  }

  function moveX(dx) {
    player.x += dx;
    const top = Math.floor(player.y / TILE);
    const bot = Math.floor((player.y + player.h - 1) / TILE);
    if (dx > 0) {
      const right = Math.floor((player.x + player.w) / TILE);
      for (let cy = top; cy <= bot; cy++) if (solidAt(right, cy)) { player.x = right * TILE - player.w - 0.01; player.vx = 0; break; }
    } else if (dx < 0) {
      const left = Math.floor(player.x / TILE);
      for (let cy = top; cy <= bot; cy++) if (solidAt(left, cy)) { player.x = (left + 1) * TILE + 0.01; player.vx = 0; break; }
    }
  }

  function moveY(dy) {
    const wasGround = player.onGround;
    player.onGround = false;
    player.y += dy;
    const left = Math.floor(player.x / TILE);
    const right = Math.floor((player.x + player.w - 1) / TILE);
    if (dy > 0) {
      const bot = Math.floor((player.y + player.h) / TILE);
      const prevBot = Math.floor((player.y + player.h - dy) / TILE);
      for (let cx = left; cx <= right; cx++) {
        const tt = tileType(cx, bot);
        const solid = isSolid(tt);
        const oneway = tt === 2, spring = tt === 5;
        if (solid || ((oneway || spring) && prevBot < bot)) {
          player.y = bot * TILE - player.h - 0.01;
          if (spring) {
            player.vy = -SPRING_V; player.onGround = false;
            const s = level.springMap[cx + ',' + bot]; if (s) s.anim = 8;
            Sound.jump(); burst(cx * TILE + 8, bot * TILE, '#ff3d86', 8);
          } else {
            if (player.vy > 3 && !wasGround) Sound.land();
            player.vy = 0; player.onGround = true; player.coyote = COYOTE;
          }
          break;
        }
      }
    } else if (dy < 0) {
      const top = Math.floor(player.y / TILE);
      for (let cx = left; cx <= right; cx++) if (solidAt(cx, top)) { player.y = (top + 1) * TILE + 0.01; player.vy = 0; break; }
    }
    if (wasGround && !player.onGround && player.vy >= 0) player.coyote = COYOTE;
  }

  function updateMovers() {
    for (const m of level.movers) {
      m.px = m.x; m.py = m.y;
      const v = m.speed * m.dir;
      if (m.axis === 'x') { m.x += v; if (m.x <= m.min || m.x >= m.max) m.dir *= -1; }
      else { m.y += v; if (m.y <= m.min || m.y >= m.max) m.dir *= -1; }
      m.dx = m.x - m.px; m.dy = m.y - m.py;
    }
  }
  function rideMovers() {
    for (const m of level.movers) {
      const overX = player.x + player.w > m.x + 1 && player.x < m.x + m.w - 1;
      if (!overX) continue;
      const feet = player.y + player.h;
      if (player.vy >= 0 && feet >= m.y - 4 && feet <= m.y + 8) {
        player.y = m.y - player.h - 0.01;
        player.vy = 0; player.onGround = true; player.coyote = COYOTE;
        player.x += m.dx;
      }
    }
  }

  function tryUnlock() {
    const left = Math.floor((player.x - 2) / TILE), right = Math.floor((player.x + player.w + 2) / TILE);
    const top = Math.floor((player.y - 2) / TILE), bot = Math.floor((player.y + player.h + 2) / TILE);
    for (let cy = top; cy <= bot; cy++) for (let cx = left; cx <= right; cx++)
      if (tileType(cx, cy) === 3 && level.keysHeld > 0) {
        openCluster(cx, cy); level.keysHeld--; Sound.unlock(); flash('Door opened!'); return;
      }
  }
  function openCluster(sx, sy) {
    const stack = [[sx, sy]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (tileType(cx, cy) !== 3) continue;
      level.grid[cy][cx] = 0;
      burst(cx * TILE + 8, cy * TILE + 8, '#7a52c0', 6);
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  }

  function updateEnemies() {
    for (const e of level.enemies) {
      if (!e.alive) { e.dead++; continue; }
      e.vy += GRAVITY; e.y += e.vy;
      const l = Math.floor(e.x / TILE), r = Math.floor((e.x + e.w - 1) / TILE), b = Math.floor((e.y + e.h) / TILE);
      if (solidAt(l, b) || solidAt(r, b)) { e.y = b * TILE - e.h - 0.01; e.vy = 0; }
      e.x += e.vx;
      const dir = e.vx > 0 ? 1 : -1;
      const frontX = dir > 0 ? Math.floor((e.x + e.w + 1) / TILE) : Math.floor((e.x - 1) / TILE);
      const footY = Math.floor((e.y + e.h + 1) / TILE), midY = Math.floor((e.y + e.h / 2) / TILE);
      if (solidAt(frontX, midY) || !solidAt(frontX, footY)) { e.vx = -e.vx; e.x += e.vx * 2; e.face = -dir; }
      else e.face = dir;

      if (!player.dead && aabbBox(player, e.x, e.y, e.w, e.h)) {
        const falling = player.vy > 1 && (player.y + player.h) - e.y < 10;
        if (falling) {
          e.alive = false; e.dead = 1; player.vy = -STOMP_V;
          Sound.stomp(); burst(e.x + e.w / 2, e.y, '#ff6488', 12); flash('Stomp!');
        } else kill();
      }
    }
  }

  function kill() {
    if (player.dead) return;
    player.dead = true; player.deadT = 0; player.vy = -4; player.vx = 0;
    level.deaths++; Sound.die(); burst(player.x + player.w / 2, player.y + player.h / 2, '#ff6488', 16);
  }
  function updateDeath() {
    player.deadT++; player.vy += GRAVITY; player.y += player.vy;
    if (player.deadT > 38) resetPlayer();
    updateParticles();
  }

  function winLevel() {
    Sound.win();
    if (levelIndex + 1 > unlocked) { unlocked = levelIndex + 1; saveProgress(); }
    bestDeaths[levelIndex] = Math.min(bestDeaths[levelIndex] ?? 9999, level.deaths);
    state = (levelIndex + 1 >= LEVELS.length) ? State.COMPLETE : State.WIN;
  }

  // ---------------------------------------------------------------- particles
  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + level.t * 0.1;
      const s = 0.8 + (i % 3) * 0.7;
      level.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.6, life: 1, color, r: 1 + (i % 2) });
    }
  }
  function updateParticles() {
    for (let i = level.particles.length - 1; i >= 0; i--) {
      const p = level.particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.14; p.vx *= 0.95; p.life -= 0.035;
      if (p.life <= 0) level.particles.splice(i, 1);
    }
  }

  const aabb = (a, b) => aabbBox(a, b.x, b.y, b.w, b.h);
  const aabbBox = (a, bx, by, bw, bh) => a.x < bx + bw && a.x + a.w > bx && a.y < by + bh && a.y + a.h > by;

  // ================================================================ RENDER
  function render() {
    if (state === State.TITLE) return drawTitle();
    if (state === State.SELECT) return drawSelect();
    if (state === State.WIN) return drawWin();
    if (state === State.COMPLETE) return drawComplete();
    drawPlay();
  }

  // blit a base-resolution sprite to the upscaled canvas, pixel-aligned.
  function blit(img, bx, by, flip) {
    const x = Math.round(bx - cam.x) * SCALE, y = Math.round(by - cam.y) * SCALE;
    ctx.save();
    if (flip) { ctx.translate(x + img.width * SCALE, y); ctx.scale(-SCALE, SCALE); }
    else { ctx.translate(x, y); ctx.scale(SCALE, SCALE); }
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }
  // screen-space helpers (full canvas res)
  const sx = (wx) => Math.round((wx - cam.x) * SCALE);
  const sy = (wy) => Math.round((wy - cam.y) * SCALE);

  function drawPlay() {
    drawBackground(level.themeKey);
    drawTiles();

    // keys
    for (const k of level.keys) if (!k.got) {
      const b = Math.round(Math.sin(level.t * 0.08 + k.x) * 1.5);
      blit(Art.sprites.key, k.x - 2, k.y + b, false);
    }
    // kids (with sparkle ring)
    for (const kid of level.kids) if (!kid.got) {
      const b = Math.round(Math.sin(level.t * 0.06 + kid.x) * 1.5);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
      ctx.setLineDash([3 * SCALE, 4 * SCALE]); ctx.lineDashOffset = -level.t;
      ctx.beginPath(); ctx.arc(sx(kid.x + 3), sy(kid.y + 3 + b), 9 * SCALE, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      blit(Art.kid('#ff6488'), kid.x - 3, kid.y - 4 + b, false);
    }
    // movers
    for (const m of level.movers) drawMover(m);
    // saws
    for (const sw of level.saws) Art.drawSaw(ctx, sx(sw.x), sy(sw.y), sw.r * SCALE, sw.rot);

    // goal door
    const allKids = level.kidsGot >= level.kidsTotal;
    ctx.globalAlpha = allKids ? 1 : 0.5;
    blit(level.cache.door, level.goal.x, level.goal.y, false);
    ctx.globalAlpha = 1;
    if (!allKids) {
      ctx.fillStyle = '#fff'; ctx.font = `bold ${10 * SCALE}px monospace`; ctx.textAlign = 'center';
      ctx.fillText('locked', sx(level.goal.x + 9), sy(level.goal.y - 4));
    }

    // enemies (food characters)
    for (const e of level.enemies) {
      if (!e.alive && e.dead > 22) continue;
      if (!e.alive) {
        const col = level.theme.enemy;
        ctx.fillStyle = col[1];
        ctx.fillRect(sx(e.x + 1), sy(e.y + e.h - 4), (e.w - 2) * SCALE, 4 * SCALE);
        ctx.strokeStyle = Art.NAVY; ctx.lineWidth = SCALE;
        ctx.strokeRect(sx(e.x + 1), sy(e.y + e.h - 4), (e.w - 2) * SCALE, 4 * SCALE);
      } else blit(Art.foodFor(level.themeKey), e.x - 1, e.y - 1, e.face < 0);
    }

    // particles
    for (const p of level.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(sx(p.x), sy(p.y), (p.r + 1) * SCALE, (p.r + 1) * SCALE);
    }
    ctx.globalAlpha = 1;

    // spawn ring (Dadish-style checkpoint halo)
    if (player.spawnRing > 0 && !player.dead) {
      const a = Math.min(1, player.spawnRing / 70);
      ctx.globalAlpha = a * 0.85; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.setLineDash([4 * SCALE, 4 * SCALE]); ctx.lineDashOffset = -level.t * 1.5;
      ctx.beginPath();
      ctx.arc(sx(player.x + player.w / 2), sy(player.y + player.h / 2), 13 * SCALE, 0, Math.PI * 2);
      ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }

    // hero
    if (!player.dead || player.deadT < 26) {
      let img = Art.sprites.heroIdle;
      if (player.hurt > 0 || player.dead) img = Art.sprites.heroHurt;
      else if (!player.onGround) img = Art.sprites.heroJump;
      else if (Math.abs(player.vx) > 0.3) img = (Math.floor(player.anim / 5) % 2) ? Art.sprites.heroWalk : Art.sprites.heroIdle;
      if (player.dead) ctx.globalAlpha = Math.max(0, 1 - player.deadT / 26);
      blit(img, player.x - 1, player.y - 2, player.face < 0);
      ctx.globalAlpha = 1;
    }

    drawHUD();
  }

  function drawMover(m) {
    const x = sx(m.x), y = sy(m.y), w = m.w * SCALE, h = m.h * SCALE;
    ctx.fillStyle = level.theme.plat; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = level.theme.platTop; ctx.fillRect(x, y, w, 2 * SCALE);
    ctx.fillStyle = Art.NAVY; ctx.fillRect(x, y, w, SCALE);
    ctx.fillStyle = Art.shade(level.theme.plat, -0.3);
    ctx.fillRect(x, y + h - SCALE, w, SCALE);
    // track bolts
    ctx.fillStyle = Art.NAVY;
    ctx.fillRect(x + 2 * SCALE, y + 3 * SCALE, SCALE, SCALE);
    ctx.fillRect(x + w - 3 * SCALE, y + 3 * SCALE, SCALE, SCALE);
  }

  function drawTiles() {
    const x0 = Math.max(0, Math.floor(cam.x / TILE)), x1 = Math.min(level.cols, Math.ceil((cam.x + BASE_W) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(cam.y / TILE)), y1 = Math.min(level.rows, Math.ceil((cam.y + BASE_H) / TILE) + 1);
    const C = level.cache;
    for (let cy = y0; cy < y1; cy++) for (let cx = x0; cx < x1; cx++) {
      const t = level.grid[cy][cx];
      if (t === 0) continue;
      const wx = cx * TILE, wy = cy * TILE;
      if (t === 1) { const above = level.grid[cy - 1] && level.grid[cy - 1][cx]; blit(isSolid(above) ? C.mid : C.top, wx, wy, false); }
      else if (t === 2) blit(C.oneway, wx, wy, false);
      else if (t === 3) blit(C.lock, wx, wy, false);
      else if (t === 4) blit(C.crate, wx, wy, false);
      else if (t === 5) { const s = level.springMap[cx + ',' + cy]; blit(s && s.anim > 0 ? C.spring.down : C.spring.up, wx, wy, false); }
    }
    for (const s of level.spikes) {
      if (s.x < cam.x - TILE || s.x > cam.x + BASE_W) continue;
      blit(C.spike, s.x, s.y, false);
    }
  }

  // ---------------------------------------------------------------- backgrounds
  function skyGrad(a, b) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, a); g.addColorStop(1, b); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  function drawBackground(key) {
    const th = level.theme;
    skyGrad(th.sky[0], th.sky[1]);
    if (key === 'forest') {
      ctx.fillStyle = '#fff6c0'; ctx.beginPath(); ctx.arc(W * 0.8, H * 0.22, 36, 0, Math.PI * 2); ctx.fill();
      clouds(0.18);
      layerHills('#bfe6a0', 0.25, 0.78, 150);
      layerHills('#9ad17e', 0.4, 0.86, 110);
      layerTrees(0.55);
    } else if (key === 'desert') {
      clouds(0.18);
      layerHills('#ecd083', 0.25, 0.8, 150);
      layerHills('#dcb85e', 0.4, 0.88, 110);
      cacti(0.55);
    } else if (key === 'lab') {
      starfield(); ctx.fillStyle = '#d8d2ff'; ctx.beginPath(); ctx.arc(W * 0.18, H * 0.25, 30, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#bcb4f0'; ctx.beginPath(); ctx.arc(W * 0.18 - 10, H * 0.25 - 8, 30, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = th.sky[0]; ctx.beginPath(); ctx.arc(W * 0.18 - 16, H * 0.25 - 10, 28, 0, Math.PI * 2); ctx.fill();
      machinery(0.4);
    } else if (key === 'ice') {
      frozenFalls(0.3); icicles();
    }
  }
  function clouds(par) {
    const off = cam.x * SCALE * par; ctx.fillStyle = 'rgba(255,255,255,0.92)';
    for (let i = -1; i < 6; i++) {
      const x = i * 280 - (off % 280) + 80, y = 64 + ((i * 67) % 90);
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.arc(x + 22, y + 5, 24, 0, Math.PI * 2);
      ctx.arc(x + 46, y, 18, 0, Math.PI * 2); ctx.arc(x + 22, y - 8, 20, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function cacti(par) {
    const off = cam.x * SCALE * par;
    for (let i = -1; i < 8; i++) {
      const x = i * 240 - (off % 240) + 90, y = H * 0.55;
      ctx.fillStyle = '#3fa05a';
      ctx.fillRect(x - 7, y, 14, 100);
      ctx.fillRect(x - 24, y + 22, 16, 13); ctx.fillRect(x - 24, y + 9, 13, 26);
      ctx.fillRect(x + 8, y + 12, 16, 13); ctx.fillRect(x + 11, y, 13, 25);
      ctx.fillStyle = '#2f8047';
      ctx.fillRect(x + 1, y, 6, 100); ctx.fillRect(x + 11, y + 22, 13, 4);
    }
  }
  function layerHills(col, par, baseY, rad) {
    ctx.fillStyle = col; const off = cam.x * SCALE * par;
    for (let i = -1; i < 8; i++) { const hx = i * 240 - (off % 240); ctx.beginPath(); ctx.arc(hx + 120, H * baseY + rad, rad, 0, Math.PI * 2); ctx.fill(); }
  }
  function layerTrees(par) {
    const off = cam.x * SCALE * par;
    for (let i = -1; i < 9; i++) {
      const x = i * 210 - (off % 210) + 70, y = H * 0.62;
      ctx.fillStyle = '#6b4326'; ctx.fillRect(x - 6, y, 12, 70);
      ctx.fillStyle = '#3f9c4f'; ctx.beginPath(); ctx.arc(x, y, 34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5ec46b'; ctx.beginPath(); ctx.arc(x - 10, y - 6, 22, 0, Math.PI * 2); ctx.fill();
    }
  }
  function starfield() {
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 70; i++) {
      const x = (i * 137.5) % W, y = (i * 89.3) % (H * 0.8);
      const s = (i % 3 === 0) ? 3 : 2; ctx.globalAlpha = 0.4 + (i % 5) * 0.12;
      ctx.fillRect(x, y, s, s);
    }
    ctx.globalAlpha = 1;
  }
  function machinery(par) {
    const off = cam.x * SCALE * par;
    for (let i = -1; i < 7; i++) {
      const x = i * 280 - (off % 280) + 40, y = H * 0.5;
      ctx.fillStyle = '#241a4d'; ctx.fillRect(x, y, 120, H - y);
      ctx.fillStyle = '#322463';
      for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) ctx.fillRect(x + 12 + a * 28, y + 14 + b * 34, 18, 22);
      ctx.fillStyle = '#ff6488'; ctx.fillRect(x + 90, y + 12, 8, 8);
      ctx.fillStyle = '#5ec46b'; ctx.fillRect(x + 90, y + 26, 8, 8);
    }
  }
  function frozenFalls(par) {
    const off = cam.x * SCALE * par;
    for (let i = -1; i < 8; i++) {
      const x = i * 230 - (off % 230) + 60;
      ctx.fillStyle = 'rgba(140,200,235,0.35)'; ctx.fillRect(x, 0, 46, H * 0.85);
      ctx.fillStyle = 'rgba(200,235,255,0.4)'; ctx.fillRect(x + 8, 0, 10, H * 0.85);
      ctx.fillRect(x + 28, 0, 8, H * 0.85);
    }
  }
  function icicles() {
    ctx.fillStyle = '#cfe6f2';
    for (let i = 0; i < 30; i++) {
      const x = (i * 71) % W; const h = 14 + (i % 4) * 12;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 8, 0); ctx.lineTo(x + 4, h); ctx.closePath(); ctx.fill();
    }
  }
  // ---------------------------------------------------------------- HUD
  function drawHUD() {
    panel(14, 12, 250, 44);
    blit2(Art.kid('#ff6488'), 24, 22, 2.6);
    hudText(`${level.kidsGot}/${level.kidsTotal}`, 50, 42, 22);
    blit2(Art.sprites.key, 116, 20, 2.2);
    hudText(`x${level.keysHeld}`, 140, 42, 20);
    ctx.fillStyle = '#ffb3c6'; hudText(`☠ ${level.deaths}`, 200, 42, 18);

    ctx.textAlign = 'right';
    hudText(`${levelIndex + 1}. ${level.data.name}`, W - 16, 30, 18, '#fff', 'right');
    ctx.font = '13px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.textAlign = 'right';
    ctx.fillText('M mute  Esc levels  R restart', W - 16, 50);
    ctx.textAlign = 'left';

    if (flashT > 0) {
      ctx.globalAlpha = Math.min(1, flashT / 30); ctx.textAlign = 'center';
      ctx.font = 'bold 26px monospace'; ctx.lineWidth = 6; ctx.strokeStyle = Art.NAVY;
      ctx.strokeText(flashMsg, W / 2, 84); ctx.fillStyle = '#fff'; ctx.fillText(flashMsg, W / 2, 84);
      ctx.globalAlpha = 1; ctx.textAlign = 'left';
    }
  }
  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(21,25,58,0.7)'; roundRect(x, y, w, h, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.stroke();
  }
  function hudText(t, x, y, size, col = '#fff', align = 'left') {
    ctx.textAlign = align; ctx.font = `bold ${size}px monospace`;
    ctx.lineWidth = 5; ctx.strokeStyle = Art.NAVY; ctx.strokeText(t, x, y);
    ctx.fillStyle = col; ctx.fillText(t, x, y);
  }
  function blit2(img, x, y, scale) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.translate(x, y); ctx.scale(scale, scale); ctx.drawImage(img, 0, 0); ctx.restore();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // ---------------------------------------------------------------- menus
  function menuBG() {
    skyGrad('#5fc6ec', '#a9e6f2');
    ctx.fillStyle = '#fff6c0'; ctx.beginPath(); ctx.arc(W * 0.82, H * 0.2, 40, 0, Math.PI * 2); ctx.fill();
    const t = performance.now() * 0.001;
    for (let i = 0; i < 7; i++) {
      const x = (i * 150 + Math.sin(t + i) * 30) % (W + 60) - 30;
      const y = 90 + ((i * 83) % (H - 200)) + Math.sin(t * 1.2 + i) * 12;
      blit2(Art.kid('#ff6488'), x, y, 3);
    }
  }
  function bigHero(cx, cy, scale, frame) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    const img = frame || Art.sprites.heroIdle;
    ctx.translate(cx - img.width * scale / 2, cy - img.height * scale / 2);
    ctx.scale(scale, scale); ctx.drawImage(img, 0, 0); ctx.restore();
  }

  let titleBtns = [];
  function drawTitle() {
    menuBG();
    const t = performance.now() * 0.003;
    bigHero(W / 2, 150 + Math.sin(t) * 8, 8, Math.sin(t) > 0 ? Art.sprites.heroIdle : Art.sprites.heroWalk);
    ctx.textAlign = 'center';
    ctx.font = 'bold 60px monospace'; ctx.lineWidth = 8; ctx.strokeStyle = Art.NAVY; ctx.fillStyle = '#ff6488';
    ctx.strokeText('CARROT QUEST', W / 2, 330); ctx.fillText('CARROT QUEST', W / 2, 330);
    ctx.font = 'bold 17px monospace'; ctx.fillStyle = Art.NAVY;
    ctx.fillText('Rescue every kid across 4 worlds', W / 2, 358);
    titleBtns = [
      { label: unlocked > 1 ? 'CONTINUE' : 'PLAY', x: W / 2 - 110, y: 380, w: 220, h: 50, action: 'play' },
      { label: 'LEVEL SELECT', x: W / 2 - 110, y: 442, w: 220, h: 44, action: 'select' }
    ];
    titleBtns.forEach(drawButton);
    ctx.font = '13px monospace'; ctx.fillStyle = Art.NAVY;
    ctx.fillText('Arrows/WASD move • Space/J jump • M mute', W / 2, 520);
    ctx.textAlign = 'left';
  }
  function drawButton(b) {
    ctx.fillStyle = '#ff6488'; roundRect(b.x, b.y, b.w, b.h, 10); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = Art.NAVY; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 21px monospace'; ctx.textAlign = 'center';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 7); ctx.textAlign = 'left';
  }

  let selectCells = [];
  function drawSelect() {
    menuBG(); ctx.textAlign = 'center';
    ctx.font = 'bold 38px monospace'; ctx.lineWidth = 6; ctx.strokeStyle = Art.NAVY; ctx.fillStyle = '#fff';
    ctx.strokeText('SELECT A LEVEL', W / 2, 64); ctx.fillText('SELECT A LEVEL', W / 2, 64);
    selectCells = [];
    const cols = 4, cw = 184, chh = 112, gap = 22;
    const totalW = cols * cw + (cols - 1) * gap, startX = (W - totalW) / 2, startY = 100;
    for (let i = 0; i < LEVELS.length; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      const x = startX + c * (cw + gap), y = startY + r * (chh + gap), open = i < unlocked;
      selectCells.push({ x, y, w: cw, h: chh, i, open });
      ctx.fillStyle = open ? '#fff' : 'rgba(255,255,255,0.4)'; roundRect(x, y, cw, chh, 12); ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = Art.NAVY; ctx.stroke();
      const th = Art.THEMES[LEVELS[i].theme];
      const g = ctx.createLinearGradient(0, y, 0, y + 46); g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.face);
      ctx.fillStyle = g; roundRect(x + 12, y + 12, cw - 24, 42, 8); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace';
      ctx.fillText(th.name.toUpperCase(), x + cw / 2, y + 38);
      ctx.fillStyle = Art.NAVY; ctx.font = 'bold 16px monospace';
      ctx.fillText(open ? `${i + 1}. ${LEVELS[i].name}` : '🔒 Locked', x + cw / 2, y + 78);
      if (open && bestDeaths[i] != null) { ctx.font = '12px monospace'; ctx.fillStyle = '#a0456a'; ctx.fillText(`best deaths: ${bestDeaths[i]}`, x + cw / 2, y + 98); }
    }
    selectCells.push({ x: W / 2 - 80, y: H - 50, w: 160, h: 38, back: true });
    ctx.fillStyle = Art.NAVY; roundRect(W / 2 - 80, H - 50, 160, 38, 9); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 17px monospace'; ctx.fillText('◀ BACK', W / 2, H - 25);
    ctx.textAlign = 'left';
  }

  let winBtns = [];
  function drawWin() {
    menuBG(); ctx.textAlign = 'center';
    bigHero(W / 2, 130, 7, Art.sprites.heroJump);
    ctx.font = 'bold 50px monospace'; ctx.lineWidth = 7; ctx.strokeStyle = Art.NAVY; ctx.fillStyle = '#ffd23f';
    ctx.strokeText('LEVEL CLEAR!', W / 2, 250); ctx.fillText('LEVEL CLEAR!', W / 2, 250);
    ctx.font = 'bold 20px monospace'; ctx.fillStyle = Art.NAVY;
    ctx.fillText(`${LEVELS[levelIndex].name}  •  deaths: ${level.deaths}`, W / 2, 288);
    winBtns = [
      { label: 'NEXT ▶', x: W / 2 - 120, y: 312, w: 240, h: 50, action: 'next' },
      { label: 'REPLAY', x: W / 2 - 120, y: 372, w: 116, h: 42, action: 'replay' },
      { label: 'LEVELS', x: W / 2 + 4, y: 372, w: 116, h: 42, action: 'select' }
    ];
    winBtns.forEach(drawButton); ctx.textAlign = 'left';
  }

  let completeBtns = [];
  function drawComplete() {
    menuBG(); ctx.textAlign = 'center';
    bigHero(W / 2, 140, 9, Art.sprites.heroJump);
    ctx.font = 'bold 44px monospace'; ctx.lineWidth = 7; ctx.strokeStyle = Art.NAVY; ctx.fillStyle = '#ff6488';
    ctx.strokeText('ALL KIDS RESCUED!', W / 2, 300); ctx.fillText('ALL KIDS RESCUED!', W / 2, 300);
    ctx.font = 'bold 19px monospace'; ctx.fillStyle = Art.NAVY;
    const total = Object.values(bestDeaths).reduce((a, b) => a + b, 0);
    ctx.fillText(`You cleared all ${LEVELS.length} levels! Best total deaths: ${total}`, W / 2, 338);
    completeBtns = [{ label: 'BACK TO TITLE', x: W / 2 - 120, y: 372, w: 240, h: 50, action: 'title' }];
    completeBtns.forEach(drawButton); ctx.textAlign = 'left';
  }

  // ---------------------------------------------------------------- menu input
  const hitB = (b, mx, my) => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;
  function handleMenuClick(mx, my) {
    if (state === State.TITLE) for (const b of titleBtns) { if (hitB(b, mx, my)) { Sound.select(); if (b.action === 'play') startGame(unlocked > 1 ? Math.min(unlocked, LEVELS.length) - 1 : 0); else state = State.SELECT; } }
    else if (state === State.SELECT) for (const cl of selectCells) { if (hitB(cl, mx, my)) { if (cl.back) { Sound.select(); state = State.TITLE; return; } if (cl.open) { Sound.select(); startGame(cl.i); return; } } }
    else if (state === State.WIN) for (const b of winBtns) { if (hitB(b, mx, my)) { Sound.select(); if (b.action === 'next') startGame(Math.min(levelIndex + 1, LEVELS.length - 1)); else if (b.action === 'replay') startGame(levelIndex); else state = State.SELECT; } }
    else if (state === State.COMPLETE) for (const b of completeBtns) if (hitB(b, mx, my)) { Sound.select(); state = State.TITLE; }
  }
  function handleMenuKey(code) {
    if (code === 'Escape') { if (state === State.PLAY) state = State.SELECT; else if (state === State.SELECT) state = State.TITLE; }
    if (code === 'KeyR' && state === State.PLAY) startGame(levelIndex);
    if ((code === 'Enter') && state === State.TITLE) startGame(unlocked > 1 ? Math.min(unlocked, LEVELS.length) - 1 : 0);
    if (code === 'Enter' && state === State.WIN) startGame(Math.min(levelIndex + 1, LEVELS.length - 1));
  }
  function startGame(i) { loadLevel(i); state = State.PLAY; }

  // ---------------------------------------------------------------- loop
  let last = 0, acc = 0; const STEP = 1000 / 60;
  function loop(ts) {
    const dt = Math.min(50, ts - last); last = ts; acc += dt;
    while (acc >= STEP) { if (state === State.PLAY) update(); acc -= STEP; }
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
