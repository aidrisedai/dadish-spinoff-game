/* Procedural sprite drawing — no image files. Everything is drawn with canvas
   paths so the cute "Dadish"-style look is generated at runtime and scales crisply. */
const Sprites = (() => {

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function outlinePath(ctx, color = '#1c1430', w = 3) {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke();
  }

  // ---- The hero: a little radish/tomato veggie ----
  // x,y = top-left of bounding box; w,h sizes; face = -1 left / 1 right.
  function drawHero(ctx, x, y, w, h, face, t, state) {
    const cx = x + w / 2;
    ctx.save();

    // squash & stretch from vertical speed / walking bob
    let sx = 1, sy = 1;
    if (state.squash) { sx = 1.18; sy = 0.82; }
    else if (state.stretch) { sx = 0.85; sy = 1.18; }
    const bob = state.onGround && Math.abs(state.vx) > 0.3 ? Math.sin(t * 0.018) * 1.5 : 0;

    ctx.translate(cx, y + h + bob);
    ctx.scale(sx, sy);
    ctx.translate(-cx, -(y + h));

    const bodyTop = y + h * 0.22;
    const bodyH = h * 0.78;
    const bodyW = w * 0.92;
    const bx = cx - bodyW / 2;

    // little leaf sprout on top
    ctx.fillStyle = '#5ec46b';
    ctx.beginPath();
    ctx.ellipse(cx - 4, bodyTop - 2, 5, 9, -0.5, 0, Math.PI * 2);
    ctx.ellipse(cx + 4, bodyTop - 2, 5, 9, 0.5, 0, Math.PI * 2);
    ctx.fill();
    outlinePath(ctx, '#1c1430', 2.5);

    // body (rounded radish)
    ctx.fillStyle = state.hurt ? '#ff9bb0' : '#ff5d7a';
    ctx.beginPath();
    ctx.moveTo(cx, bodyTop);
    ctx.bezierCurveTo(bx - 4, bodyTop + bodyH * 0.2, bx, bodyTop + bodyH, cx, bodyTop + bodyH);
    ctx.bezierCurveTo(bx + bodyW, bodyTop + bodyH, bx + bodyW + 4, bodyTop + bodyH * 0.2, cx, bodyTop);
    ctx.closePath();
    ctx.fill();
    outlinePath(ctx, '#1c1430', 3);

    // cheeks
    ctx.fillStyle = '#ff8fa6';
    ctx.beginPath();
    ctx.arc(cx - bodyW * 0.26, bodyTop + bodyH * 0.5, 4, 0, Math.PI * 2);
    ctx.arc(cx + bodyW * 0.26, bodyTop + bodyH * 0.5, 4, 0, Math.PI * 2);
    ctx.fill();

    // eyes
    const eyeY = bodyTop + bodyH * 0.36;
    const eo = face * 1.5;
    ctx.fillStyle = '#1c1430';
    ctx.beginPath();
    ctx.arc(cx - 6 + eo, eyeY, 3.4, 0, Math.PI * 2);
    ctx.arc(cx + 6 + eo, eyeY, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - 6 + eo + 1, eyeY - 1, 1.1, 0, Math.PI * 2);
    ctx.arc(cx + 6 + eo + 1, eyeY - 1, 1.1, 0, Math.PI * 2);
    ctx.fill();

    // mouth
    ctx.strokeStyle = '#1c1430';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (state.hurt) { ctx.arc(cx + eo, eyeY + 11, 3, Math.PI, 0); }
    else { ctx.arc(cx + eo, eyeY + 7, 3.5, 0.15 * Math.PI, 0.85 * Math.PI); }
    ctx.stroke();

    // little feet
    ctx.fillStyle = '#e84c69';
    const footY = bodyTop + bodyH - 1;
    const step = state.onGround && Math.abs(state.vx) > 0.3 ? Math.sin(t * 0.018) * 3 : 0;
    ctx.beginPath();
    ctx.ellipse(cx - 6, footY + Math.max(0, step), 4, 2.6, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 6, footY + Math.max(0, -step), 4, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ---- Baby veggies to rescue (collectibles) ----
  function drawKid(ctx, x, y, w, h, t) {
    const cx = x + w / 2;
    const bob = Math.sin(t * 0.004 + x) * 3;
    const cy = y + h / 2 + bob;
    ctx.save();
    // sparkle ring
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.62, 0, Math.PI * 2);
    ctx.setLineDash([4, 5]);
    ctx.lineDashOffset = -t * 0.02;
    ctx.stroke();
    ctx.setLineDash([]);

    // leaf
    ctx.fillStyle = '#5ec46b';
    ctx.beginPath();
    ctx.ellipse(cx, cy - h * 0.34, 3, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    outlinePath(ctx, '#1c1430', 2);

    // body
    ctx.fillStyle = '#ff5d7a';
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.32, 0, Math.PI * 2);
    ctx.fill();
    outlinePath(ctx, '#1c1430', 2.5);

    // eyes
    ctx.fillStyle = '#1c1430';
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 1, 2, 0, Math.PI * 2);
    ctx.arc(cx + 3, cy - 1, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---- Walking enemy: a grumpy blob (can be stomped) ----
  function drawEnemy(ctx, x, y, w, h, face, t, dead) {
    const cx = x + w / 2;
    ctx.save();
    if (dead) {
      // squashed pancake
      ctx.fillStyle = '#7a5bd8';
      roundRect(ctx, x + 2, y + h - 7, w - 4, 6, 3);
      ctx.fill();
      outlinePath(ctx, '#1c1430', 2.5);
      ctx.restore();
      return;
    }
    const bob = Math.sin(t * 0.012) * 1.5;
    // body
    ctx.fillStyle = '#8b66e6';
    roundRect(ctx, x + 1, y + 2 + bob, w - 2, h - 2 - bob, 9);
    ctx.fill();
    outlinePath(ctx, '#1c1430', 3);

    // angry eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - 5, y + h * 0.42 + bob, 4, 0, Math.PI * 2);
    ctx.arc(cx + 5, y + h * 0.42 + bob, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c1430';
    ctx.beginPath();
    ctx.arc(cx - 5 + face * 1.5, y + h * 0.42 + bob, 2, 0, Math.PI * 2);
    ctx.arc(cx + 5 + face * 1.5, y + h * 0.42 + bob, 2, 0, Math.PI * 2);
    ctx.fill();
    // brow
    ctx.strokeStyle = '#1c1430';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 9, y + h * 0.28 + bob); ctx.lineTo(cx - 1, y + h * 0.36 + bob);
    ctx.moveTo(cx + 9, y + h * 0.28 + bob); ctx.lineTo(cx + 1, y + h * 0.36 + bob);
    ctx.stroke();
    // mouth (teeth)
    ctx.fillStyle = '#1c1430';
    roundRect(ctx, cx - 6, y + h * 0.62 + bob, 12, 5, 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 3; i++) { ctx.fillRect(cx - 5 + i * 4, y + h * 0.62 + bob, 2, 2); }

    // feet
    ctx.fillStyle = '#6f4fc0';
    const step = Math.sin(t * 0.012) * 2;
    ctx.beginPath();
    ctx.ellipse(cx - 6, y + h - 1, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 6, y + h - 1 + step, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---- Key ----
  function drawKey(ctx, x, y, w, h, t) {
    const cx = x + w / 2;
    const bob = Math.sin(t * 0.005 + x) * 2;
    ctx.save();
    ctx.translate(0, bob);
    ctx.strokeStyle = '#f0c020';
    ctx.fillStyle = '#ffd84d';
    ctx.lineWidth = 3;
    // ring
    ctx.beginPath();
    ctx.arc(cx, y + h * 0.32, w * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1c1430';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // shaft
    ctx.fillStyle = '#ffd84d';
    roundRect(ctx, cx - 2.5, y + h * 0.42, 5, h * 0.42, 2);
    ctx.fill();
    ctx.stroke();
    // teeth
    ctx.fillRect(cx + 1, y + h * 0.7, 5, 3);
    ctx.fillRect(cx + 1, y + h * 0.82, 4, 3);
    ctx.strokeRect(cx + 1, y + h * 0.7, 5, 3);
    ctx.restore();
  }

  // ---- Locked block ----
  function drawLock(ctx, x, y, s, opened) {
    ctx.save();
    ctx.fillStyle = opened ? '#5a4a7a' : '#7a52b8';
    roundRect(ctx, x + 1, y + 1, s - 2, s - 2, 5);
    ctx.fill();
    outlinePath(ctx, '#1c1430', 3);
    // keyhole
    ctx.fillStyle = '#ffd84d';
    const cx = x + s / 2, cy = y + s / 2;
    ctx.beginPath();
    ctx.arc(cx, cy - 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy + 6); ctx.lineTo(cx + 3, cy + 6); ctx.lineTo(cx + 2, cy - 1); ctx.lineTo(cx - 2, cy - 1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ---- Goal: exit door ----
  function drawGoal(ctx, x, y, w, h, t, theme) {
    ctx.save();
    // glow
    const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 4, x + w / 2, y + h / 2, w);
    g.addColorStop(0, 'rgba(255,236,150,0.5)');
    g.addColorStop(1, 'rgba(255,236,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - w * 0.4, y - h * 0.2, w * 1.8, h * 1.4);

    // door frame
    ctx.fillStyle = '#8a5a3c';
    roundRect(ctx, x, y, w, h, 6);
    ctx.fill();
    outlinePath(ctx, '#1c1430', 3);
    // door
    ctx.fillStyle = '#c98a55';
    roundRect(ctx, x + 4, y + 5, w - 8, h - 5, 4);
    ctx.fill();
    outlinePath(ctx, '#1c1430', 2);
    // handle
    ctx.fillStyle = '#ffd84d';
    ctx.beginPath();
    ctx.arc(x + w - 9, y + h * 0.55, 2.6, 0, Math.PI * 2);
    ctx.fill();
    // flag on top
    ctx.fillStyle = '#ff5d7a';
    const fw = 4 + Math.sin(t * 0.006) * 1.5;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y - 14);
    ctx.lineTo(x + w / 2 + 12, y - 11 + fw);
    ctx.lineTo(x + w / 2, y - 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1c1430';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y - 16); ctx.lineTo(x + w / 2, y);
    ctx.stroke();
    ctx.restore();
  }

  return { drawHero, drawKid, drawEnemy, drawKey, drawLock, drawGoal, roundRect };
})();
