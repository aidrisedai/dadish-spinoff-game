/* ============================================================================
   Art engine — crisp, clean 2D pixel art.
   - Characters are authored as pixel maps and get an automatic heavy navy
     outline (modern-cartoon-in-pixels look).
   - Tiles are built procedurally as chunky, layered environmental pieces:
     dark outer border + bright top edge + material face + seams/bolts/cracks
     + darker shading underneath. One cache per theme.
   Everything is rendered at base resolution (1 art-pixel = 1 unit) and the game
   upscales with nearest-neighbour for clean, crisp pixels.
   ========================================================================== */
const Art = (() => {
  const NAVY = '#15193a';     // near-black navy outline used everywhere

  // ---- build a sprite canvas from a pixel map + palette, auto-outlined ----
  function make(rows, pal, opt = {}) {
    const outline = opt.outline === null ? null : (opt.outline || NAVY);
    const cols = Math.max(...rows.map(r => r.length));
    const h = rows.length;
    const grid = [];
    for (let y = 0; y < h; y++) {
      grid[y] = [];
      for (let x = 0; x < cols; x++) {
        const ch = rows[y][x] || '.';
        grid[y][x] = (ch === '.' || ch === ' ') ? null : (pal[ch] || null);
      }
    }
    const c = document.createElement('canvas');
    c.width = cols; c.height = h;
    const g = c.getContext('2d');
    if (outline) {
      g.fillStyle = outline;
      for (let y = 0; y < h; y++) for (let x = 0; x < cols; x++) {
        if (grid[y][x]) continue;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy, nx = x + dx;
            if (ny < 0 || nx < 0 || ny >= h || nx >= cols) continue;
            if (grid[ny][nx]) { near = true; break; }
          }
        if (near) g.fillRect(x, y, 1, 1);
      }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < cols; x++)
      if (grid[y][x]) { g.fillStyle = grid[y][x]; g.fillRect(x, y, 1, 1); }
    return c;
  }

  function blank(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    return c;
  }
  const px = (g, x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };

  // ============================ HERO (carrot/radish kid) ====================
  const HP = { o: '#ff6488', d: '#e0466b', c: '#ffb3c6', l: '#5ec46b', L: '#3f9c4f', e: '#15193a', w: '#ffffff' };
  // 12 wide x 14 tall, 1px margins so the outline fits.
  const HERO_IDLE = [
    '....ll......',
    '...lLll.....',
    '...llLl.....',
    '....ll......',
    '...oooooo...',
    '..oooooooo..',
    '.oooooooooo.',
    '.owesoosewo.',  // eyes (e) with white (w) shine, s=dark body fill spacer
    '.ooeooooeoo.',
    '.cooooooooc.',
    '.oooeeeeoo o',
    '..oooooooo..',
    '..dd..dd....',
    '............'
  ].map(r => r.replace(/s/g, 'o'));
  const HERO_WALK = [
    '....ll......',
    '...lLll.....',
    '...llLl.....',
    '....ll......',
    '...oooooo...',
    '..oooooooo..',
    '.oooooooooo.',
    '.owesoosewo.',
    '.ooeooooeoo.',
    '.cooooooooc.',
    '.oooeeeeooo.',
    '..oooooooo..',
    '...dd..dd...',
    '............'
  ].map(r => r.replace(/s/g, 'o'));
  const HERO_JUMP = [
    '....ll......',
    '...lLll.....',
    '..llLll.....',
    '....ll......',
    '...oooooo...',
    '..oooooooo..',
    '.oooooooooo.',
    '.owesoosewo.',
    '.ooeooooeoo.',
    '.coooooooooc',
    '.ooooeeoooo.',
    '..oooooooo..',
    '...d.dd.d...',
    '....dddd....'
  ].map(r => r.replace(/s/g, 'o'));
  const HERO_HURT = [
    '....ll......',
    '...lLll.....',
    '..llLll.....',
    '....ll......',
    '...oooooo...',
    '..oooooooo..',
    '.oooooooooo.',
    '.oeo oo oeo.'.replace(/ /g, 'o'),
    '.ooeooooeoo.'.replace(/e/g, 'o'),
    '.cooeeeeooc.',
    '.ooeooooeoo.'.replace(/e/g, 'o'),
    '..oooooooo..',
    '..d.d..d.d..',
    '............'
  ];

  // ============================ ENEMIES (food characters!) ==================
  // Dadish-style: each enemy is a little food with a face. One per world.
  const EYE = { e: '#15193a', w: '#ffffff', m: '#15193a' };
  const food = (rows, pal) => make(rows, Object.assign({}, EYE, pal));

  const FOODS = {
    // green slime blob
    slime: food([
      '...gggggg...',
      '..gggggggg..',
      '.gggggggggg.',
      '.gwwggggwwg.',
      '.gweggggweg.',
      '.gggggggggg.',
      '.ggmmmmmmgg.',
      '.gggggggggg.',
      '..gggggggg..',
      '...dd..dd...'
    ], { g: '#6fcf57', d: '#3f9c4f' }),
    // burger
    burger: food([
      '..BBBBBBBB..',
      '.BBSBBBSBBB.',
      '.BBBBBBBBBB.',
      '.LLLLLLLLLL.',
      '.PPPPPPPPPP.',
      '.PwwPPPwwPP.',
      '.PwePPPwePP.',
      '.PPPmmmmPPP.',
      '.BBBBBBBBBB.',
      '..BBBBBBBB..',
      '...ff..ff...'
    ], { B: '#e8b563', S: '#fff3d0', L: '#6fcf57', P: '#a85a32', f: '#cf9a4a' }),
    // hotdog
    hotdog: food([
      '.RRRRRRRRRR.',
      'RssssssssssR',
      'RsMsMsMsMssR',
      'RswwssswwssR',
      'RswesssweSsR'.replace('S', 'w'),
      'RssmmmmmmssR',
      'RssssssssssR',
      '.RRRRRRRRRR.',
      '...ff..ff...'
    ], { R: '#e8b563', s: '#c0563a', M: '#ffd23f', f: '#cf9a4a' }),
    // cookie
    cookie: food([
      '..kkkkkkk..',
      '.kkkkkkkkk.',
      '.kDkkkkDkk.',
      '.kwwkkwwkk.',
      '.kwekkwekk.',
      '.kkkkkkkkk.',
      '.kDkmmmmDk.',
      '.kkkkkkkkk.',
      '..kkkkkkk..',
      '...dd.dd...'
    ], { k: '#d49a52', D: '#6b4326', d: '#8a5a30' })
  };
  function foodFor(themeKey) {
    return ({ forest: FOODS.slime, lab: FOODS.cookie, ice: FOODS.burger, desert: FOODS.hotdog })[themeKey] || FOODS.slime;
  }

  // ============================ small collectible kid =======================
  function kidMap(b) {
    const p = { o: b, d: shade(b, -0.2), l: '#5ec46b', L: '#3f9c4f', e: '#15193a' };
    return make([
      '..ll..',
      '.lLl..',
      '.oooo.',
      'oeooeo',
      'oooooo',
      '.dddd.'
    ], p);
  }

  // ============================ key =========================================
  const KEY = make([
    '.kkk..',
    '.k.k..',
    '.k.k..',
    '.kkk..',
    '..k...',
    '..kt..',
    '..k...',
    '..kt..',
    '..k...'
  ], { k: '#ffd23f', t: '#caa017' });

  // ---- colour helper ----
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = amt < 0 ? (1 + amt) : 1, add = amt > 0 ? amt * 255 : 0;
    r = Math.max(0, Math.min(255, r * f + add));
    g = Math.max(0, Math.min(255, g * f + add));
    b = Math.max(0, Math.min(255, b * f + add));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b | 0).toString(16).slice(1);
  }

  // ============================ THEMES ======================================
  // tile: style + colours.  bg: layered background descriptor.
  const THEMES = {
    forest: {
      name: 'Forest', style: 'dirt',
      sky: ['#5fc6ec', '#a9e6f2'],
      face: '#c98a4e', top: '#7ed47e', topDark: '#5ec46b', shade: '#8f5e30', seam: '#a06a38',
      plat: '#caa05e', platTop: '#e6c98a',
      spike: '#ffffff', enemy: ['#6fcf57', '#3f9c4f'], crate: '#b9803f',
      bg: 'forest'
    },
    lab: {
      name: 'Space Lab', style: 'metal',
      sky: ['#1b1640', '#2a1f55'],
      face: '#5b3f8c', top: '#9a72d6', topDark: '#7a55b8', shade: '#3a2660', seam: '#2c1c4a',
      plat: '#f0913a', platTop: '#ffc27a',
      spike: '#f3f0ff', enemy: ['#ff6488', '#ff8d4a'], crate: '#6b54a0',
      bg: 'lab'
    },
    ice: {
      name: 'Frozen Lab', style: 'ice',
      sky: ['#22335c', '#34507e'],
      face: '#cfe0ee', top: '#ffffff', topDark: '#bcd4e6', shade: '#9fb6cc', seam: '#a9c2d6',
      plat: '#bcd6e8', platTop: '#ffffff',
      spike: '#ffffff', enemy: ['#e8b563', '#cf9a4a'], crate: '#7a52b8',
      bg: 'ice'
    },
    desert: {
      name: 'Desert', style: 'dirt',
      sky: ['#6fc8ee', '#cdeefb'],
      face: '#e6c45a', top: '#ffe49a', topDark: '#f0cf6e', shade: '#b9892f', seam: '#caa040',
      plat: '#f0913a', platTop: '#ffc27a',
      spike: '#ffffff', enemy: ['#c0563a', '#a8401f'], crate: '#c98a4e',
      bg: 'desert'
    }
  };

  // ============================ TILE BUILDERS ===============================
  // Build a chunky 16x16 tile for a theme. exposed=true gives the bright top.
  function buildTile(th, exposed) {
    const c = blank(16, 16), g = c.getContext('2d');
    const { face, shade, seam, style } = th;
    px(g, 0, 0, 16, 16, face);

    if (style === 'brick') {
      // mortar grid, offset rows
      px(g, 0, 0, 16, 16, face);
      g.fillStyle = seam;
      for (let y = 0; y < 16; y += 5) g.fillRect(0, y, 16, 1);
      for (let y = 0; y < 16; y += 5) {
        const off = ((y / 5) | 0) % 2 ? 8 : 0;
        for (let x = off; x < 16; x += 8) g.fillRect(x, y, 1, 5);
      }
      px(g, 0, 0, 1, 16, shade); px(g, 15, 0, 1, 16, shade);
    } else if (style === 'metal') {
      px(g, 15, 0, 1, 16, seam); px(g, 0, 15, 16, 1, seam);
      px(g, 0, 0, 1, 16, shade); px(g, 0, 14, 16, 2, shade);
      // panel screws
      g.fillStyle = shade;
      [[3, 4], [12, 4], [3, 12], [12, 12]].forEach(([x, y]) => g.fillRect(x, y, 2, 2));
      g.fillStyle = th.topDark;
      [[3, 4], [12, 4], [3, 12], [12, 12]].forEach(([x, y]) => g.fillRect(x, y, 1, 1));
    } else if (style === 'ice') {
      px(g, 0, 14, 16, 2, shade); px(g, 15, 0, 1, 16, seam);
      // cracks
      g.fillStyle = seam;
      g.fillRect(5, 3, 1, 4); g.fillRect(6, 7, 3, 1); g.fillRect(11, 9, 1, 4);
      g.fillStyle = '#ffffff';
      g.fillRect(3, 10, 3, 1); g.fillRect(10, 4, 2, 1);
    } else { // dirt
      px(g, 0, 13, 16, 3, shade); px(g, 15, 0, 1, 13, seam);
      g.fillStyle = shade;
      g.fillRect(4, 4, 2, 2); g.fillRect(10, 7, 2, 2); g.fillRect(6, 10, 2, 2);
    }

    if (exposed) {
      // bright top edge + navy cap (the "grassy/lit top")
      px(g, 0, 0, 16, 1, NAVY);
      px(g, 0, 1, 16, 3, th.top);
      px(g, 0, 4, 16, 1, th.topDark);
      if (style === 'dirt') { // little grass dangles
        g.fillStyle = th.top;
        g.fillRect(2, 4, 1, 2); g.fillRect(7, 4, 1, 2); g.fillRect(12, 4, 1, 2);
      }
    }
    return c;
  }

  function buildOneway(th) {
    const c = blank(16, 8), g = c.getContext('2d');
    px(g, 0, 0, 16, 8, th.plat);
    px(g, 0, 0, 16, 1, NAVY);
    px(g, 0, 1, 16, 2, th.platTop);
    px(g, 0, 7, 16, 1, shade(th.plat, -0.35));
    px(g, 0, 0, 1, 8, shade(th.plat, -0.25));
    px(g, 15, 0, 1, 8, shade(th.plat, -0.25));
    // support nubs underneath
    g.fillStyle = shade(th.plat, -0.3);
    g.fillRect(3, 6, 2, 2); g.fillRect(11, 6, 2, 2);
    return c;
  }

  function buildCrate(th) {
    const c = blank(16, 16), g = c.getContext('2d');
    const base = th.crate, lite = shade(base, 0.25), dark = shade(base, -0.3);
    px(g, 0, 0, 16, 16, base);
    px(g, 0, 0, 16, 1, NAVY); px(g, 0, 15, 16, 1, NAVY);
    px(g, 0, 0, 1, 16, NAVY); px(g, 15, 0, 1, 16, NAVY);
    px(g, 1, 1, 14, 2, lite);
    px(g, 1, 13, 14, 2, dark);
    // diagonal brace
    g.fillStyle = dark;
    for (let i = 1; i < 15; i++) { g.fillRect(i, i, 1, 1); g.fillRect(15 - i, i, 1, 1); }
    g.fillStyle = lite;
    g.fillRect(7, 7, 2, 2);
    return c;
  }

  function buildLock() {
    const c = blank(16, 16), g = c.getContext('2d');
    const body = '#7a52c0';
    px(g, 0, 0, 16, 16, body);
    px(g, 0, 0, 16, 1, NAVY); px(g, 0, 15, 16, 1, NAVY);
    px(g, 0, 0, 1, 16, NAVY); px(g, 15, 0, 1, 16, NAVY);
    px(g, 1, 1, 14, 2, '#9a72e0');
    px(g, 1, 13, 14, 2, '#5a3a96');
    // corner bolts
    g.fillStyle = '#4a2f80';
    [[2, 2], [12, 2], [2, 12], [12, 12]].forEach(([x, y]) => g.fillRect(x, y, 2, 2));
    // bright yellow KEY icon on the face (Dadish-style locked box)
    const key = '#ffd23f', sh = '#caa017';
    px(g, 5, 4, 4, 4, key);            // ring
    px(g, 6, 5, 2, 2, body);           // ring hole
    px(g, 7, 7, 2, 5, key);            // shaft
    px(g, 9, 9, 2, 2, key);            // teeth
    px(g, 9, 11, 1, 1, key);
    g.fillStyle = sh; g.fillRect(5, 7, 1, 1); g.fillRect(7, 11, 2, 1);
    return c;
  }

  function buildSpike(th) {
    const c = blank(16, 16), g = c.getContext('2d');
    const col = th.spike, sd = shade(col, -0.28);
    // two clean pointy triangles per tile
    for (let i = 0; i < 2; i++) {
      const cx = i * 8 + 4;
      for (let y = 2; y <= 15; y++) {
        const half = Math.max(1, Math.round(((y - 2) / 13) * 3.2));
        g.fillStyle = col; g.fillRect(cx - half, y, half * 2, 1);
        g.fillStyle = sd; g.fillRect(cx, y, half, 1);                 // right-side shading
        g.fillStyle = NAVY;                                           // outline edges
        g.fillRect(cx - half - 1, y, 1, 1); g.fillRect(cx + half, y, 1, 1);
      }
      g.fillStyle = NAVY; g.fillRect(cx - 1, 1, 2, 1);                // tip cap
      g.fillStyle = '#ffffff'; g.fillRect(cx - 1, 4, 1, 6);          // highlight
    }
    px(g, 0, 15, 16, 1, NAVY);
    return c;
  }

  function buildSpring(th) {
    const up = blank(16, 16), down = blank(16, 16);
    drawSpring(up.getContext('2d'), false);
    drawSpring(down.getContext('2d'), true);
    return { up, down };
  }
  function drawSpring(g, compressed) {
    const padY = compressed ? 9 : 4;
    // base
    px(g, 1, 13, 14, 3, '#3a3550');
    px(g, 1, 13, 14, 1, '#5a5478');
    px(g, 0, 13, 1, 3, NAVY); px(g, 15, 13, 1, 3, NAVY);
    // coil
    g.fillStyle = '#8a86a8';
    for (let y = padY + 3; y < 13; y += 2) g.fillRect(4, y, 8, 1);
    // pink pad
    px(g, 2, padY, 12, 3, '#ff3d86');
    px(g, 2, padY, 12, 1, '#ff7db0');
    px(g, 1, padY, 1, 3, NAVY); px(g, 14, padY, 1, 3, NAVY);
    px(g, 2, padY - 1, 12, 1, NAVY);
  }

  function buildDoor(th) {
    const c = blank(18, 30), g = c.getContext('2d');
    // frame
    px(g, 1, 2, 16, 28, '#3a2a1a');
    px(g, 0, 1, 18, 1, NAVY); px(g, 0, 1, 1, 29, NAVY); px(g, 17, 1, 1, 29, NAVY);
    // door
    px(g, 3, 4, 12, 26, '#caa05e');
    px(g, 3, 4, 12, 2, '#e6c98a');
    px(g, 3, 4, 2, 26, '#b98a48');
    // planks
    g.fillStyle = '#a87a3c';
    g.fillRect(8, 5, 1, 24);
    g.fillRect(4, 16, 10, 1);
    // arch sign
    px(g, 5, 6, 8, 5, '#ff6488');
    px(g, 5, 6, 8, 1, '#ff9bb4');
    g.fillStyle = '#15193a';
    g.fillRect(7, 8, 1, 1); g.fillRect(10, 8, 1, 1); // little eyes on sign
    // handle
    px(g, 12, 18, 2, 2, '#ffd23f');
    return c;
  }

  // ============================ caches ======================================
  const tileCache = {};
  function themeCache(key) {
    if (tileCache[key]) return tileCache[key];
    const th = THEMES[key];
    const cache = {
      top: buildTile(th, true),
      mid: buildTile(th, false),
      oneway: buildOneway(th),
      crate: buildCrate(th),
      lock: buildLock(),
      spike: buildSpike(th),
      spring: buildSpring(th),
      door: buildDoor(th)
    };
    tileCache[key] = cache;
    return cache;
  }

  // saw drawn procedurally each frame (it spins)
  function drawSaw(g, cx, cy, r, rot) {
    g.save();
    g.translate(cx, cy);
    g.rotate(rot);
    // teeth
    g.fillStyle = '#cfd6e0';
    const teeth = 8;
    for (let i = 0; i < teeth; i++) {
      g.save(); g.rotate((i / teeth) * Math.PI * 2);
      g.fillStyle = '#aeb6c4';
      g.fillRect(-2, -r - 3, 4, 5);
      g.restore();
    }
    g.fillStyle = '#cfd6e0';
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    g.lineWidth = 2; g.strokeStyle = NAVY; g.stroke();
    g.fillStyle = '#8a93a6';
    g.beginPath(); g.arc(0, 0, r * 0.45, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5a6072';
    for (let i = 0; i < 4; i++) {
      g.save(); g.rotate((i / 4) * Math.PI * 2);
      g.fillRect(-1, -r * 0.4, 2, 4); g.restore();
    }
    g.fillStyle = NAVY;
    g.beginPath(); g.arc(0, 0, 2, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  // ============================ prebuilt sprites ============================
  const S = {
    heroIdle: make(HERO_IDLE, HP),
    heroWalk: make(HERO_WALK, HP),
    heroJump: make(HERO_JUMP, HP),
    heroHurt: make(HERO_HURT, HP),
    key: KEY,
    kid: {}
  };
  function kid(col) { return S.kid[col] || (S.kid[col] = kidMap(col)); }

  return {
    NAVY, THEMES, make, shade,
    sprites: S, foodFor, kid,
    themeCache, drawSaw
  };
})();
