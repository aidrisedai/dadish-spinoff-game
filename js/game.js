/* Radish Rescue — main engine.
   A tight, Dadish-style precision platformer. */
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // ---------------------------------------------------------------- state
  const State = { TITLE: 0, SELECT: 1, PLAY: 2, WIN: 3, COMPLETE: 4 };
  let state = State.TITLE;
  let level, levelIndex = 0;
  let unlocked = loadProgress();
  let bestDeaths = {};

  // game-feel constants
  const GRAVITY = 0.62, MOVE = 0.85, FRICTION = 0.78, AIR = 0.62;
  const MAX_RUN = 4.6, JUMP_V = 11.2, MAX_FALL = 13;
  const COYOTE = 7, BUFFER = 8;

  // ---------------------------------------------------------------- input
  const keys = {};
  const press = { jump: false };
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
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

  // touch controls
  const touchWrap = document.getElementById('touch-controls');
  if ('ontouchstart' in window || navigator.maxTouchPoints) touchWrap.classList.remove('hidden');
  touchWrap.querySelectorAll('.tbtn').forEach((btn) => {
    const k = btn.dataset.key;
    const on = (e) => { e.preventDefault(); if (!keys[k]) press[k] = true; keys[k] = true; Sound.resume(); };
    const off = (e) => { e.preventDefault(); keys[k] = false; };
    btn.addEventListener('touchstart', on, { passive: false });
    btn.addEventListener('touchend', off, { passive: false });
    btn.addEventListener('touchcancel', off, { passive: false });
    btn.addEventListener('mousedown', on);
    btn.addEventListener('mouseup', off);
    btn.addEventListener('mouseleave', off);
  });

  // pointer clicks for menus
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (W / r.width);
    const my = (e.clientY - r.top) * (H / r.height);
    handleMenuClick(mx, my);
    Sound.resume();
  });

  // ---------------------------------------------------------------- progress
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem('rr_unlocked')) || 1; } catch { return 1; }
  }
  function saveProgress() {
    try { localStorage.setItem('rr_unlocked', JSON.stringify(unlocked)); } catch {}
  }

  // ---------------------------------------------------------------- flash msg
  let flashMsg = '', flashT = 0;
  function flash(m) { flashMsg = m; flashT = 90; }

  // ---------------------------------------------------------------- level load
  function loadLevel(i) {
    levelIndex = i;
    const data = LEVELS[i];
    const rows = data.map;
    const cols = Math.max(...rows.map((r) => r.length));
    const grid = [];
    const kids = [], enemies = [], keysArr = [], locks = [], spikes = [];
    let spawn = { x: 64, y: 64 }, goal = null;

    for (let y = 0; y < rows.length; y++) {
      grid[y] = [];
      const row = rows[y];
      for (let x = 0; x < cols; x++) {
        const c = row[x] || '.';
        let t = 0; // 0 empty,1 solid,2 oneway,3 lock(solid)
        const px = x * TILE, py = y * TILE;
        switch (c) {
          case '#': t = 1; break;
          case '=': t = 2; break;
          case 'L': t = 3; locks.push({ x, y }); break;
          case '^': spikes.push({ x: px, y: py }); break;
          case 'C': kids.push({ x: px + 6, y: py + 6, w: 20, h: 20, got: false }); break;
          case 'K': keysArr.push({ x: px + 8, y: py + 4, w: 16, h: 24, got: false }); break;
          case 'E': enemies.push(makeEnemy(px, py)); break;
          case 'P': spawn = { x: px, y: py }; break;
          case 'G': goal = { x: px, y: py - TILE, w: TILE, h: TILE * 2 }; break;
        }
        grid[y][x] = t;
      }
    }
    if (!goal) goal = { x: (cols - 2) * TILE, y: 64, w: TILE, h: TILE * 2 };

    level = {
      data, theme: THEMES[data.theme], grid, cols, rows: rows.length,
      kids, enemies, keys: keysArr, locks, spikes, goal, spawn,
      worldW: cols * TILE, worldH: rows.length * TILE,
      keysHeld: 0, kidsTotal: kids.length, kidsGot: 0,
      particles: [], t: 0, deaths: 0
    };
    resetPlayer();
    cam.x = 0; cam.y = 0;
  }

  function makeEnemy(px, py) {
    return { x: px + 2, y: py + 4, w: 28, h: 28, vx: 1.1, face: 1, dead: 0, alive: true, startY: py + 4 };
  }

  // ---------------------------------------------------------------- player
  const player = {
    x: 0, y: 0, w: 22, h: 26, vx: 0, vy: 0,
    onGround: false, face: 1, coyote: 0, buffer: 0,
    squash: 0, stretch: 0, hurt: 0, dead: false, deadT: 0, jumpHeld: false
  };
  function resetPlayer() {
    player.x = level.spawn.x + (TILE - player.w) / 2;
    player.y = level.spawn.y + (TILE - player.h);
    player.vx = player.vy = 0;
    player.onGround = false; player.dead = false; player.deadT = 0;
    player.hurt = 0; player.face = 1;
  }

  // ---------------------------------------------------------------- camera
  const cam = { x: 0, y: 0 };
  function updateCamera() {
    const tx = player.x + player.w / 2 - W / 2;
    const ty = player.y + player.h / 2 - H * 0.58;
    cam.x += (tx - cam.x) * 0.12;
    cam.y += (ty - cam.y) * 0.12;
    cam.x = Math.max(0, Math.min(cam.x, level.worldW - W));
    cam.y = Math.max(-40, Math.min(cam.y, level.worldH - H));
  }

  // ---------------------------------------------------------------- collision helpers
  function solidAt(cx, cy) {
    if (cy < 0) return 0;
    if (cx < 0 || cx >= level.cols || cy >= level.rows) return 1; // walls/floor outside
    const t = level.grid[cy] && level.grid[cy][cx];
    return t === 1 || t === 3 ? 1 : 0;
  }
  function tileType(cx, cy) {
    if (cx < 0 || cx >= level.cols || cy < 0 || cy >= level.rows) return 0;
    return (level.grid[cy] && level.grid[cy][cx]) || 0;
  }

  // ---------------------------------------------------------------- update
  function update() {
    level.t++;
    if (player.dead) { updateDeath(); return; }

    // ---- horizontal input
    const accel = player.onGround ? MOVE : MOVE * 0.72;
    if (keys.left && !keys.right) { player.vx -= accel; player.face = -1; }
    else if (keys.right && !keys.left) { player.vx += accel; player.face = 1; }
    else { player.vx *= player.onGround ? FRICTION : 0.92; }
    player.vx = Math.max(-MAX_RUN, Math.min(MAX_RUN, player.vx));
    if (Math.abs(player.vx) < 0.05) player.vx = 0;

    // ---- jump (coyote + buffer + variable height)
    if (press.jump) { player.buffer = BUFFER; press.jump = false; }
    if (player.buffer > 0) player.buffer--;
    if (player.coyote > 0) player.coyote--;

    if (player.buffer > 0 && player.coyote > 0) {
      player.vy = -JUMP_V;
      player.onGround = false; player.coyote = 0; player.buffer = 0;
      player.stretch = 8; player.jumpHeld = true;
      Sound.jump();
    }
    if (!keys.jump && player.vy < -3) { player.vy *= 0.5; player.jumpHeld = false; }

    // ---- gravity
    player.vy += GRAVITY;
    if (player.vy > MAX_FALL) player.vy = MAX_FALL;

    // ---- move + collide X
    moveX(player.vx);
    moveY(player.vy);

    // ---- squash/stretch decay
    if (player.squash > 0) player.squash--;
    if (player.stretch > 0) player.stretch--;
    if (player.hurt > 0) player.hurt--;

    // ---- collect kids
    for (const kid of level.kids) {
      if (!kid.got && aabb(player, kid)) {
        kid.got = true; level.kidsGot++;
        Sound.collect();
        burst(kid.x + kid.w / 2, kid.y + kid.h / 2, '#ff5d7a', 12);
        flash(`Kid rescued!  ${level.kidsGot}/${level.kidsTotal}`);
      }
    }
    // ---- collect keys
    for (const k of level.keys) {
      if (!k.got && aabb(player, k)) {
        k.got = true; level.keysHeld++;
        Sound.key(); burst(k.x + k.w / 2, k.y + k.h / 2, '#ffd84d', 10);
      }
    }
    // ---- unlock blocks (touching while holding a key)
    if (level.keysHeld > 0) tryUnlock();

    // ---- enemies
    updateEnemies();

    // ---- spikes
    for (const s of level.spikes) {
      if (aabbBox(player, s.x + 4, s.y + 10, TILE - 8, TILE - 10)) { kill(); break; }
    }

    // ---- fell out of world
    if (player.y > level.worldH + 80) kill();

    // ---- goal
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
      for (let cy = top; cy <= bot; cy++) {
        if (solidAt(right, cy)) { player.x = right * TILE - player.w - 0.01; player.vx = 0; break; }
      }
    } else if (dx < 0) {
      const left = Math.floor(player.x / TILE);
      for (let cy = top; cy <= bot; cy++) {
        if (solidAt(left, cy)) { player.x = (left + 1) * TILE + 0.01; player.vx = 0; break; }
      }
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
        const solid = tt === 1 || tt === 3;
        const oneway = tt === 2;
        if (solid || (oneway && prevBot < bot)) {
          player.y = bot * TILE - player.h - 0.01;
          if (player.vy > 6) { player.squash = 7; if (!wasGround) Sound.land(); }
          player.vy = 0; player.onGround = true; player.coyote = COYOTE;
          break;
        }
      }
    } else if (dy < 0) {
      const top = Math.floor(player.y / TILE);
      for (let cx = left; cx <= right; cx++) {
        if (solidAt(cx, top)) { player.y = (top + 1) * TILE + 0.01; player.vy = 0; break; }
      }
    }
    if (wasGround && !player.onGround && player.vy >= 0) player.coyote = COYOTE;
  }

  function tryUnlock() {
    const left = Math.floor((player.x - 2) / TILE);
    const right = Math.floor((player.x + player.w + 2) / TILE);
    const top = Math.floor((player.y - 2) / TILE);
    const bot = Math.floor((player.y + player.h + 2) / TILE);
    for (let cy = top; cy <= bot; cy++) {
      for (let cx = left; cx <= right; cx++) {
        if (tileType(cx, cy) === 3 && level.keysHeld > 0) {
          // one key dissolves the whole connected lock "door"
          openCluster(cx, cy);
          level.keysHeld--;
          Sound.unlock();
          flash('Door opened!');
          return;
        }
      }
    }
  }

  // flood-fill remove a connected group of locked tiles
  function openCluster(sx, sy) {
    const stack = [[sx, sy]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (tileType(cx, cy) !== 3) continue;
      level.grid[cy][cx] = 0;
      burst(cx * TILE + TILE / 2, cy * TILE + TILE / 2, '#7a52b8', 8);
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  }

  function updateEnemies() {
    for (const e of level.enemies) {
      if (!e.alive) { e.dead++; continue; }
      // gravity for enemy
      e.vy = (e.vy || 0) + GRAVITY;
      e.y += e.vy;
      const ecLeft = Math.floor(e.x / TILE);
      const ecRight = Math.floor((e.x + e.w - 1) / TILE);
      const ecBot = Math.floor((e.y + e.h) / TILE);
      if (solidAt(ecLeft, ecBot) || solidAt(ecRight, ecBot)) {
        e.y = ecBot * TILE - e.h - 0.01; e.vy = 0;
      }
      // patrol; turn at walls and ledges
      e.x += e.vx;
      const dir = e.vx > 0 ? 1 : -1;
      const frontX = dir > 0 ? Math.floor((e.x + e.w + 1) / TILE) : Math.floor((e.x - 1) / TILE);
      const footY = Math.floor((e.y + e.h + 1) / TILE);
      const midY = Math.floor((e.y + e.h / 2) / TILE);
      if (solidAt(frontX, midY) || !solidAt(frontX, footY)) {
        e.vx = -e.vx; e.x += e.vx * 2; e.face = -dir;
      } else e.face = dir;

      // collide with player
      if (!player.dead && aabbBox(player, e.x, e.y, e.w, e.h)) {
        const falling = player.vy > 1.5 && (player.y + player.h) - e.y < 18;
        if (falling) {
          e.alive = false; e.dead = 1;
          player.vy = -JUMP_V * 0.72; player.squash = 6;
          Sound.stomp(); burst(e.x + e.w / 2, e.y, '#8b66e6', 12);
          flash('Stomp!');
        } else { kill(); }
      }
    }
  }

  function kill() {
    if (player.dead) return;
    player.dead = true; player.deadT = 0; player.vy = -6; player.vx = 0;
    level.deaths++;
    Sound.die();
    burst(player.x + player.w / 2, player.y + player.h / 2, '#ff5d7a', 18);
  }
  function updateDeath() {
    player.deadT++;
    player.vy += GRAVITY; player.y += player.vy;
    if (player.deadT > 42) { resetPlayer(); }
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
      const a = (Math.PI * 2 * i) / n + Math.random();
      const s = 1.5 + Math.random() * 3.5;
      level.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 1, color, r: 2 + Math.random() * 2 });
    }
  }
  function updateParticles() {
    for (let i = level.particles.length - 1; i >= 0; i--) {
      const p = level.particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.vx *= 0.96; p.life -= 0.03;
      if (p.life <= 0) level.particles.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------- collision math
  function aabb(a, b) { return aabbBox(a, b.x, b.y, b.w, b.h); }
  function aabbBox(a, bx, by, bw, bh) {
    return a.x < bx + bw && a.x + a.w > bx && a.y < by + bh && a.y + a.h > by;
  }

  // ================================================================ RENDER
  function render() {
    if (state === State.TITLE) return drawTitle();
    if (state === State.SELECT) return drawSelect();
    if (state === State.WIN) return drawWin();
    if (state === State.COMPLETE) return drawComplete();
    drawPlay();
  }

  function drawBackground() {
    const th = level.theme;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // parallax hills
    ctx.fillStyle = th.hill;
    const off = cam.x * 0.3;
    for (let i = -1; i < 6; i++) {
      const hx = i * 280 - (off % 280);
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.ellipse(hx + 140, H - 120 + 90, 180, 130, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // theme decorations (mid layer)
    const dOff = cam.x * 0.55;
    for (let i = -1; i < 8; i++) {
      const dx = i * 200 - (dOff % 200) + 60;
      const dy = H - 150;
      drawDeco(th.deco, dx, dy);
    }
  }

  function drawDeco(type, x, y) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    if (type === 'tree') {
      ctx.fillStyle = '#7a4a2c'; ctx.fillRect(x - 4, y, 8, 40);
      ctx.fillStyle = '#3f9c4f';
      ctx.beginPath(); ctx.arc(x, y - 6, 22, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'cactus') {
      ctx.fillStyle = '#3fa05a';
      Sprites.roundRect(ctx, x - 6, y - 30, 12, 60, 6); ctx.fill();
      Sprites.roundRect(ctx, x - 22, y, 12, 24, 6); ctx.fill();
      Sprites.roundRect(ctx, x - 22, y - 6, 16, 12, 6); ctx.fill();
      Sprites.roundRect(ctx, x + 8, y - 12, 12, 22, 6); ctx.fill();
      Sprites.roundRect(ctx, x + 8, y - 18, 16, 12, 6); ctx.fill();
    } else if (type === 'crystal') {
      ctx.fillStyle = '#5fd4d0';
      ctx.beginPath(); ctx.moveTo(x, y - 40); ctx.lineTo(x + 12, y + 20); ctx.lineTo(x - 12, y + 20); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.moveTo(x + 16, y - 14); ctx.lineTo(x + 24, y + 20); ctx.lineTo(x + 8, y + 20); ctx.closePath(); ctx.fill();
    } else if (type === 'pine') {
      ctx.fillStyle = '#6aa6c0';
      ctx.beginPath(); ctx.moveTo(x, y - 44); ctx.lineTo(x + 20, y + 4); ctx.lineTo(x - 20, y + 4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x, y - 24); ctx.lineTo(x + 24, y + 30); ctx.lineTo(x - 24, y + 30); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawTiles() {
    const th = level.theme;
    const x0 = Math.max(0, Math.floor(cam.x / TILE));
    const x1 = Math.min(level.cols, Math.ceil((cam.x + W) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(cam.y / TILE));
    const y1 = Math.min(level.rows, Math.ceil((cam.y + H) / TILE) + 1);
    for (let cy = y0; cy < y1; cy++) {
      for (let cx = x0; cx < x1; cx++) {
        const t = level.grid[cy][cx];
        const px = Math.round(cx * TILE - cam.x), py = Math.round(cy * TILE - cam.y);
        if (t === 1) {
          ctx.fillStyle = th.ground;
          ctx.fillRect(px, py, TILE, TILE);
          // grassy/top cap if open above
          if (!solidAtRaw(cx, cy - 1)) {
            ctx.fillStyle = th.groundTop;
            ctx.fillRect(px, py, TILE, 7);
          }
          ctx.fillStyle = th.groundDark;
          ctx.fillRect(px, py + TILE - 4, TILE, 4);
          ctx.strokeStyle = 'rgba(0,0,0,0.08)';
          ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        } else if (t === 2) {
          ctx.fillStyle = th.plat;
          Sprites.roundRect(ctx, px, py, TILE, 12, 4); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(px + 3, py + 2, TILE - 6, 3);
          ctx.fillStyle = '#eef0ff';
          ctx.fillRect(px + TILE / 2 - 4, py + 11, 8, 5);
        } else if (t === 3) {
          Sprites.drawLock(ctx, px, py, TILE, false);
        }
      }
    }

    // spikes
    for (const s of level.spikes) {
      const px = s.x - cam.x, py = s.y - cam.y;
      if (px < -TILE || px > W) continue;
      ctx.fillStyle = th.spike;
      ctx.strokeStyle = '#1c1430'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      const n = 4;
      for (let i = 0; i < n; i++) {
        const sw = TILE / n;
        ctx.beginPath();
        ctx.moveTo(px + i * sw, py + TILE);
        ctx.lineTo(px + i * sw + sw / 2, py + TILE - 14);
        ctx.lineTo(px + i * sw + sw, py + TILE);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
  }
  function solidAtRaw(cx, cy) {
    if (cy < 0 || cy >= level.rows || cx < 0 || cx >= level.cols) return false;
    const t = level.grid[cy][cx];
    return t === 1 || t === 3;
  }

  function drawPlay() {
    drawBackground();

    ctx.save();
    drawTiles();

    // keys
    for (const k of level.keys) if (!k.got)
      Sprites.drawKey(ctx, k.x - cam.x, k.y - cam.y, k.w, k.h, level.t * 16);
    // kids
    for (const kid of level.kids) if (!kid.got)
      Sprites.drawKid(ctx, kid.x - cam.x, kid.y - cam.y, kid.w, kid.h, level.t * 16);
    // goal
    const allKids = level.kidsGot >= level.kidsTotal;
    ctx.globalAlpha = allKids ? 1 : 0.55;
    Sprites.drawGoal(ctx, level.goal.x - cam.x, level.goal.y - cam.y, level.goal.w, level.goal.h, level.t * 16, level.theme);
    if (!allKids) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#1c1430'; ctx.font = 'bold 11px Trebuchet MS'; ctx.textAlign = 'center';
      ctx.fillText('🔒', level.goal.x - cam.x + level.goal.w / 2, level.goal.y - cam.y + level.goal.h / 2);
    }
    ctx.globalAlpha = 1;

    // enemies
    for (const e of level.enemies) {
      if (!e.alive && e.dead > 24) continue;
      Sprites.drawEnemy(ctx, e.x - cam.x, e.y - cam.y, e.w, e.h, e.face, level.t * 16, !e.alive);
    }

    // particles
    for (const p of level.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x - cam.x, p.y - cam.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // player
    if (!player.dead || player.deadT < 30) {
      const st = {
        squash: player.squash > 0, stretch: player.stretch > 0,
        onGround: player.onGround, vx: player.vx, hurt: player.hurt > 0
      };
      ctx.save();
      if (player.dead) { ctx.globalAlpha = Math.max(0, 1 - player.deadT / 30); }
      Sprites.drawHero(ctx, Math.round(player.x - cam.x), Math.round(player.y - cam.y), player.w, player.h, player.face, level.t * 16, st);
      ctx.restore();
    }
    ctx.restore();

    drawHUD();
  }

  function drawHUD() {
    // top bar
    ctx.fillStyle = 'rgba(28,20,48,0.6)';
    Sprites.roundRect(ctx, 12, 12, 250, 38, 10); ctx.fill();

    // kids icon
    Sprites.drawKid(ctx, 22, 18, 22, 22, 0);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Trebuchet MS'; ctx.textAlign = 'left';
    ctx.fillText(`${level.kidsGot}/${level.kidsTotal}`, 46, 38);

    // keys
    Sprites.drawKey(ctx, 120, 16, 16, 26, 0);
    ctx.fillStyle = '#fff';
    ctx.fillText(`x${level.keysHeld}`, 140, 38);

    // deaths
    ctx.fillStyle = '#ffb3c2';
    ctx.fillText(`☠ ${level.deaths}`, 192, 38);

    // level name (top right)
    ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Trebuchet MS';
    ctx.fillText(`${levelIndex + 1}. ${level.data.name}`, W - 16, 26);
    ctx.font = '12px Trebuchet MS'; ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('M: mute   Esc: levels', W - 16, 44);

    // flash msg
    if (flashT > 0) {
      ctx.globalAlpha = Math.min(1, flashT / 30);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 22px Trebuchet MS'; ctx.textAlign = 'center';
      ctx.strokeStyle = '#1c1430'; ctx.lineWidth = 4;
      ctx.strokeText(flashMsg, W / 2, 70);
      ctx.fillText(flashMsg, W / 2, 70);
      ctx.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- menus
  function bgMenu() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#7ec9d6'); g.addColorStop(1, '#a6e0c9');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // floating veggies
    const t = performance.now() * 0.001;
    for (let i = 0; i < 8; i++) {
      const x = (i * 137 + Math.sin(t + i) * 30) % (W + 60) - 30;
      const y = 80 + ((i * 71) % (H - 160)) + Math.sin(t * 1.3 + i) * 14;
      Sprites.drawKid(ctx, x, y, 26, 26, t * 1000 + i * 400);
    }
  }

  let titleBtns = [];
  function drawTitle() {
    bgMenu();
    const t = performance.now() * 0.003;
    // hero big
    ctx.save();
    ctx.translate(W / 2, 175 + Math.sin(t) * 8);
    ctx.scale(3.4, 3.4);
    Sprites.drawHero(ctx, -11, -13, 22, 26, 1, performance.now(), { squash: false, stretch: false, onGround: false, vx: 0, hurt: false });
    ctx.restore();

    // title
    ctx.textAlign = 'center';
    ctx.font = 'bold 64px Trebuchet MS';
    ctx.lineWidth = 8; ctx.strokeStyle = '#1c1430'; ctx.fillStyle = '#ff5d7a';
    ctx.strokeText('RADISH RESCUE', W / 2, 320);
    ctx.fillText('RADISH RESCUE', W / 2, 320);
    ctx.font = 'bold 18px Trebuchet MS'; ctx.fillStyle = '#1c1430';
    ctx.fillText('Rescue all the kids — a Dadish-style platformer', W / 2, 352);

    titleBtns = [
      { label: unlocked > 1 ? 'CONTINUE' : 'PLAY', x: W / 2 - 110, y: 380, w: 220, h: 52, action: 'play' },
      { label: 'LEVEL SELECT', x: W / 2 - 110, y: 444, w: 220, h: 46, action: 'select' }
    ];
    titleBtns.forEach(drawButton);

    ctx.font = '13px Trebuchet MS'; ctx.fillStyle = '#1c1430';
    ctx.fillText('Arrows / WASD to move • Space / Up / J to jump • M to mute', W / 2, 520);
  }

  function drawButton(b) {
    ctx.fillStyle = '#ff5d7a';
    Sprites.roundRect(ctx, b.x, b.y, b.w, b.h, 12); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#1c1430'; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px Trebuchet MS'; ctx.textAlign = 'center';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 8);
  }

  let selectCells = [];
  function drawSelect() {
    bgMenu();
    ctx.textAlign = 'center';
    ctx.font = 'bold 40px Trebuchet MS'; ctx.lineWidth = 6;
    ctx.strokeStyle = '#1c1430'; ctx.fillStyle = '#fff';
    ctx.strokeText('SELECT A LEVEL', W / 2, 70); ctx.fillText('SELECT A LEVEL', W / 2, 70);

    selectCells = [];
    const cols = 4, cw = 180, chh = 110, gap = 22;
    const totalW = cols * cw + (cols - 1) * gap;
    const startX = (W - totalW) / 2, startY = 110;
    for (let i = 0; i < LEVELS.length; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      const x = startX + c * (cw + gap), y = startY + r * (chh + gap);
      const open = i < unlocked;
      selectCells.push({ x, y, w: cw, h: chh, i, open });

      ctx.fillStyle = open ? '#fff' : 'rgba(255,255,255,0.35)';
      Sprites.roundRect(ctx, x, y, cw, chh, 12); ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = '#1c1430'; ctx.stroke();

      // theme swatch
      const th = THEMES[LEVELS[i].theme];
      ctx.fillStyle = th.ground;
      Sprites.roundRect(ctx, x + 12, y + 12, cw - 24, 40, 8); ctx.fill();

      ctx.fillStyle = '#1c1430'; ctx.font = 'bold 22px Trebuchet MS';
      ctx.fillText(`${i + 1}`, x + cw / 2, y + 40);
      ctx.font = 'bold 14px Trebuchet MS';
      ctx.fillText(open ? LEVELS[i].name : '🔒 Locked', x + cw / 2, y + 78);
      if (open && bestDeaths[i] != null) {
        ctx.font = '12px Trebuchet MS'; ctx.fillStyle = '#a06';
        ctx.fillText(`best deaths: ${bestDeaths[i]}`, x + cw / 2, y + 96);
      }
    }
    // back button
    selectCells.push({ x: W / 2 - 80, y: H - 54, w: 160, h: 40, back: true });
    ctx.fillStyle = '#1c1430';
    Sprites.roundRect(ctx, W / 2 - 80, H - 54, 160, 40, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Trebuchet MS';
    ctx.fillText('◀ BACK', W / 2, H - 28);
  }

  let winBtns = [];
  function drawWin() {
    bgMenu();
    ctx.textAlign = 'center';
    ctx.font = 'bold 52px Trebuchet MS'; ctx.lineWidth = 7;
    ctx.strokeStyle = '#1c1430'; ctx.fillStyle = '#ffd84d';
    ctx.strokeText('LEVEL CLEAR!', W / 2, 180); ctx.fillText('LEVEL CLEAR!', W / 2, 180);

    ctx.font = 'bold 22px Trebuchet MS'; ctx.fillStyle = '#1c1430';
    ctx.fillText(`${LEVELS[levelIndex].name}`, W / 2, 225);
    ctx.fillText(`Kids rescued: ${level.kidsTotal}/${level.kidsTotal}   •   Deaths: ${level.deaths}`, W / 2, 258);

    winBtns = [
      { label: 'NEXT LEVEL ▶', x: W / 2 - 120, y: 300, w: 240, h: 52, action: 'next' },
      { label: 'REPLAY', x: W / 2 - 120, y: 364, w: 115, h: 44, action: 'replay' },
      { label: 'LEVELS', x: W / 2 + 5, y: 364, w: 115, h: 44, action: 'select' }
    ];
    winBtns.forEach(drawButton);
  }

  let completeBtns = [];
  function drawComplete() {
    bgMenu();
    ctx.textAlign = 'center';
    // party
    ctx.save();
    ctx.translate(W / 2, 150);
    ctx.scale(2.6, 2.6);
    Sprites.drawHero(ctx, -11, -13, 22, 26, 1, performance.now(), { squash: false, stretch: true, onGround: false, vx: 0, hurt: false });
    ctx.restore();

    ctx.font = 'bold 50px Trebuchet MS'; ctx.lineWidth = 7;
    ctx.strokeStyle = '#1c1430'; ctx.fillStyle = '#ff5d7a';
    ctx.strokeText('ALL KIDS RESCUED!', W / 2, 300); ctx.fillText('ALL KIDS RESCUED!', W / 2, 300);
    ctx.font = 'bold 20px Trebuchet MS'; ctx.fillStyle = '#1c1430';
    const totalDeaths = Object.values(bestDeaths).reduce((a, b) => a + b, 0);
    ctx.fillText(`You beat all ${LEVELS.length} levels! Total best deaths: ${totalDeaths}`, W / 2, 338);
    ctx.fillText('Thanks for playing 💛', W / 2, 366);

    completeBtns = [{ label: 'BACK TO TITLE', x: W / 2 - 120, y: 400, w: 240, h: 52, action: 'title' }];
    completeBtns.forEach(drawButton);
  }

  // ---------------------------------------------------------------- menu input
  function hit(b, mx, my) { return mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h; }

  function handleMenuClick(mx, my) {
    if (state === State.TITLE) {
      for (const b of titleBtns) if (hit(b, mx, my)) {
        Sound.select();
        if (b.action === 'play') { startGame(unlocked > 1 ? Math.min(unlocked, LEVELS.length) - 1 : 0); }
        else if (b.action === 'select') state = State.SELECT;
      }
    } else if (state === State.SELECT) {
      for (const cl of selectCells) {
        if (hit(cl, mx, my)) {
          if (cl.back) { Sound.select(); state = State.TITLE; return; }
          if (cl.open) { Sound.select(); startGame(cl.i); return; }
        }
      }
    } else if (state === State.WIN) {
      for (const b of winBtns) if (hit(b, mx, my)) {
        Sound.select();
        if (b.action === 'next') startGame(Math.min(levelIndex + 1, LEVELS.length - 1));
        else if (b.action === 'replay') startGame(levelIndex);
        else if (b.action === 'select') state = State.SELECT;
      }
    } else if (state === State.COMPLETE) {
      for (const b of completeBtns) if (hit(b, mx, my)) { Sound.select(); state = State.TITLE; }
    }
  }

  function handleMenuKey(code) {
    if (code === 'Escape') {
      if (state === State.PLAY) { state = State.SELECT; }
      else if (state === State.SELECT) state = State.TITLE;
    }
    if (code === 'KeyR' && state === State.PLAY) startGame(levelIndex);
    if ((code === 'Enter' || code === 'Space') && state === State.TITLE) startGame(unlocked > 1 ? Math.min(unlocked, LEVELS.length) - 1 : 0);
    if (code === 'Enter' && state === State.WIN) startGame(Math.min(levelIndex + 1, LEVELS.length - 1));
  }

  function startGame(i) { loadLevel(i); state = State.PLAY; }

  // ---------------------------------------------------------------- loop
  let last = 0, acc = 0;
  const STEP = 1000 / 60;
  function loop(ts) {
    const dt = Math.min(50, ts - last); last = ts; acc += dt;
    while (acc >= STEP) { if (state === State.PLAY) update(); acc -= STEP; }
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
