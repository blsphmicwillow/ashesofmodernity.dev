/* ashesofmodernity.dev — shared background, particle and audio effects.
 *
 * Optimised version of the scripts that used to be inlined in every page.
 * The look is unchanged; the work behind it is not:
 *   - the wave ribbons draw at 60% resolution and 24fps instead of full-screen paint
 *   - the particles animate through object transforms, so no per-frame CPU loops
 *     over 492 points and no per-frame buffer re-uploads to the GPU
 *   - everything waits until the page is actually visible (the warning screen
 *     hides the background, so animating behind it was wasted frames)
 *   - hover sounds reuse a small pool of audio elements instead of cloning one
 *     per hover, and are bound once with delegation instead of a MutationObserver
 *   - the background track streams instead of being preloaded, and playback is
 *     attempted immediately so the music starts with the page
 */
(function () {
  'use strict';

  var doc = document;
  var body = doc.body;
  var revealed = !doc.getElementById('tw-modal') || body.classList.contains('revealed');

  function whenVisible(cb) {
    if (revealed) { cb(); return; }
    var mo = new MutationObserver(function () {
      if (body.classList.contains('revealed')) {
        mo.disconnect();
        revealed = true;
        cb();
      }
    });
    mo.observe(body, { attributes: true, attributeFilter: ['class'] });
  }

  /* ------------------------------------------------------------------ ribbons */

  whenVisible(function () {
    var canvas = doc.getElementById('wave-bg');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var RES = 0.6;               // internal resolution multiplier
    var FPS = 24;
    var STEP = 20;
    var W = 0;
    var H = 0;

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.max(1, Math.round(W * RES));
      canvas.height = Math.max(1, Math.round(H * RES));
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(RES, 0, 0, RES, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    function makeRibbon(yBase, amp, freq, baseSpeed, thick, glow, crest, color) {
      return {
        yBase: yBase,
        amp: amp,
        freq: freq,
        speed: baseSpeed * (0.65 + Math.random() * 0.7),
        phase: Math.random() * Math.PI * 2,
        thick: thick,
        glowAlpha: glow,
        crestAlpha: crest,
        color: color
      };
    }

    var ribbons = [
      makeRibbon(0.42, 120, 0.0032, 0.35, 130, 0.12, 0.7,  [180, 138, 182]),
      makeRibbon(0.58, 150, 0.0021, 0.22, 180, 0.10, 0.5,  [216, 184, 218]),
      makeRibbon(0.30, 100, 0.0045, 0.50, 100, 0.09, 0.45, [138, 90, 140])
    ];

    function drawRibbon(r, t) {
      var yBase = H * r.yBase;
      var ys = [];
      var x;

      for (x = -STEP; x <= W + STEP; x += STEP) {
        var tt = t * r.speed;
        var y1 = Math.sin((x + tt * 60) * r.freq + r.phase) * r.amp;
        var y2 = Math.sin((x * 0.6 + tt * 90) * (r.freq * 1.7) + r.phase * 1.5) * (r.amp * 0.35);
        ys.push(yBase + y1 + y2);
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      ctx.beginPath();
      for (var a = 0; a < ys.length; a++) {
        var yy = ys[a] - r.thick * 0.5;
        var xx = -STEP + a * STEP;
        if (a === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      for (var b = ys.length - 1; b >= 0; b--) {
        var yy2 = ys[b] + r.thick * 0.5;
        var xx2 = -STEP + b * STEP;
        ctx.lineTo(xx2, yy2);
      }
      ctx.closePath();

      var spanTop = yBase - r.amp - r.thick * 0.5;
      var spanBot = yBase + r.amp + r.thick * 0.5;
      var vGrad = ctx.createLinearGradient(0, spanTop, 0, spanBot);
      var c = r.color;
      vGrad.addColorStop(0.0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
      vGrad.addColorStop(0.5, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + r.glowAlpha + ')');
      vGrad.addColorStop(1.0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');

      ctx.fillStyle = vGrad;
      ctx.fill();

      ctx.beginPath();
      for (var k = 0; k < ys.length; k++) {
        var yc = ys[k];
        var xc = -STEP + k * STEP;
        if (k === 0) ctx.moveTo(xc, yc);
        else ctx.lineTo(xc, yc);
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + r.crestAlpha + ')';
      ctx.stroke();

      ctx.restore();
    }

    var start = performance.now();
    var last = start;
    var acc = 0;
    var interval = 1000 / FPS;

    function frame(now) {
      requestAnimationFrame(frame);
      var delta = now - last;
      last = now;
      if (!revealed || doc.hidden) return;
      acc += delta;
      if (acc < interval) return;
      acc = acc % interval;

      var t = (now - start) * 0.001;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < ribbons.length; i++) drawRibbon(ribbons[i], t);
    }
    requestAnimationFrame(frame);
  });

  /* ---------------------------------------------------------------- particles */

  whenVisible(function () {
    var canvas = doc.getElementById('particles-bg');
    if (!canvas || typeof THREE === 'undefined') return;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 40;

    var renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(1);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);

    var palette = [
      new THREE.Color('#b48ab6'),
      new THREE.Color('#8a5a8c'),
      new THREE.Color('#d8b8da'),
      new THREE.Color('#c9bfcb'),
      new THREE.Color('#4a3550')
    ];

    function makeCircleTexture() {
      var size = 96;
      var c = doc.createElement('canvas');
      c.width = c.height = size;
      var g = c.getContext('2d');
      var cx = size / 2;
      var grad = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.4, 'rgba(255,255,255,0.55)');
      grad.addColorStop(0.75, 'rgba(255,255,255,0.12)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      var tex = new THREE.CanvasTexture(c);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      return tex;
    }

    function makeDotTexture() {
      var size = 48;
      var c = doc.createElement('canvas');
      c.width = c.height = size;
      var g = c.getContext('2d');
      var cx = size / 2;
      var grad = g.createRadialGradient(cx, cx, 0, cx, cx, cx * 0.5);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.9)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(cx, cx, cx * 0.5, 0, Math.PI * 2);
      g.fill();
      var tex = new THREE.CanvasTexture(c);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      return tex;
    }

    function makePentagramTexture() {
      var size = 128;
      var c = doc.createElement('canvas');
      c.width = c.height = size;
      var g = c.getContext('2d');
      var cx = size / 2;
      var cy = size / 2;
      var R = size * 0.42;
      g.clearRect(0, 0, size, size);
      g.shadowColor = 'rgba(216, 184, 218, 0.9)';
      g.shadowBlur = 14;
      g.strokeStyle = 'rgba(216, 184, 218, 0.95)';
      g.lineWidth = 5;
      g.lineJoin = 'miter';
      var pts = [];
      for (var i = 0; i < 5; i++) {
        var a = (i * 2 * Math.PI / 5) + Math.PI / 2;
        pts.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R });
      }
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      g.lineTo(pts[2].x, pts[2].y);
      g.lineTo(pts[4].x, pts[4].y);
      g.lineTo(pts[1].x, pts[1].y);
      g.lineTo(pts[3].x, pts[3].y);
      g.closePath();
      g.stroke();
      g.beginPath();
      g.arc(cx, cy, R * 1.02, 0, Math.PI * 2);
      g.lineWidth = 3.5;
      g.stroke();
      g.save();
      g.translate(cx, cy);
      g.rotate(Math.PI);
      g.shadowBlur = 8;
      g.fillStyle = 'rgba(216, 184, 218, 0.95)';
      g.font = 'bold ' + Math.floor(size * 0.42) + 'px "JetBrains Mono", monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('⛧', 0, size * 0.02);
      g.restore();
      var tex = new THREE.CanvasTexture(c);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      return tex;
    }

    var circleTex = makeCircleTexture();
    var dotTex = makeDotTexture();
    var pentagramTex = makePentagramTexture();

    var SPREAD = 70;

    function makePositions(count) {
      var positions = new Float32Array(count * 3);
      var colors = new Float32Array(count * 3);
      for (var i = 0; i < count; i++) {
        var ix = i * 3;
        positions[ix] = (Math.random() - 0.5) * SPREAD * 2;
        positions[ix + 1] = (Math.random() - 0.5) * SPREAD * 2;
        positions[ix + 2] = (Math.random() - 0.5) * SPREAD;
        var c = palette[Math.floor(Math.random() * palette.length)];
        colors[ix] = c.r;
        colors[ix + 1] = c.g;
        colors[ix + 2] = c.b;
      }
      return { positions: positions, colors: colors };
    }

    function makePoints(count, size, opacity, map, color, useVertexColors) {
      var data = makePositions(count);
      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
      if (useVertexColors) geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));

      var material = new THREE.PointsMaterial({
        size: size,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: !!useVertexColors,
        transparent: true,
        opacity: opacity,
        map: map,
        alphaTest: 0.02
      });
      if (color !== undefined) material.color = new THREE.Color(color);

      var points = new THREE.Points(geometry, material);
      scene.add(points);
      return points;
    }

    var dots = makePoints(420, 0.55, 0.9, dotTex, undefined, true);
    var circles = makePoints(50, 3.2, 0.55, circleTex, undefined, true);
    var pentPoints = makePoints(22, 2.4, 0.9, pentagramTex, 0xd8b8da, false);
    var pentMaterial = pentPoints.material;

    var mouse = { x: 0, y: 0 };
    var target = { x: 0, y: 0 };

    window.addEventListener('mousemove', function (e) {
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = -((e.clientY / window.innerHeight) * 2 - 1);
    }, { passive: true });

    window.addEventListener('touchmove', function (e) {
      if (!e.touches[0]) return;
      target.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
      target.y = -((e.touches[0].clientY / window.innerHeight) * 2 - 1);
    }, { passive: true });

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize, { passive: true });

    var clock = new THREE.Clock();
    var lastFrame = 0;
    var frameInterval = 1000 / 45;

    function animate(now) {
      requestAnimationFrame(animate);
      if (!revealed || doc.hidden) return;
      if (now - lastFrame < frameInterval) return;
      lastFrame = now;

      var t = clock.getElapsedTime();
      mouse.x += (target.x - mouse.x) * 0.05;
      mouse.y += (target.y - mouse.y) * 0.05;

      dots.rotation.y = mouse.x * 0.25 + t * 0.035;
      dots.rotation.x = -mouse.y * 0.15 + Math.sin(t * 0.12) * 0.06;
      dots.rotation.z = Math.sin(t * 0.07) * 0.03;
      dots.position.x = mouse.x * 6;
      dots.position.y = mouse.y * 6;

      circles.rotation.y = mouse.x * 0.2 + t * 0.06;
      circles.rotation.x = -mouse.y * 0.12 + Math.sin(t * 0.15) * 0.05;
      circles.rotation.z = Math.cos(t * 0.09) * 0.04;
      circles.position.x = mouse.x * 4;
      circles.position.y = mouse.y * 4;

      pentPoints.rotation.y = mouse.x * 0.35 + t * 0.09;
      pentPoints.rotation.x = -mouse.y * 0.22 + Math.sin(t * 0.18) * 0.05;
      pentPoints.rotation.z = Math.sin(t * 0.08) * 0.06;
      pentPoints.position.x = mouse.x * 8;
      pentPoints.position.y = mouse.y * 8;
      pentMaterial.size = 2.4 + Math.sin(t * 0.9) * 0.15;
      pentMaterial.rotation = t * 0.3;

      renderer.render(scene, camera);
    }
    requestAnimationFrame(animate);
  });

  /* ------------------------------------------------------------------- audio */

  (function audio() {
    var bg = doc.getElementById('bg-audio');
    var hoverSource = doc.getElementById('hover-audio');
    var BG_VOLUME = 0.22;
    var FADE_MS = 2500;
    var BG_BLOCKED = true;

    if (bg) bg.volume = 0;

    var pool = [];
    var poolIndex = 0;
    if (hoverSource) {
      hoverSource.volume = 0.5;
      for (var i = 0; i < 3; i++) {
        var clone = hoverSource.cloneNode(true);
        clone.preload = 'auto';
        clone.volume = 0.5;
        pool.push(clone);
      }
    }

    function fadeInBackground() {
      var startT = performance.now();
      function step(now) {
        var p = Math.min(1, (now - startT) / FADE_MS);
        var e = 1 - Math.pow(1 - p, 2);
        bg.volume = BG_VOLUME * e;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    function removeGestureUnlock() {
      doc.removeEventListener('pointerdown', unlock);
      doc.removeEventListener('keydown', unlock);
      doc.removeEventListener('touchstart', unlock);
    }

    function playBackground() {
      if (!bg || !BG_BLOCKED) return;
      bg.volume = 0;
      var p = bg.play();
      if (!p || typeof p.then !== 'function') {
        BG_BLOCKED = false;
        fadeInBackground();
        return;
      }
      p.then(function () {
        BG_BLOCKED = false;
        fadeInBackground();
        removeGestureUnlock();
      }).catch(function () {
        /* blocked by the browser: the first click/keypress starts it instead */
      });
    }

    function playHover() {
      if (BG_BLOCKED || !pool.length) return;
      var el = pool[poolIndex++ % pool.length];
      try {
        el.currentTime = 0;
        var p = el.play();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      } catch (e) {}
    }

    function unlock() {
      playBackground();
      playHover();
      removeGestureUnlock();
    }

    doc.addEventListener('pointerdown', unlock);
    doc.addEventListener('keydown', unlock);
    doc.addEventListener('touchstart', unlock);

    var HOVER_TARGETS = 'a, button, .head, .col-left, .col-right, .content, .nav, .foot, .pfp';
    doc.addEventListener('mouseover', function (e) {
      var el = e.target;
      if (!el || el.nodeType !== 1) return;
      var hit = el.closest ? el.closest(HOVER_TARGETS) : null;
      if (!hit) return;
      if (e.relatedTarget && hit.contains(e.relatedTarget)) return;
      playHover();
    }, { passive: true });

    doc.addEventListener('focusin', function (e) {
      var el = e.target;
      if (el && el.closest && el.closest('a, button')) playHover();
    }, { passive: true });

    doc.addEventListener('visibilitychange', function () {
      if (!bg) return;
      if (doc.hidden) {
        bg.pause();
      } else if (!BG_BLOCKED) {
        var p = bg.play();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      } else {
        playBackground();
      }
    });

    window.addEventListener('pageshow', playBackground);

    /* Start straight away: browsers that allow it play immediately, the rest
       start on the visitor's first click, key press or tap. The "proceed"
       button on the warning screen is itself a click, so it also starts it. */
    playBackground();
    whenVisible(playBackground);
  })();
})();
