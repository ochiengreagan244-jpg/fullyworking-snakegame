// =========================================================
//  SNAKE — Pro Edition
//  States: MENU | PLAYING | PAUSED | WASTED
// =========================================================

const canvas    = document.getElementById('gameCanvas');
const ctx       = canvas.getContext('2d');
const scoreEl   = document.getElementById('score');
const bestEl    = document.getElementById('best');
const lengthEl  = document.getElementById('length');
const levelNameEl = document.getElementById('levelName');
const pauseBtn  = document.getElementById('pauseBtn');
const restartBtn= document.getElementById('restartBtn');
const levelBar  = document.getElementById('levelBar');

// ---------- Grid ----------
const GRID = 32;                      // 32x32 cells → bigger, more tactical
const CELL = canvas.width / GRID;     // 20px per cell (640/32)

// ---------- Levels ----------
const LEVELS = {
  amateur: { name: 'Amateur', speed: 5,  wrap: true,  accelEvery: 0  },
  easy:    { name: 'Easy',    speed: 7,  wrap: true,  accelEvery: 8  },
  normal:  { name: 'Normal',  speed: 10, wrap: false, accelEvery: 6  },
  hard:    { name: 'Hard',    speed: 14, wrap: false, accelEvery: 4  },
  insane:  { name: 'Insane',  speed: 18, wrap: false, accelEvery: 2  },
};

// ---------- Game state ----------
let state       = 'MENU';      // MENU | PLAYING | PAUSED | WASTED
let snake, direction, nextDirection, food;
let score, best, level, speed, applesEaten, wastedTimer;

best = Number(localStorage.getItem('snakeBest') || 0);
bestEl.textContent = best;

level = LEVELS.normal;
levelNameEl.textContent = level.name;

// =========================================================
//  INIT
// =========================================================
function resetGame(startPlaying = false) {
  snake = [
    { x: 16, y: 16 },
    { x: 15, y: 16 },
    { x: 14, y: 16 },
  ];
  direction     = { x: 1, y: 0 };
  nextDirection = direction;
  score         = 0;
  applesEaten   = 0;
  speed         = level.speed;
  scoreEl.textContent  = 0;
  lengthEl.textContent = snake.length;
  placeFood();
  clearTimeout(wastedTimer);

  state = startPlaying ? 'PLAYING' : 'MENU';
}

function placeFood() {
  while (true) {
    const fx = Math.floor(Math.random() * GRID);
    const fy = Math.floor(Math.random() * GRID);
    if (!snake.some(s => s.x === fx && s.y === fy)) {
      food = { x: fx, y: fy };
      return;
    }
  }
}

// =========================================================
//  INPUT — Keyboard
// =========================================================
document.addEventListener('keydown', (e) => {
  const k = e.key;

  // --- Enter: start / restart ---
  if (k === 'Enter') {
    if (state === 'MENU' || state === 'WASTED') {
      resetGame(true);
    }
    return;
  }

  // --- Space: pause toggle ---
  if (k === ' ') {
    e.preventDefault();
    if (state === 'PLAYING')      state = 'PAUSED';
    else if (state === 'PAUSED')  state = 'PLAYING';
    return;
  }

  // --- Arrows / WASD: direction (only while playing) ---
  if (state !== 'PLAYING') return;

  const up    = k === 'ArrowUp'    || k === 'w' || k === 'W';
  const down  = k === 'ArrowDown'  || k === 's' || k === 'S';
  const left  = k === 'ArrowLeft'  || k === 'a' || k === 'A';
  const right = k === 'ArrowRight' || k === 'd' || k === 'D';

  if (up    && direction.y === 0) nextDirection = { x: 0, y: -1 };
  if (down  && direction.y === 0) nextDirection = { x: 0, y: 1  };
  if (left  && direction.x === 0) nextDirection = { x: -1, y: 0 };
  if (right && direction.x === 0) nextDirection = { x: 1,  y: 0 };

  if (k.startsWith('Arrow')) e.preventDefault();
});

// =========================================================
//  INPUT — Touch (swipe)
// =========================================================
let touchStart = null;
canvas.addEventListener('touchstart', (e) => {
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });

canvas.addEventListener('touchend', (e) => {
  if (!touchStart || state !== 'PLAYING') { touchStart = null; return; }
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  const absX = Math.abs(dx), absY = Math.abs(dy);
  const THRESH = 24;

  if (Math.max(absX, absY) < THRESH) {
    // Tap → toggle pause
    state = (state === 'PLAYING') ? 'PAUSED' : 'PLAYING';
  } else if (absX > absY) {
    if (dx > 0 && direction.x === 0) nextDirection = { x: 1,  y: 0 };
    if (dx < 0 && direction.x === 0) nextDirection = { x: -1, y: 0 };
  } else {
    if (dy > 0 && direction.y === 0) nextDirection = { x: 0, y: 1  };
    if (dy < 0 && direction.y === 0) nextDirection = { x: 0, y: -1 };
  }
  touchStart = null;
}, { passive: true });

// =========================================================
//  BUTTONS
// =========================================================
pauseBtn.addEventListener('click', () => {
  if (state === 'PLAYING') state = 'PAUSED';
  else if (state === 'PAUSED') state = 'PLAYING';
});

restartBtn.addEventListener('click', () => resetGame(true));

levelBar.addEventListener('click', (e) => {
  const btn = e.target.closest('.level-btn');
  if (!btn) return;
  document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const key = btn.dataset.level;
  level = LEVELS[key];
  levelNameEl.textContent = level.name;
  // Changing level restarts into the new level
  resetGame(state === 'PLAYING' || state === 'PAUSED');
});

// =========================================================
//  UPDATE
// =========================================================
function update() {
  if (state !== 'PLAYING') return;

  direction = nextDirection;
  let head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

  // Wall handling
  if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
    if (level.wrap) {
      head.x = (head.x + GRID) % GRID;
      head.y = (head.y + GRID) % GRID;
    } else {
      return die();
    }
  }

  // Self collision (ignore the tail we're about to remove)
  if (snake.slice(0, -1).some(s => s.x === head.x && s.y === head.y)) {
    return die();
  }

  snake.unshift(head);

  // Eat food
  if (head.x === food.x && head.y === food.y) {
    score += 10;
    applesEaten++;
    scoreEl.textContent  = score;
    lengthEl.textContent = snake.length;
    placeFood();

    // Speed-up per level
    if (level.accelEvery > 0 && applesEaten % level.accelEvery === 0) {
      speed = Math.min(speed + 1, level.speed * 2);
    }
  } else {
    snake.pop();
  }
}
function die() {
  state = 'WASTED';
  if (score > best) {
    best = score;
    bestEl.textContent = best;
    localStorage.setItem('snakeBest', best);
  }
  // Auto-return to MENU after 4 seconds so it doesn't loop
  wastedTimer = setTimeout(() => {
    if (state === 'WASTED') state = 'MENU';
  }, 4000);
}

// =========================================================
//  RENDER
// =========================================================
function draw() {
  // Background
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, '#0b1220');
  grad.addColorStop(1, '#0f1a2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid lines
  ctx.strokeStyle = 'rgba(74, 222, 128, 0.055)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= GRID; i++) {
    ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(canvas.width, i * CELL); ctx.stroke();
  }

  // Border ring when wrap mode is on (glow)
  if (level.wrap) {
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.35)';
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    ctx.setLineDash([]);
  }

  // Food — pulsing apple
  const t = performance.now() / 300;
  const pulse = 1 + Math.sin(t) * 0.12;
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, (CELL / 2 - 2) * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Snake body
  snake.forEach((s, i) => {
    const isHead = i === 0;
    const shade = isHead ? '#a7f3d0' : '#4ade80';
    ctx.fillStyle = shade;
    if (isHead) { ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 14; }
    ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
    ctx.shadowBlur = 0;
  });

  // Snake eyes on head
  const head = snake[0];
  const cx = head.x * CELL + CELL / 2;
  const cy = head.y * CELL + CELL / 2;
  const eyeOff = CELL * 0.18;
  const eyeR   = CELL * 0.10;
  ctx.fillStyle = '#0b1220';
  // eyes perpendicular to direction
  if (direction.x !== 0) {
    ctx.beginPath(); ctx.arc(cx + direction.x * eyeOff, cy - eyeOff, eyeR, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + direction.x * eyeOff, cy + eyeOff, eyeR, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(cx - eyeOff, cy + direction.y * eyeOff, eyeR, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + eyeOff, cy + direction.y * eyeOff, eyeR, 0, Math.PI * 2); ctx.fill();
  }

  // ---- Overlays ----
  if (state === 'MENU')     drawMenuOverlay();
  if (state === 'PAUSED')   drawPausedOverlay();
  if (state === 'WASTED')   drawWastedOverlay();
}

// ---------- MENU overlay ----------
function drawMenuOverlay() {
  ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#4ade80';
  ctx.shadowColor = '#4ade80';
  ctx.shadowBlur = 25;
  ctx.font = 'bold 58px Segoe UI';
  ctx.fillText('SNAKE', canvas.width / 2, canvas.height / 2 - 40);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '18px Segoe UI';
  ctx.fillText(`Level: ${level.name}`, canvas.width / 2, canvas.height / 2 + 10);

  ctx.fillStyle = '#86efac';
  ctx.font = 'bold 22px Segoe UI';
  ctx.fillText('Press ENTER to start', canvas.width / 2, canvas.height / 2 + 70);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px Segoe UI';
  ctx.fillText('(or tap the screen on mobile)', canvas.width / 2, canvas.height / 2 + 100);
}

// ---------- PAUSE overlay ----------
function drawPausedOverlay() {
  ctx.fillStyle = 'rgba(2, 6, 23, 0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 52px Segoe UI';
  ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '16px Segoe UI';
  ctx.fillText('Space or tap to resume', canvas.width / 2, canvas.height / 2 + 40);
}

// ---------- WASTED overlay (GTA-style) ----------
function drawWastedOverlay() {
  // Dark red haze
  ctx.fillStyle = 'rgba(60, 0, 0, 0.72)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const t = performance.now() / 1000;
  const flicker = 0.85 + Math.sin(t * 12) * 0.08;   // subtle flicker

  // Desaturate the world
  ctx.globalAlpha = flicker;

  ctx.textAlign = 'center';
  ctx.fillStyle = '#7f1d1d';
  ctx.font = 'bold 92px Georgia, serif';
  ctx.shadowColor = '#dc2626';
  ctx.shadowBlur = 40;
  ctx.fillText('WASTED', canvas.width / 2, canvas.height / 2 - 10);
  ctx.shadowBlur = 0;

  ctx.globalAlpha = 1;

  // Score line
  ctx.fillStyle = '#fca5a5';
  ctx.font = 'bold 22px Segoe UI';
  ctx.fillText(`SCORE  ${score}`, canvas.width / 2, canvas.height / 2 + 50);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '18px Segoe UI';
  ctx.fillText('Press ENTER to play again', canvas.width / 2, canvas.height / 2 + 100);
}

// =========================================================
//  GAME LOOP
// =========================================================
let lastTick = 0, acc = 0;

function loop(ts) {
  if (!lastTick) lastTick = ts;
  const delta = ts - lastTick;
  lastTick = ts;

  acc += delta;
  const stepMs = 1000 / speed;
  if (acc >= stepMs) {
    update();
    acc = 0;
  }
  draw();
  requestAnimationFrame(loop);
}

// =========================================================
//  BOOT
// =========================================================
resetGame(false);
requestAnimationFrame(loop);