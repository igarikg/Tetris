(function () {
  'use strict';

  const COLS = 10;
  const ROWS = 20;
  const FALL_MS = 900;
  const LINE_POINTS = [0, 100, 300, 500, 800];

  const SHAPES = [
    // I
    [
      [[0, 0], [1, 0], [2, 0], [3, 0]],
      [[1, 0], [1, 1], [1, 2], [1, 3]],
      [[0, 1], [1, 1], [2, 1], [3, 1]],
      [[0, 0], [0, 1], [0, 2], [0, 3]],
    ],
    // O
    [
      [[0, 0], [1, 0], [0, 1], [1, 1]],
      [[0, 0], [1, 0], [0, 1], [1, 1]],
      [[0, 0], [1, 0], [0, 1], [1, 1]],
      [[0, 0], [1, 0], [0, 1], [1, 1]],
    ],
    // T
    [
      [[0, 1], [1, 0], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [1, 2], [2, 1]],
      [[0, 1], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 0], [1, 1], [1, 2]],
    ],
    // S
    [
      [[1, 0], [2, 0], [0, 1], [1, 1]],
      [[0, 0], [0, 1], [1, 1], [1, 2]],
      [[1, 1], [2, 1], [0, 2], [1, 2]],
      [[0, 1], [0, 2], [1, 2], [1, 3]],
    ],
    // Z
    [
      [[0, 0], [1, 0], [1, 1], [2, 1]],
      [[2, 0], [2, 1], [1, 1], [1, 2]],
      [[0, 1], [1, 1], [1, 2], [2, 2]],
      [[2, 1], [2, 2], [1, 2], [1, 3]],
    ],
    // J
    [
      [[0, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [1, 2], [2, 0]],
      [[0, 1], [1, 1], [2, 1], [2, 2]],
      [[0, 2], [1, 0], [1, 1], [1, 2]],
    ],
    // L
    [
      [[2, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [1, 2], [2, 2]],
      [[0, 1], [1, 1], [2, 1], [0, 2]],
      [[0, 0], [1, 0], [1, 1], [1, 2]],
    ],
  ];

  // Modern palette (soft neon)
  const COLORS = [
    '#22d3ee', // I
    '#fde047', // O
    '#a78bfa', // T
    '#34d399', // S
    '#fb7185', // Z
    '#60a5fa', // J
    '#fb923c', // L
  ];

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const nextCanvas = document.getElementById('nextCanvas');
  const nextCtx = nextCanvas ? nextCanvas.getContext('2d') : null;
  const linesEl = document.getElementById('lines');
  const scoreEl = document.getElementById('score');
  const highScoreEl = document.getElementById('highScore');
  const newGameBtn = document.getElementById('newGame');

  let board;
  let active;
  let nextShape = null;
  let gameOver = false;
  let paused = false;
  let showHelp = false;
  let fallTimer = null;
  let lines = 0;
  let score = 0;
  let highScore = 0;

  function makeBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  function setHud() {
    linesEl.textContent = String(lines);
    scoreEl.textContent = String(score);
    highScoreEl.textContent = String(highScore);
  }

  function loadHighScore() {
    try {
      const saved = localStorage.getItem('tetris_highscore');
      highScore = saved ? parseInt(saved, 10) : 0;
    } catch (e) {
      highScore = 0;
    }
  }

  function saveHighScore() {
    try {
      localStorage.setItem('tetris_highscore', String(highScore));
    } catch (e) {
      // ignore localStorage errors
    }
  }

  function updateHighScore() {
    if (score > highScore) {
      highScore = score;
      saveHighScore();
      setHud();
    }
  }

  function pieceCells(p = active) {
    return SHAPES[p.shape][p.rot].map(([dx, dy]) => [p.x + dx, p.y + dy]);
  }

  function canPlace(p) {
    for (const [x, y] of pieceCells(p)) {
      if (x < 0 || x >= COLS || y >= ROWS) return false;
      if (y >= 0 && board[y][x]) return false;
    }
    return true;
  }

  function randomShape() {
    return Math.floor(Math.random() * SHAPES.length);
  }

  function roundRectPath(context, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + w, y, x + w, y + h, radius);
    context.arcTo(x + w, y + h, x, y + h, radius);
    context.arcTo(x, y + h, x, y, radius);
    context.arcTo(x, y, x + w, y, radius);
    context.closePath();
  }

  function fillRoundedCell(context, px, py, sizeW, sizeH, inset, radius) {
    const x = px + inset;
    const y = py + inset;
    const w = sizeW - inset * 2;
    const h = sizeH - inset * 2;
    roundRectPath(context, x, y, w, h, radius);
    context.fill();
  }

  function drawNext() {
    if (!nextCtx || nextShape == null) return;
    const w = nextCanvas.width;
    const h = nextCanvas.height;
    nextCtx.fillStyle = '#090a14';
    nextCtx.fillRect(0, 0, w, h);

    const cells = SHAPES[nextShape][0];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of cells) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    const boxW = maxX - minX + 1;
    const boxH = maxY - minY + 1;
    const grid = 4;
    const cell = Math.floor(Math.min(w / grid, h / grid));
    const r = Math.max(2, Math.floor(cell * 0.32));
    const offsetX = Math.floor((w - boxW * cell) / 2) - minX * cell;
    const offsetY = Math.floor((h - boxH * cell) / 2) - minY * cell;

    nextCtx.fillStyle = COLORS[nextShape];
    for (const [x, y] of cells) {
      fillRoundedCell(nextCtx, offsetX + x * cell, offsetY + y * cell, cell, cell, 1, r);
    }
  }

  function spawn() {
    if (nextShape == null) nextShape = randomShape();
    const shape = nextShape;
    nextShape = randomShape();
    drawNext();

    active = { shape, rot: 0, x: 3, y: 0 };
    if (!canPlace(active)) {
      gameOver = true;
      updateHighScore();
      stopFall();
    }
  }

  function clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (board[y].every((c) => c !== 0)) {
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(0));
        cleared++;
        y++;
      }
    }
    if (cleared > 0) {
      lines += cleared;
      score += LINE_POINTS[cleared] || 0;
      setHud();
    }
  }

  function lock() {
    const id = active.shape + 1;
    for (const [x, y] of pieceCells(active)) {
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) board[y][x] = id;
    }
    clearLines();
    spawn();
  }

  function move(dx, dy) {
    const next = { ...active, x: active.x + dx, y: active.y + dy };
    if (!canPlace(next)) return false;
    active = next;
    return true;
  }

  function rotateCW() {
    const nextRot = (active.rot + 1) % 4;
    const base = { ...active, rot: nextRot };
    const kicks = [0, -1, 1, -2, 2];
    for (const k of kicks) {
      const candidate = { ...base, x: base.x + k };
      if (canPlace(candidate)) {
        active = candidate;
        return true;
      }
    }
    return false;
  }

  function hardDrop() {
    while (move(0, 1)) {}
    lock();
  }

  function tick() {
    if (paused || gameOver) return;
    if (!move(0, 1)) lock();
    draw();
  }

  function startFall() {
    stopFall();
    fallTimer = setInterval(tick, FALL_MS);
  }

  function stopFall() {
    if (fallTimer) {
      clearInterval(fallTimer);
      fallTimer = null;
    }
  }

  function togglePause() {
    if (gameOver) return;
    paused = !paused;
    if (paused) stopFall();
    else startFall();
    draw();
  }

  function toggleHelp() {
    showHelp = !showHelp;
    draw();
  }

  function newGame() {
    stopFall();
    board = makeBoard();
    gameOver = false;
    paused = false;
    lines = 0;
    score = 0;
    nextShape = null;
    setHud();
    spawn();
    draw();
    if (!gameOver) startFall();
  }

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    const cellW = w / COLS;
    const cellH = h / ROWS;
    const inset = 1;
    const radius = Math.max(4, Math.floor(Math.min(cellW, cellH) * 0.34));

    ctx.fillStyle = '#090a14';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#20224a';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellW, 0);
      ctx.lineTo(x * cellW, h);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellH);
      ctx.lineTo(w, y * cellH);
      ctx.stroke();
    }

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const v = board[y][x];
        if (!v) continue;
        ctx.fillStyle = COLORS[v - 1];
        fillRoundedCell(ctx, x * cellW, y * cellH, cellW, cellH, inset, radius);
      }
    }

    if (!gameOver) {
      const ghost = { ...active };
      while (canPlace({ ...ghost, y: ghost.y + 1 })) ghost.y++;
      if (ghost.y !== active.y) {
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = COLORS[active.shape];
        for (const [x, y] of pieceCells(ghost)) {
          if (y < 0) continue;
          fillRoundedCell(ctx, x * cellW, y * cellH, cellW, cellH, inset, radius);
        }
        ctx.restore();
      }

      ctx.fillStyle = COLORS[active.shape];
      for (const [x, y] of pieceCells(active)) {
        if (y < 0) continue;
        fillRoundedCell(ctx, x * cellW, y * cellH, cellW, cellH, inset, radius);
      }
    }

    if (paused || gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff';
      ctx.font = '24px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(gameOver ? 'GAME OVER' : 'PAUSED', w / 2, h / 2);
    }

    if (showHelp) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      ctx.font = 'bold 20px system-ui';
      ctx.fillText('HOW TO PLAY', w / 2, 60);

      ctx.font = '15px system-ui';
      ctx.textAlign = 'left';
      let y = 100;
      const leftX = 30;
      const lineH = 22;

      ctx.fillText('← / → ARROW KEYS - MOVE PIECE LEFT/RIGHT', leftX, y);
      y += lineH;
      ctx.fillText('↑ ARROW KEY - ROTATE PIECE CLOCKWISE', leftX, y);
      y += lineH;
      ctx.fillText('↓ ARROW KEY - HARD DROP (INSTANT DROP)', leftX, y);
      y += lineH;
      ctx.fillText('P - PAUSE/RESUME GAME', leftX, y);
      y += lineH;
      ctx.fillText('SPACE - START NEW GAME', leftX, y);
      y += lineH;
      ctx.fillText('F1 - SHOW/HIDE THIS HELP', leftX, y);
      y += lineH;

      y += 20;
      ctx.font = 'bold 16px system-ui';
      ctx.fillText('SCORING', leftX, y);
      y += 26;

      ctx.font = '15px system-ui';
      ctx.fillText('CLEAR 1 LINE: 100 POINTS', leftX, y);
      y += lineH;
      ctx.fillText('CLEAR 2 LINES: 300 POINTS', leftX, y);
      y += lineH;
      ctx.fillText('CLEAR 3 LINES: 500 POINTS', leftX, y);
      y += lineH;
      ctx.fillText('CLEAR 4 LINES: 800 POINTS', leftX, y);
      y += lineH;

      y += 30;
      ctx.textAlign = 'center';
      ctx.font = 'italic 14px system-ui';
      ctx.fillStyle = '#aaa';
      ctx.fillText('PRESS F1 OR ESC TO CLOSE', w / 2, y);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'F1') {
      e.preventDefault();
      toggleHelp();
      return;
    }
    if (e.key === 'Escape' && showHelp) {
      e.preventDefault();
      showHelp = false;
      draw();
      return;
    }
    if (showHelp) return;

    if (e.key === ' ') {
      e.preventDefault();
      newGame();
      return;
    }
    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      togglePause();
      return;
    }
    if (paused || gameOver) return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        move(-1, 0);
        draw();
        break;
      case 'ArrowRight':
        e.preventDefault();
        move(1, 0);
        draw();
        break;
      case 'ArrowUp':
        e.preventDefault();
        rotateCW();
        draw();
        break;
      case 'ArrowDown':
        e.preventDefault();
        hardDrop();
        draw();
        break;
    }
  }

  loadHighScore();
  newGameBtn.addEventListener('click', newGame);
  document.addEventListener('keydown', onKeyDown);
  newGame();
})();

