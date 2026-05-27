/*
Plum BG — Canvas 2D 折枝梅花背景
右下角延伸的梅枝，XHS 红五瓣花，飘落花瓣动画。
Config: window.PlumBg = { ... } before script loads.
*/
(function () {
  'use strict';

  var cfg = window.PlumBg || {};
  var BLOSSOM    = cfg.BLOSSOM    || '#FE2C55';
  var BLOSSOM_LT = cfg.BLOSSOM_LT || '#FF8FA3';
  var BLOSSOM_DK = cfg.BLOSSOM_DK || '#D41E44';
  var BRANCH_CLR = cfg.BRANCH     || '#2C1810';
  var STAMEN_CLR = cfg.STAMEN     || '#DAA520';
  var MAX_FALLING = cfg.MAX_FALLING || 20;

  // ── Canvas ──
  var canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;';
  document.body.insertBefore(canvas, document.body.firstChild);

  var ctx = canvas.getContext('2d');
  var dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  function W() { return canvas.clientWidth; }
  function H() { return canvas.clientHeight; }

  // ── Drawing helpers ──

  function drawCurveBranch(x1, y1, x2, y2, thick, curveOff) {
    var cx = (x1 + x2) / 2 + (curveOff || 0);
    var cy = (y1 + y2) / 2 + Math.abs(curveOff || 0) * 0.3;

    // Soft misty halo
    ctx.save();
    ctx.shadowBlur = thick * 4;
    ctx.shadowColor = 'rgba(44,24,16,0.15)';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cx, cy, x2, y2);
    ctx.strokeStyle = 'rgba(44,24,16,0.05)';
    ctx.lineWidth = thick + 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();

    // Main stroke — very faint
    ctx.save();
    ctx.shadowBlur = thick * 2;
    ctx.shadowColor = 'rgba(44,24,16,0.04)';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cx, cy, x2, y2);
    ctx.strokeStyle = 'rgba(44,24,16,0.08)';
    ctx.lineWidth = thick;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  function drawFlower(x, y, size, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);

    // Soft glow behind entire flower
    ctx.shadowBlur = size * 3;
    ctx.shadowColor = 'rgba(254,44,85,0.06)';

    // 5 petals — radial gradient, very soft
    for (var i = 0; i < 5; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI * 2 / 5);
      var grad = ctx.createRadialGradient(0, -size * 0.42, 0, 0, -size * 0.42, size * 0.5);
      grad.addColorStop(0, 'rgba(254,44,85,0.10)');
      grad.addColorStop(0.5, 'rgba(254,100,130,0.04)');
      grad.addColorStop(1, 'rgba(254,44,85,0)');
      ctx.beginPath();
      ctx.ellipse(0, -size * 0.42, size * 0.35, size * 0.52, 0, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }

    // Faint center glow
    ctx.shadowBlur = 0;
    var cg = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.2);
    cg.addColorStop(0, 'rgba(218,165,32,0.06)');
    cg.addColorStop(1, 'rgba(218,165,32,0)');
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = cg;
    ctx.fill();

    ctx.restore();
  }

  function drawBud(x, y, size, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);
    ctx.shadowBlur = size * 3;
    ctx.shadowColor = 'rgba(254,44,85,0.08)';
    var bg = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.7);
    bg.addColorStop(0, 'rgba(212,30,68,0.08)');
    bg.addColorStop(1, 'rgba(212,30,68,0)');
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.35, size * 0.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.restore();
  }

  // ── Scene data (percentage-based, scales to screen) ──

  // branches: [x1%, y1%, x2%, y2%, thickness, curveOffset]
  var branchDefs = [
    [0.90, 1.0,  0.78, 0.58,  4,  -20],
    [0.78, 0.58, 0.65, 0.34,  2.5, -12],
    [0.65, 0.34, 0.54, 0.16,  1.5, 15],
    [0.78, 0.58, 0.88, 0.36,  2,   28],
    [0.88, 0.36, 0.93, 0.20,  1,   12],
    [0.65, 0.34, 0.50, 0.22,  1.5, -22],
    [0.50, 0.22, 0.38, 0.10,  0.8, 8],
    [0.54, 0.16, 0.43, 0.06,  0.8, -10],
    [0.88, 0.36, 0.96, 0.26,  0.8, 18],
    [0.50, 0.22, 0.44, 0.28,  0.6, 12],
  ];

  // flowers: [x%, y%, size, rotation]
  var flowerDefs = [
    [0.73, 0.54, 14, 0.3],
    [0.68, 0.40, 12, -0.25],
    [0.60, 0.30, 11, 0.55],
    [0.50, 0.18, 9,  -0.15],
    [0.40, 0.12, 8,  0.45],
    [0.84, 0.33, 13, 0.65],
    [0.91, 0.22, 9,  -0.35],
    [0.46, 0.15, 7,  0.2],
    [0.36, 0.08, 7,  -0.5],
    [0.56, 0.12, 8,  0.15],
    [0.95, 0.16, 6,  0.3],
    [0.47, 0.25, 7, -0.4],
  ];

  // buds: [x%, y%, size, angle]
  var budDefs = [
    [0.44, 0.09, 5, -0.3],
    [0.33, 0.06, 4,  0.5],
    [0.97, 0.10, 4, -0.2],
    [0.42, 0.20, 4,  0.4],
    [0.58, 0.26, 4, -0.6],
    [0.96, 0.24, 3,  0.3],
  ];

  // ── Draw static scene ──

  function drawScene() {
    ctx.clearRect(0, 0, W(), H());
    var w = W(), h = H();

    // Branches
    branchDefs.forEach(function (b) {
      drawCurveBranch(b[0] * w, b[1] * h, b[2] * w, b[3] * h, b[4], b[5]);
    });

    // Flowers
    flowerDefs.forEach(function (f) {
      drawFlower(f[0] * w, f[1] * h, f[2], f[3]);
    });

    // Buds
    budDefs.forEach(function (b) {
      drawBud(b[0] * w, b[1] * h, b[2], b[3]);
    });
  }

  // ── Falling petals ──

  var petals = [];
  var petalIdx = 0;

  function spawnPetal() {
    // Spawn near a random flower
    var src = flowerDefs[Math.floor(Math.random() * flowerDefs.length)];
    petals.push({
      x: src[0] * W() + (Math.random() - 0.5) * 30,
      y: src[1] * H(),
      size: 3 + Math.random() * 5,
      rot: Math.random() * Math.PI * 2,
      rotSpd: (Math.random() - 0.5) * 0.03,
      vx: (Math.random() - 0.5) * 0.25,
      vy: 0.25 + Math.random() * 0.35,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpd: 0.012 + Math.random() * 0.018,
      alpha: 0.35 + Math.random() * 0.35,
      color: Math.random() > 0.5 ? BLOSSOM : BLOSSOM_LT,
    });
  }

  function drawPetal(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.shadowBlur = p.size * 2;
    ctx.shadowColor = 'rgba(254,44,85,0.06)';
    var pg = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
    pg.addColorStop(0, 'rgba(254,44,85,' + (p.alpha * 0.6).toFixed(2) + ')');
    pg.addColorStop(1, 'rgba(254,44,85,0)');
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size * 0.4, p.size, 0, 0, Math.PI * 2);
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.restore();
  }

  // ── Animation loop ──

  var running = true;
  var lastSpawn = 0;

  function frame(t) {
    if (!running) return;

    // Spawn petals
    if (t - lastSpawn > 1800 && petals.length < MAX_FALLING) {
      spawnPetal();
      lastSpawn = t;
    }

    // Redraw scene
    drawScene();

    // Update & draw falling petals
    var alive = [];
    for (var i = 0; i < petals.length; i++) {
      var p = petals[i];
      p.x += p.vx + Math.sin(p.wobble) * 0.35;
      p.y += p.vy;
      p.rot += p.rotSpd;
      p.wobble += p.wobbleSpd;
      p.alpha -= 0.001;
      drawPetal(p);
      if (p.y < H() + 30 && p.alpha > 0.02) alive.push(p);
    }
    petals = alive;

    requestAnimationFrame(frame);
  }

  resize();
  requestAnimationFrame(frame);

  // ── Public API ──
  window.PlumBg = {
    destroy: function () { running = false; if (canvas.parentNode) canvas.parentNode.removeChild(canvas); }
  };
})();
