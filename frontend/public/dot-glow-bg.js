/*
Dot Glow BG — 纯深炭黑底 + 极细白色点阵 + 中心径向光晕
极简科技风格，磨砂哑光质感。
*/
(function () {
  'use strict';

  var cfg = window.DotGlowBg || {};
  var DOT_SPACING = cfg.SPACING || 26;
  var DOT_ALPHA   = cfg.ALPHA   || 0.08;
  var DOT_RADIUS  = cfg.RADIUS  || 0.6;
  var GLOW_COLOR  = cfg.GLOW    || 'rgba(160,175,195,';

  var canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;';
  document.body.insertBefore(canvas, document.body.firstChild);

  var ctx = canvas.getContext('2d');

  function draw() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    canvas.width  = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // 1) Center radial glow — very faint
    var r = Math.max(w, h) * 0.55;
    var grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, r);
    grad.addColorStop(0,   GLOW_COLOR + '0.035)');
    grad.addColorStop(0.4, GLOW_COLOR + '0.012)');
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 2) Fine dot grid — uniform, barely visible
    ctx.fillStyle = 'rgba(255,255,255,' + DOT_ALPHA + ')';
    for (var x = DOT_SPACING / 2; x < w; x += DOT_SPACING) {
      for (var y = DOT_SPACING / 2; y < h; y += DOT_SPACING) {
        ctx.beginPath();
        ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  draw();
  window.addEventListener('resize', draw);

  window.DotGlowBg = {
    destroy: function () { if (canvas.parentNode) canvas.parentNode.removeChild(canvas); }
  };
})();
