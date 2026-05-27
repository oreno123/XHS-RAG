/*
Particle BG — WebGL 3D Particle Field with Perspective Depth
Monochrome gaussian dots on dark background, slow Y-axis rotation.

Usage: <script src="particle-bg.js"></script>
Config: window.ParticleBg = { ... } before script loads.
*/
(function () {
  'use strict';

  var cfg = window.ParticleBg || {};
  var COUNT       = cfg.COUNT       || 2200;
  var SPREAD      = cfg.SPREAD      || 6;
  var DEPTH       = cfg.DEPTH       || 6;
  var CAM_DIST    = cfg.CAM_DIST    || 10;
  var ROT_SPEED   = cfg.ROT_SPEED != null ? cfg.ROT_SPEED : 0.00006;
  var DRIFT_AMP   = cfg.DRIFT_AMP   || 0.2;
  var DRIFT_SPEED = cfg.DRIFT_SPEED || 0.3;
  var POINT_SCALE = cfg.POINT_SCALE || 100;
  var COLOR       = cfg.COLOR       || [0.078, 0.72, 0.65];
  var COLOR_FAR   = cfg.COLOR_FAR   || [0.03, 0.28, 0.32];
  var BG          = cfg.BG          || [0.031, 0.039, 0.071];

  // ── Canvas ──
  var canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;';
  document.body.insertBefore(canvas, document.body.firstChild);

  var gl = canvas.getContext('webgl', { alpha: true, antialias: false });
  if (!gl) { console.warn('ParticleBg: WebGL not available'); return; }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = Math.floor(canvas.clientWidth  * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  // ── Shaders ──
  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  }

  var vsSrc = [
    'attribute vec3 aPos;',
    'attribute float aSize;',
    'attribute float aAlpha;',
    'attribute float aPhase;',
    '',
    'uniform float uTime;',
    'uniform float uAngle;',
    'uniform float uAspect;',
    'uniform float uPtScale;',
    'uniform float uCamDist;',
    '',
    'varying float vAlpha;',
    'varying float vDepth;',
    '',
    'void main() {',
    '  vec3 p = aPos;',
    // gentle drift
    '  p.y += sin(uTime * ' + DRIFT_SPEED.toFixed(3) + ' + aPhase * 6.2832) * ' + DRIFT_AMP.toFixed(2) + ';',
    '  p.x += cos(uTime * ' + (DRIFT_SPEED * 0.7).toFixed(3) + ' + aPhase * 4.13) * ' + (DRIFT_AMP * 0.6).toFixed(2) + ';',
    // Y rotation
    '  float c = cos(uAngle);',
    '  float s = sin(uAngle);',
    '  vec3 rp = vec3(p.x*c - p.z*s, p.y, p.x*s + p.z*c);',
    // perspective
    '  float z = max(uCamDist - rp.z, 0.5);',
    '  float fov = 0.577;',
    '  gl_Position = vec4(rp.x / (z * fov) * uAspect, rp.y / (z * fov), 0.0, 1.0);',
    '  gl_PointSize = max(aSize * uPtScale / z, 1.0);',
    // depth fade: close=bright, far=dim
    '  float depthFade = clamp(1.0 - (z - 3.0) / 15.0, 0.04, 1.0);',
    '  vAlpha = aAlpha * depthFade;',
    '  vDepth = clamp((z - 3.0) / 14.0, 0.0, 1.0);',
    '}'
  ].join('\n');

  var fsSrc = [
    'precision mediump float;',
    'varying float vAlpha;',
    'varying float vDepth;',
    'uniform vec3 uColorNear;',
    'uniform vec3 uColorFar;',
    '',
    'void main() {',
    '  vec2 d = gl_PointCoord - 0.5;',
    '  float r2 = dot(d, d);',
    '  float gauss = exp(-r2 * 3.5);',
    '  float a = gauss * vAlpha;',
    '  if (a < 0.003) discard;',
    '  vec3 col = mix(uColorNear, uColorFar, vDepth);',
    '  gl_FragColor = vec4(col * a, a);',
    '}'
  ].join('\n');

  var vs = compile(gl.VERTEX_SHADER, vsSrc);
  var fs = compile(gl.FRAGMENT_SHADER, fsSrc);

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); return; }
  gl.useProgram(prog);

  // ── Locations ──
  function aLoc(name) { var l = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(l); return l; }
  function uLoc(name) { return gl.getUniformLocation(prog, name); }

  var aPos   = aLoc('aPos');
  var aSize  = aLoc('aSize');
  var aAlpha = aLoc('aAlpha');
  var aPhase = aLoc('aPhase');

  var uTime      = uLoc('uTime');
  var uAngle     = uLoc('uAngle');
  var uAspect    = uLoc('uAspect');
  var uPtScale   = uLoc('uPtScale');
  var uCamDist   = uLoc('uCamDist');
  var uColorNear = uLoc('uColorNear');
  var uColorFar  = uLoc('uColorFar');

  // ── Particles ──
  var posArr   = new Float32Array(COUNT * 3);
  var sizeArr  = new Float32Array(COUNT);
  var alphaArr = new Float32Array(COUNT);
  var phaseArr = new Float32Array(COUNT);

  for (var i = 0; i < COUNT; i++) {
    posArr[i * 3]     = (Math.random() - 0.5) * SPREAD * 2;
    posArr[i * 3 + 1] = (Math.random() - 0.5) * SPREAD * 2;
    posArr[i * 3 + 2] = (Math.random() - 0.5) * DEPTH * 2;
    // 5% large bokeh, 20% medium glow, 75% tiny dense dots
    var r = Math.random();
    if (r < 0.05) {
      sizeArr[i]  = 2.0 + Math.random() * 3.0;
      alphaArr[i] = 0.15 + Math.random() * 0.15;
    } else if (r < 0.25) {
      sizeArr[i]  = 0.8 + Math.random() * 1.2;
      alphaArr[i] = 0.25 + Math.random() * 0.25;
    } else {
      sizeArr[i]  = 0.15 + Math.random() * 0.45;
      alphaArr[i] = 0.35 + Math.random() * 0.4;
    }
    phaseArr[i] = Math.random();
  }

  function mkBuf(data, attrib, sz) {
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.vertexAttribPointer(attrib, sz, gl.FLOAT, false, 0, 0);
  }
  mkBuf(posArr,   aPos,   3);
  mkBuf(sizeArr,  aSize,  1);
  mkBuf(alphaArr, aAlpha, 1);
  mkBuf(phaseArr, aPhase, 1);

  // ── State ──
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

  gl.uniform3f(uColorNear, COLOR[0], COLOR[1], COLOR[2]);
  gl.uniform3f(uColorFar,  COLOR_FAR[0], COLOR_FAR[1], COLOR_FAR[2]);
  gl.uniform1f(uCamDist, CAM_DIST);
  gl.uniform1f(uPtScale, POINT_SCALE);

  var angle = 0;
  var t0 = performance.now();
  var running = true;

  // ── Render loop ──
  function frame() {
    if (!running) return;
    var t = (performance.now() - t0) / 1000;
    angle += ROT_SPEED;

    resize();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform1f(uTime,  t);
    gl.uniform1f(uAngle, angle);
    gl.uniform1f(uAspect, canvas.width / canvas.height);

    gl.drawArrays(gl.POINTS, 0, COUNT);
    requestAnimationFrame(frame);
  }
  frame();

  // ── Public API ──
  window.ParticleBg = {
    destroy: function () { running = false; if (canvas.parentNode) canvas.parentNode.removeChild(canvas); }
  };
})();
