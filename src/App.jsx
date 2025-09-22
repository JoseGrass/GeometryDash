import React, { useEffect, useRef, useState } from 'react';

// Geometry Dash - like single-file React component
// Default export a React component so it can be dropped into a React app (Vite / CRA).
// Includes a small amount of CSS injected at runtime so you have a single file to copy.

export default function App() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(0);
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [high, setHigh] = useState(() => Number(localStorage.getItem('gd_like_high') || 0));
  const [status, setStatus] = useState('tap to start');

  // Game state
  const stateRef = useRef({
    width: 360, // logical canvas size (will scale to device)
    height: 640,
    scale: 1,
    player: {
      x: 60,
      y: 0,
      w: 36,
      h: 36,
      vy: 0,
      grounded: false,
    },
    gravity: 1600,
    jumpVel: -620,
    obstacles: [],
    spawnTimer: 0,
    spawnInterval: 1.2,
    speed: 260,
    time: 0,
    dead: false,
  });

  // Inject minimal CSS (mobile-first) once
  useEffect(() => {
    const css = `
      .gd-root{ display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:linear-gradient(#0f172a,#0b1220); color:#fff; }
      .gd-wrap{ width:100%; max-width:420px; padding:8px; box-sizing:border-box; }
      .gd-canvas{ width:100%; height:calc(100vh - 120px); background: linear-gradient(180deg,#081122,#071226); border-radius:14px; box-shadow:0 10px 30px rgba(0,0,0,0.6); touch-action: manipulation; }
      .gd-hud{ display:flex; justify-content:space-between; align-items:center; margin-top:10px; gap:8px; }
      .gd-btn{ background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.06); padding:8px 12px; border-radius:10px; font-weight:600; }
      .gd-status{ text-align:center; margin-top:6px; font-size:14px; opacity:0.9 }
      @media(min-width:420px){ .gd-canvas{ height:640px } }
    `;
    if (!document.getElementById('gd-like-css')) {
      const s = document.createElement('style');
      s.id = 'gd-like-css';
      s.textContent = css;
      document.head.appendChild(s);
    }
  }, []);

  // Resize canvas to fit container while keeping logical resolution
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      const rect = parent.getBoundingClientRect();
      const logicalW = stateRef.current.width;
      const logicalH = stateRef.current.height;
      // Compute scale to fit parent width and maintain aspect
      const scale = Math.min(rect.width / logicalW, rect.height / logicalH);
      stateRef.current.scale = scale;
      canvas.width = Math.round(logicalW * devicePixelRatio);
      canvas.height = Math.round(logicalH * devicePixelRatio);
      canvas.style.width = Math.round(logicalW * scale) + 'px';
      canvas.style.height = Math.round(logicalH * scale) + 'px';
      const ctx = canvas.getContext('2d');
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    function spawnObstacle() {
      const h = 40 + Math.random() * 60;
      const groundY = stateRef.current.height - 80;
      stateRef.current.obstacles.push({
        x: stateRef.current.width + 20,
        y: groundY - h,
        w: 28 + Math.random() * 30,
        h: h,
      });
      // gradually reduce interval to increase difficulty
      stateRef.current.spawnInterval = Math.max(0.6, stateRef.current.spawnInterval - 0.02);
    }

    function step(ts) {
      if (!lastTimeRef.current) lastTimeRef.current = ts;
      const dt = Math.min((ts - lastTimeRef.current) / 1000, 0.033);
      lastTimeRef.current = ts;
      const s = stateRef.current;
      if (running && !s.dead) {
        s.time += dt;
        // physics
        s.player.vy += s.gravity * dt;
        s.player.y += s.player.vy * dt;
        const ground = s.height - 80 - s.player.h / 2;
        if (s.player.y >= ground) {
          s.player.y = ground;
          s.player.vy = 0;
          s.player.grounded = true;
        } else {
          s.player.grounded = false;
        }

        // move obstacles
        for (let i = s.obstacles.length - 1; i >= 0; i--) {
          s.obstacles[i].x -= s.speed * dt;
          if (s.obstacles[i].x + s.obstacles[i].w < -40) s.obstacles.splice(i, 1);
        }

        // spawn
        s.spawnTimer += dt;
        if (s.spawnTimer > s.spawnInterval) {
          s.spawnTimer = 0;
          spawnObstacle();
        }

        // collision
        const playerBox = {
          x: s.player.x - s.player.w / 2,
          y: s.player.y - s.player.h / 2,
          w: s.player.w,
          h: s.player.h,
        };
        for (const o of s.obstacles) {
          const obsBox = { x: o.x, y: o.y, w: o.w, h: o.h };
          if (rectOverlap(playerBox, obsBox)) {
            s.dead = true;
            setStatus('dead — tap to restart');
            setRunning(false);
            // update high score
            const sc = Math.floor(s.time * 10);
            setScore(sc);
            if (sc > high) {
              setHigh(sc);
              localStorage.setItem('gd_like_high', String(sc));
            }
            break;
          }
        }

        // increase speed slowly
        s.speed += 5 * dt;
        // update score live
        setScore(Math.floor(s.time * 10));
      }

      // render
      render(ctx);
      rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [running, high]);

  function rectOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function render(ctx) {
    const s = stateRef.current;
    // clear
    ctx.clearRect(0, 0, s.width, s.height);

    // background grid / parallax
    const grad = ctx.createLinearGradient(0, 0, 0, s.height);
    grad.addColorStop(0, '#07132a');
    grad.addColorStop(1, '#04111f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s.width, s.height);

    // ground
    ctx.fillStyle = '#0b5b83';
    ctx.fillRect(0, s.height - 80, s.width, 80);

    // obstacles
    ctx.save();
    for (const o of s.obstacles) {
      drawRoundedRect(ctx, o.x, o.y, o.w, o.h, 6);
      // simple highlight
      ctx.fillStyle = '#ff6b6b';
      ctx.fill();
    }
    ctx.restore();

    // player (square with small rotation when jumping)
    const p = s.player;
    ctx.save();
    const rot = (p.vy / 800) * 0.4;
    ctx.translate(p.x, p.y);
    ctx.rotate(rot);
    // body
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    // eye
    ctx.fillStyle = '#223';
    ctx.fillRect(p.w / 8, -p.h / 8, p.w / 6, p.h / 6);
    ctx.restore();

    // hud (score)
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '18px system-ui, Arial';
    ctx.fillText(`Score: ${Math.floor(s.time * 10)}`, 12, 28);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(`High: ${high}`, 12, 50);

    // status overlay if not running
    if (!running) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, s.height / 2 - 40, s.width, 80);
      ctx.fillStyle = '#fff';
      ctx.font = '20px system-ui, Arial';
      ctx.textAlign = 'center';
      ctx.fillText(status, s.width / 2, s.height / 2 + 8);
      ctx.textAlign = 'start';
    }
  }

  function drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Input: tap or space / click to jump or start
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function tryJump() {
      const s = stateRef.current;
      if (s.dead) return; // no jumping when dead
      if (!running) {
        // start
        startRun();
        return;
      }
      // jump if grounded
      if (s.player.grounded) {
        s.player.vy = s.jumpVel;
        s.player.grounded = false;
        // small sound
        beep();
      }
    }

    function onTouch(e) {
      e.preventDefault();
      tryJump();
    }
    function onClick(e) {
      tryJump();
    }
    function onKey(e) {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        tryJump();
      }
    }

    canvas.addEventListener('touchstart', onTouch, { passive: false });
    canvas.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      canvas.removeEventListener('touchstart', onTouch);
      canvas.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [running]);

  function startRun() {
    // reset state but keep high
    const s = stateRef.current;
    s.obstacles = [];
    s.spawnInterval = 1.2;
    s.spawnTimer = 0;
    s.speed = 260;
    s.time = 0;
    s.dead = false;
    s.player.y = s.height - 80 - s.player.h / 2;
    s.player.vy = 0;
    s.player.grounded = true;
    setRunning(true);
    setStatus('');
    setScore(0);
    lastTimeRef.current = 0;
  }

  function restart() {
    startRun();
  }

  // simple beep using WebAudio for jump
  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 440;
      g.gain.value = 0.04;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.08);
      // close quickly
      setTimeout(() => ctx.close(), 150);
    } catch (e) {
      // ignore audio errors on iOS if not allowed
    }
  }

  return (
    <div className="gd-root">
      <div className="gd-wrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>GD — Clone (React)</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Tap / Space to jump</div>
        </div>

        <div style={{ marginTop: 10 }}>
          <canvas ref={canvasRef} className="gd-canvas" />
        </div>

        <div className="gd-hud">
          <div className="gd-btn" onClick={() => { if (running) { setRunning(false); setStatus('paused — tap to resume'); } else { setStatus(''); setRunning(true); } }}>
            {running ? 'Pause' : 'Play'}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="gd-btn">Score: {score}</div>
            <div className="gd-btn">High: {high}</div>
            <div className="gd-btn" onClick={() => { restart(); }}>Restart</div>
          </div>
        </div>

        <div className="gd-status">{status}</div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>Tip: install as a PWA or wrap with Capacitor/Electron to run as a mobile app.</div>
      </div>
    </div>
  );
}
