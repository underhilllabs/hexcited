"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreNode = document.getElementById("score");
const livesNode = document.getElementById("lives");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlayText");
const startButton = document.getElementById("startButton");
const muteButton = document.getElementById("muteButton");

const W = canvas.width;
const H = canvas.height;
const GROUND_Y = 468;
const LEVEL_W = 4280;
const FLIGHT_W = 3900;
const FIXED_STEP = 1 / 60;
const KEYS = new Set();
const PRESSED = new Set();

const COLORS = {
  skyTop: "#10152f",
  skyBottom: "#2b1729",
  moon: "#f6e6a8",
  hillFar: "#26264a",
  hillNear: "#172735",
  fog: "rgba(213, 194, 174, 0.09)",
  groundTop: "#5b3a2a",
  ground: "#2c1d20",
  grass: "#7f8d45",
  pumpkin: "#f39128",
  pumpkinGlow: "#ffd071",
  cat: "#050508",
  catHi: "#20202a",
  eye: "#ffe36c",
  witch: "#8ad6c9",
  enemy: "#f4e8c5"
};

const solids = [
  rect(0, GROUND_Y, LEVEL_W, 90),
  rect(260, 394, 230, 24),
  rect(610, 338, 250, 24),
  rect(980, 416, 210, 24),
  rect(1340, 356, 260, 24),
  rect(1710, 292, 210, 24),
  rect(2050, 414, 280, 24),
  rect(2490, 360, 250, 24),
  rect(2890, 306, 230, 24),
  rect(3220, 405, 270, 24),
  rect(3710, 350, 270, 24),
  rect(1550, 432, 70, 36),
  rect(2340, 432, 70, 36),
  rect(3535, 432, 70, 36)
];

const pumpkinSpawns = [
  [320, 352], [395, 352], [695, 296], [775, 296], [1070, 374],
  [1435, 314], [1520, 314], [1785, 250], [2140, 372], [2220, 372],
  [2580, 318], [2660, 318], [2985, 264], [3300, 363], [3380, 363],
  [3790, 308], [3880, 308]
];

const enemySpawns = [
  { x: 720, y: 300, min: 620, max: 840 },
  { x: 1440, y: 318, min: 1350, max: 1590 },
  { x: 2180, y: 376, min: 2050, max: 2310 },
  { x: 3020, y: 268, min: 2890, max: 3100 },
  { x: 3340, y: 368, min: 3220, max: 3470 }
];

const playerStart = { x: 70, y: 320 };
const goal = rect(4070, 330, 80, 138);

const flightPumpkinSpawns = [
  [360, 150], [470, 238], [625, 112], [800, 300], [1010, 198],
  [1165, 96], [1390, 265], [1545, 164], [1775, 324], [1970, 118],
  [2180, 222], [2390, 148], [2580, 312], [2820, 188], [3030, 96],
  [3230, 258], [3420, 166]
];

const duckSpawns = [
  { x: 620, y: 230, formation: 0 },
  { x: 1120, y: 150, formation: 1 },
  { x: 1600, y: 285, formation: 2 },
  { x: 2120, y: 185, formation: 0 },
  { x: 2650, y: 255, formation: 1 },
  { x: 3150, y: 150, formation: 2 }
];

let game;

function rect(x, y, w, h) {
  return { x, y, w, h };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function consume(key) {
  if (PRESSED.has(key)) {
    PRESSED.delete(key);
    return true;
  }
  return false;
}

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.muted = false;
    this.started = false;
    this.nextNote = 0;
    this.noteIndex = 0;
    this.timer = null;
    this.notes = [220, 261.63, 293.66, 329.63, 293.66, 261.63, 196, 246.94, 220, 329.63, 392, 329.63, 293.66, 246.94, 220, 196];
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.65;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.11;
    this.musicGain.connect(this.master);
  }

  start() {
    this.init();
    if (!this.ctx || this.started) return;
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.started = true;
    this.nextNote = this.ctx.currentTime;
    this.timer = window.setInterval(() => this.scheduleMusic(), 80);
  }

  setMuted(muted) {
    this.muted = muted;
    muteButton.textContent = muted ? "Muted" : "Sound";
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.65, this.ctx.currentTime, 0.03);
  }

  toggleMute() {
    this.setMuted(!this.muted);
  }

  scheduleMusic() {
    if (!this.ctx || this.muted) return;
    while (this.nextNote < this.ctx.currentTime + 0.22) {
      const freq = this.notes[this.noteIndex % this.notes.length];
      const t = this.nextNote;
      this.tone(freq, 0.16, "triangle", this.musicGain, t, 0.035);
      if (this.noteIndex % 4 === 0) this.tone(freq / 2, 0.28, "sine", this.musicGain, t, 0.03);
      this.nextNote += 0.18;
      this.noteIndex += 1;
    }
  }

  tone(freq, duration, type, destination, start = null, volume = 0.2, bend = 1) {
    if (!this.ctx || this.muted) return;
    const t = start === null ? this.ctx.currentTime : start;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (bend !== 1) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * bend), t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(destination || this.master);
    osc.start(t);
    osc.stop(t + duration + 0.03);
  }

  noise(duration, volume, filterFreq) {
    if (!this.ctx || this.muted) return;
    const samples = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, samples, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < samples; i += 1) data[i] = Math.random() * 2 - 1;
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  jump() {
    this.tone(330, 0.16, "square", this.master, undefined, 0.1, 1.7);
  }

  collect() {
    const now = this.ctx ? this.ctx.currentTime : 0;
    this.tone(660, 0.09, "triangle", this.master, now, 0.12, 1.25);
    this.tone(990, 0.11, "triangle", this.master, now + 0.07, 0.09, 1.2);
  }

  stomp() {
    this.tone(190, 0.1, "sawtooth", this.master, undefined, 0.13, 0.55);
    this.noise(0.05, 0.07, 900);
  }

  hurt() {
    this.tone(220, 0.24, "sawtooth", this.master, undefined, 0.13, 0.45);
    this.noise(0.12, 0.08, 600);
  }

  win() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((n, i) => this.tone(n, 0.34, "triangle", this.master, t + i * 0.11, 0.16, 1.03));
  }
}

class Player {
  constructor() {
    this.w = 38;
    this.h = 42;
    this.reset(true);
  }

  reset(full = false) {
    this.x = playerStart.x;
    this.y = playerStart.y;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.grounded = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.invuln = full ? 0 : 1.2;
    this.hurtTimer = 0;
    this.anim = 0;
    this.squash = 0;
  }

  box() {
    return rect(this.x + 5, this.y + 3, this.w - 10, this.h - 3);
  }

  update(dt, game) {
    const left = KEYS.has("ArrowLeft") || KEYS.has("KeyA");
    const right = KEYS.has("ArrowRight") || KEYS.has("KeyD");
    const jumpHeld = KEYS.has("Space") || KEYS.has("ArrowUp") || KEYS.has("KeyW");
    const jumpPressed = consume("Space") || consume("ArrowUp") || consume("KeyW");
    const axis = (right ? 1 : 0) - (left ? 1 : 0);
    const maxSpeed = this.grounded ? 242 : 228;
    const accel = this.grounded ? 1700 : 950;
    const friction = this.grounded ? 1650 : 210;

    if (jumpPressed) this.jumpBuffer = 0.12;
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.coyote = this.grounded ? 0.095 : Math.max(0, this.coyote - dt);
    if (axis) {
      this.vx += axis * accel * dt;
      this.facing = axis;
    } else {
      const amount = friction * dt;
      this.vx = Math.abs(this.vx) <= amount ? 0 : this.vx - Math.sign(this.vx) * amount;
    }
    this.vx = clamp(this.vx, -maxSpeed, maxSpeed);

    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = -548;
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.squash = 1;
      game.audio.jump();
      game.burst(this.x + this.w / 2, this.y + this.h, 9, "#d4c4a0", 90);
      game.shake(2.5);
    }

    if (!jumpHeld && this.vy < -160) this.vy += 1450 * dt;
    this.vy += 1660 * dt;
    this.vy = Math.min(this.vy, 760);

    this.moveX(this.vx * dt);
    const wasGrounded = this.grounded;
    this.grounded = false;
    this.moveY(this.vy * dt);
    if (!wasGrounded && this.grounded && this.vy >= 0) {
      game.burst(this.x + this.w / 2, this.y + this.h, 7, "#b79f72", 70);
      game.shake(Math.min(4, Math.abs(this.vy) / 170));
      this.squash = Math.max(this.squash, 0.75);
    }

    this.x = clamp(this.x, 0, LEVEL_W - this.w);
    if (this.y > H + 280) game.damagePlayer(-this.facing || -1, true);

    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.squash = Math.max(0, this.squash - dt * 4);
    this.anim += dt * (Math.abs(this.vx) > 8 && this.grounded ? 10 : 4);
  }

  moveX(dx) {
    this.x += dx;
    const box = this.box();
    for (const solid of solids) {
      if (!intersects(box, solid)) continue;
      if (dx > 0) this.x = solid.x - this.w + 5;
      if (dx < 0) this.x = solid.x + solid.w - 5;
      this.vx = 0;
      box.x = this.x + 5;
    }
  }

  moveY(dy) {
    this.y += dy;
    const box = this.box();
    for (const solid of solids) {
      if (!intersects(box, solid)) continue;
      if (dy > 0) {
        this.y = solid.y - this.h;
        this.grounded = true;
      }
      if (dy < 0) this.y = solid.y + solid.h - 3;
      this.vy = 0;
      box.y = this.y + 3;
    }
  }

  draw(ctx, cam, game) {
    const sx = this.x - cam.x;
    const sy = this.y - cam.y;
    const blink = this.invuln > 0 && Math.floor(game.time * 18) % 2 === 0;
    if (blink) return;

    ctx.save();
    ctx.translate(sx + this.w / 2, sy + this.h / 2);
    ctx.scale(this.facing, 1);
    const runBob = this.grounded ? Math.sin(this.anim) * 1.6 : 0;
    const stretch = this.squash;
    ctx.scale(1 + stretch * 0.08, 1 - stretch * 0.08);
    ctx.translate(0, runBob);

    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(0, 24, 24, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.cat;
    ctx.strokeStyle = COLORS.catHi;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 7, 16, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(1, -10, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-11, -22);
    ctx.lineTo(-5, -39);
    ctx.lineTo(2, -22);
    ctx.moveTo(8, -22);
    ctx.lineTo(16, -37);
    ctx.lineTo(18, -19);
    ctx.fill();
    ctx.stroke();

    const leg = this.grounded ? Math.sin(this.anim) * 5 : 2;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.strokeStyle = COLORS.cat;
    ctx.beginPath();
    ctx.moveTo(-8, 22);
    ctx.lineTo(-12 + leg, 31);
    ctx.moveTo(8, 22);
    ctx.lineTo(12 - leg, 31);
    ctx.stroke();

    ctx.beginPath();
    const tailLift = this.grounded ? Math.sin(this.anim * 0.7) * 5 : -8;
    ctx.moveTo(-13, 4);
    ctx.bezierCurveTo(-34, -2 + tailLift, -33, -26 + tailLift, -14, -23 + tailLift);
    ctx.stroke();

    ctx.fillStyle = COLORS.eye;
    ctx.beginPath();
    ctx.ellipse(-5, -12, 3.5, 5, -0.15, 0, Math.PI * 2);
    ctx.ellipse(8, -12, 3.5, 5, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#211809";
    ctx.fillRect(-5.5, -15, 1.5, 6);
    ctx.fillRect(7.5, -15, 1.5, 6);

    ctx.fillStyle = "#c79bd5";
    ctx.beginPath();
    ctx.arc(2, -4, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class Enemy {
  constructor(spawn) {
    Object.assign(this, spawn);
    this.w = 42;
    this.h = 38;
    this.vx = 68;
    this.dead = false;
    this.deadTimer = 0;
    this.anim = 0;
  }

  box() {
    return rect(this.x, this.y, this.w, this.h);
  }

  update(dt) {
    if (this.dead) {
      this.deadTimer -= dt;
      return;
    }
    this.x += this.vx * dt;
    if (this.x < this.min) {
      this.x = this.min;
      this.vx = Math.abs(this.vx);
    }
    if (this.x + this.w > this.max) {
      this.x = this.max - this.w;
      this.vx = -Math.abs(this.vx);
    }
    this.anim += dt * 7;
  }

  draw(ctx, cam) {
    const sx = this.x - cam.x;
    const sy = this.y - cam.y;
    ctx.save();
    ctx.translate(sx + this.w / 2, sy + this.h / 2);
    if (this.dead) ctx.scale(1, 0.25);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(0, 21, 25, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.enemy;
    ctx.strokeStyle = "#57463e";
    ctx.lineWidth = 2;
    roundedRect(ctx, -18, -12, 36, 31, 9);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#583a34";
    ctx.fillRect(-20, -24, 40, 9);
    ctx.fillRect(-11, -36, 22, 16);
    ctx.fillStyle = "#261b1d";
    ctx.fillRect(-10, -3, 6, 3);
    ctx.fillRect(5, -3, 6, 3);
    ctx.strokeStyle = "#b5703e";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-14, 10);
    ctx.lineTo(-6 + Math.sin(this.anim) * 4, 22);
    ctx.moveTo(13, 10);
    ctx.lineTo(5 - Math.sin(this.anim) * 4, 22);
    ctx.stroke();
    ctx.restore();
  }
}

class Pumpkin {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 24;
    this.h = 24;
    this.got = false;
    this.phase = Math.random() * Math.PI * 2;
  }

  box() {
    return rect(this.x, this.y, this.w, this.h);
  }

  draw(ctx, cam, time) {
    if (this.got) return;
    const bob = Math.sin(time * 4 + this.phase) * 4;
    const sx = this.x - cam.x + this.w / 2;
    const sy = this.y - cam.y + this.h / 2 + bob;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.shadowColor = COLORS.pumpkinGlow;
    ctx.shadowBlur = 12;
    ctx.fillStyle = COLORS.pumpkin;
    ctx.beginPath();
    ctx.ellipse(-5, 2, 8, 10, -0.1, 0, Math.PI * 2);
    ctx.ellipse(5, 2, 8, 10, 0.1, 0, Math.PI * 2);
    ctx.ellipse(0, 2, 9, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#5d672a";
    ctx.fillRect(-2, -11, 5, 7);
    ctx.fillStyle = "#321612";
    ctx.fillRect(-5, 0, 3, 3);
    ctx.fillRect(4, 0, 3, 3);
    ctx.fillRect(-1, 7, 5, 2);
    ctx.restore();
  }
}

class Duck {
  constructor(spawn) {
    Object.assign(this, spawn);
    this.w = 42;
    this.h = 30;
    this.phase = Math.random() * Math.PI * 2;
    this.speed = 92 + spawn.formation * 14;
  }

  members(time) {
    const offsets = [
      [[0, 0], [54, -24], [54, 24], [108, -48], [108, 48]],
      [[0, 0], [58, -34], [116, -68], [58, 34], [116, 68]],
      [[0, 0], [62, 0], [124, 0], [186, -30], [186, 30]]
    ][this.formation];
    const wave = Math.sin(time * 3.5 + this.phase) * 10;
    return offsets.map(([ox, oy], index) => rect(this.x + ox, this.y + oy + wave + Math.sin(time * 5 + index) * 5, this.w, this.h));
  }

  update(dt) {
    this.x -= this.speed * dt;
  }

  draw(ctx, cam, time) {
    for (const member of this.members(time)) {
      const sx = member.x - cam.x;
      const sy = member.y - cam.y;
      const flap = Math.sin(time * 14 + member.x * 0.02) * 7;
      ctx.save();
      ctx.translate(sx + this.w / 2, sy + this.h / 2);
      ctx.scale(-1, 1);
      ctx.fillStyle = "rgba(0,0,0,0.13)";
      ctx.beginPath();
      ctx.ellipse(0, 21, 22, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f1d066";
      ctx.beginPath();
      ctx.ellipse(0, 0, 17, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f6e59a";
      ctx.beginPath();
      ctx.arc(16, -5, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e77a31";
      ctx.beginPath();
      ctx.moveTo(24, -4);
      ctx.lineTo(36, 0);
      ctx.lineTo(24, 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#d49d37";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-5, -1);
      ctx.quadraticCurveTo(-24, -16 - flap, -35, -2);
      ctx.moveTo(-5, 3);
      ctx.quadraticCurveTo(-23, 17 + flap, -33, 4);
      ctx.stroke();
      ctx.fillStyle = "#171118";
      ctx.fillRect(16, -8, 2, 2);
      ctx.restore();
    }
  }
}

class Particle {
  constructor(x, y, color, speed) {
    const angle = Math.random() * Math.PI * 2;
    const mag = Math.random() * speed;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * mag;
    this.vy = Math.sin(angle) * mag - speed * 0.25;
    this.color = color;
    this.life = 0.4 + Math.random() * 0.45;
    this.maxLife = this.life;
    this.size = 2 + Math.random() * 4;
  }

  update(dt) {
    this.life -= dt;
    this.vy += 480 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx, cam) {
    const alpha = clamp(this.life / this.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x - cam.x, this.y - cam.y, this.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

class Game {
  constructor() {
    this.audio = new AudioEngine();
    this.level = 1;
    this.player = new Player();
    this.enemies = enemySpawns.map((spawn) => new Enemy(spawn));
    this.pumpkins = pumpkinSpawns.map(([x, y]) => new Pumpkin(x, y));
    this.flightPumpkins = [];
    this.ducks = [];
    this.flight = null;
    this.particles = [];
    this.camera = { x: 0, y: 0 };
    this.score = 0;
    this.lives = 3;
    this.state = "start";
    this.time = 0;
    this.hitstop = 0;
    this.shakeAmount = 0;
    this.flash = 0;
    this.last = 0;
    this.accumulator = 0;
    this.syncHud();
    requestAnimationFrame((stamp) => this.loop(stamp));
  }

  start() {
    if (this.state === "win" || this.state === "gameover") this.restart();
    if (this.state === "level2intro") {
      this.state = "play";
      overlay.hidden = true;
      this.audio.start();
      return;
    }
    this.state = "play";
    overlay.hidden = true;
    this.audio.start();
  }

  restart() {
    this.level = 1;
    this.player.reset(true);
    this.enemies = enemySpawns.map((spawn) => new Enemy(spawn));
    this.pumpkins = pumpkinSpawns.map(([x, y]) => new Pumpkin(x, y));
    this.flightPumpkins = [];
    this.ducks = [];
    this.flight = null;
    this.particles = [];
    this.camera.x = 0;
    this.score = 0;
    this.lives = 3;
    this.hitstop = 0;
    this.flash = 0;
    this.syncHud();
  }

  initFlightLevel() {
    this.level = 2;
    this.camera.x = 0;
    this.camera.y = 0;
    this.flight = {
      x: 85,
      y: 250,
      w: 92,
      h: 44,
      vx: 210,
      vy: 0,
      invuln: 1.1,
      anim: 0,
      bob: 0
    };
    this.flightPumpkins = flightPumpkinSpawns.map(([x, y]) => new Pumpkin(x, y));
    this.ducks = duckSpawns.map((spawn) => new Duck(spawn));
    this.particles = [];
  }

  pause() {
    if (this.state === "play") {
      this.state = "pause";
      this.showOverlay("Paused. Press P or Enter to keep going.", "Resume");
    } else if (this.state === "pause") {
      this.state = "play";
      overlay.hidden = true;
    }
  }

  showOverlay(text, buttonText) {
    overlayText.textContent = text;
    startButton.textContent = buttonText;
    overlay.hidden = false;
  }

  syncHud() {
    scoreNode.textContent = String(this.score);
    livesNode.textContent = String(this.lives);
  }

  loop(stamp) {
    const now = stamp / 1000;
    const frame = Math.min(0.05, now - (this.last || now));
    this.last = now;
    this.accumulator += frame;
    while (this.accumulator >= FIXED_STEP) {
      this.update(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
    }
    this.draw();
    requestAnimationFrame((next) => this.loop(next));
  }

  update(dt) {
    this.time += dt;
    this.shakeAmount = Math.max(0, this.shakeAmount - dt * 18);
    this.flash = Math.max(0, this.flash - dt * 2.6);
    if (this.state !== "play") {
      this.updateCamera(dt);
      return;
    }
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }

    if (this.level === 2) {
      this.updateFlight(dt);
      return;
    }

    this.player.update(dt, this);
    this.enemies.forEach((enemy) => enemy.update(dt));
    this.particles.forEach((particle) => particle.update(dt));
    this.particles = this.particles.filter((particle) => particle.life > 0);
    this.collectPumpkins();
    this.checkEnemies();
    this.checkGoal();
    this.updateCamera(dt);
  }

  updateCamera(dt) {
    if (this.level === 2 && this.flight) {
      const targetX = clamp(this.flight.x - W * 0.28, 0, FLIGHT_W - W);
      this.camera.x = lerp(this.camera.x, targetX, 1 - Math.pow(0.001, dt));
      this.camera.y = 0;
      return;
    }
    const targetX = clamp(this.player.x + this.player.w / 2 - W * 0.43 + this.player.facing * 68, 0, LEVEL_W - W);
    this.camera.x = lerp(this.camera.x, targetX, 1 - Math.pow(0.001, dt));
    this.camera.y = 0;
  }

  updateFlight(dt) {
    const left = KEYS.has("ArrowLeft") || KEYS.has("KeyA");
    const right = KEYS.has("ArrowRight") || KEYS.has("KeyD");
    const up = KEYS.has("ArrowUp") || KEYS.has("KeyW") || KEYS.has("Space");
    const down = KEYS.has("ArrowDown") || KEYS.has("KeyS");
    const axisX = (right ? 1 : 0) - (left ? 1 : 0);
    const axisY = (down ? 1 : 0) - (up ? 1 : 0);
    const baseSpeed = 205;
    const accel = 780;
    const drag = 0.9;

    this.flight.vx = lerp(this.flight.vx, baseSpeed + axisX * 126, 1 - Math.pow(0.001, dt));
    this.flight.vy += axisY * accel * dt;
    this.flight.vy *= Math.pow(drag, dt * 8);
    this.flight.vy = clamp(this.flight.vy, -255, 255);
    this.flight.x += this.flight.vx * dt;
    this.flight.y += this.flight.vy * dt;
    this.flight.y = clamp(this.flight.y, 72, H - 112);
    this.flight.x = clamp(this.flight.x, 0, FLIGHT_W - this.flight.w);
    this.flight.invuln = Math.max(0, this.flight.invuln - dt);
    this.flight.anim += dt;

    for (const duck of this.ducks) {
      duck.update(dt);
      if (duck.x < this.camera.x - 260) {
        duck.x += 1220 + Math.random() * 380;
        duck.y = 105 + Math.random() * 235;
      }
    }

    this.particles.forEach((particle) => particle.update(dt));
    this.particles = this.particles.filter((particle) => particle.life > 0);
    this.collectFlightPumpkins();
    this.checkDucks();
    this.checkRainbow();
    this.updateCamera(dt);

    if (Math.random() < 0.38) {
      this.particles.push(new Particle(this.flight.x + 18, this.flight.y + 30, "rgba(198,231,255,0.75)", 55));
    }
  }

  collectPumpkins() {
    const box = this.player.box();
    for (const pumpkin of this.pumpkins) {
      if (pumpkin.got || !intersects(box, pumpkin.box())) continue;
      pumpkin.got = true;
      this.score += 1;
      this.syncHud();
      this.audio.collect();
      this.burst(pumpkin.x + pumpkin.w / 2, pumpkin.y + pumpkin.h / 2, 16, COLORS.pumpkinGlow, 155);
      this.shake(1.4);
    }
  }

  flightBox() {
    return rect(this.flight.x + 10, this.flight.y + 7, this.flight.w - 18, this.flight.h - 13);
  }

  collectFlightPumpkins() {
    const box = this.flightBox();
    for (const pumpkin of this.flightPumpkins) {
      if (pumpkin.got || !intersects(box, pumpkin.box())) continue;
      pumpkin.got = true;
      this.score += 1;
      this.syncHud();
      this.audio.collect();
      this.burst(pumpkin.x + pumpkin.w / 2, pumpkin.y + pumpkin.h / 2, 18, COLORS.pumpkinGlow, 170);
      this.shake(1.8);
    }
  }

  checkDucks() {
    if (this.flight.invuln > 0) return;
    const box = this.flightBox();
    for (const duck of this.ducks) {
      for (const member of duck.members(this.time)) {
        if (intersects(box, member)) {
          this.damageFlight();
          return;
        }
      }
    }
  }

  checkRainbow() {
    if (this.flight.x + this.flight.w < FLIGHT_W - 210) return;
    this.state = "win";
    this.audio.win();
    this.burst(this.flight.x + this.flight.w / 2, this.flight.y + 20, 60, "#fff6cc", 310);
    this.burst(this.flight.x + this.flight.w / 2, this.flight.y + 20, 40, "#ff7dc8", 260);
    this.shake(11);
    this.showOverlay("Hexie and Wendy reached the rainbow with a broomful of pumpkins.", "Play again");
  }

  checkEnemies() {
    const pbox = this.player.box();
    for (const enemy of this.enemies) {
      if (enemy.dead || !intersects(pbox, enemy.box())) continue;
      const playerBottom = pbox.y + pbox.h;
      const stompWindow = playerBottom - enemy.y;
      if (this.player.vy > 80 && stompWindow < 18) {
        enemy.dead = true;
        enemy.deadTimer = 0.45;
        this.player.vy = -390;
        this.hitstop = 0.055;
        this.audio.stomp();
        this.burst(enemy.x + enemy.w / 2, enemy.y + 10, 20, "#fff0bd", 190);
        this.shake(7);
      } else {
        this.damagePlayer(this.player.x < enemy.x ? -1 : 1, false);
      }
    }
  }

  checkGoal() {
    if (intersects(this.player.box(), goal)) {
      this.initFlightLevel();
      this.state = "level2intro";
      this.audio.win();
      this.burst(150, 250, 46, COLORS.witch, 260);
      this.shake(9);
      this.showOverlay("Wendy hops onto her broomstick. Level 2: fly together, dodge duck formations, collect floating pumpkins, and reach the big rainbow.", "Fly");
    }
  }

  damageFlight() {
    if (this.flight.invuln > 0) return;
    this.lives -= 1;
    this.syncHud();
    this.flight.invuln = 1.45;
    this.flight.vx = 110;
    this.flight.vy = -150;
    this.hitstop = 0.08;
    this.flash = 0.45;
    this.audio.hurt();
    this.burst(this.flight.x + this.flight.w / 2, this.flight.y + 20, 24, "#f06b5e", 220);
    this.shake(10);

    if (this.lives <= 0) {
      this.state = "gameover";
      this.showOverlay("The duck formation caught Hexie and Wendy. Press Start to try again.", "Restart");
    }
  }

  damagePlayer(direction, fell) {
    if (!fell && this.player.invuln > 0) return;
    this.lives -= 1;
    this.syncHud();
    this.player.invuln = 1.35;
    this.player.hurtTimer = 0.3;
    this.player.vx = direction * 250;
    this.player.vy = -320;
    this.hitstop = 0.08;
    this.flash = 0.45;
    this.audio.hurt();
    this.burst(this.player.x + this.player.w / 2, this.player.y + 20, 18, "#f06b5e", 185);
    this.shake(10);

    if (this.lives <= 0) {
      this.state = "gameover";
      this.showOverlay("Hexie was sent to etiquette class. Press Start to try the rescue again.", "Restart");
    } else if (fell) {
      this.player.reset();
    }
  }

  burst(x, y, count, color, speed) {
    for (let i = 0; i < count; i += 1) this.particles.push(new Particle(x, y, color, speed));
  }

  shake(amount) {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
  }

  draw() {
    const shakeX = (Math.random() - 0.5) * this.shakeAmount;
    const shakeY = (Math.random() - 0.5) * this.shakeAmount;
    if (this.level === 2 && this.flight) {
      this.drawFlight(shakeX, shakeY);
      return;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);
    this.drawBackground();
    ctx.save();
    ctx.translate(-this.camera.x, -this.camera.y);
    this.drawLevel();
    this.drawGoal();
    ctx.restore();
    this.pumpkins.forEach((pumpkin) => pumpkin.draw(ctx, this.camera, this.time));
    this.enemies.forEach((enemy) => enemy.draw(ctx, this.camera));
    this.player.draw(ctx, this.camera, this);
    this.particles.forEach((particle) => particle.draw(ctx, this.camera));
    ctx.restore();
    if (this.flash > 0) {
      ctx.globalAlpha = this.flash * 0.35;
      ctx.fillStyle = "#f34f48";
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    this.drawVignette();
  }

  drawFlight(shakeX, shakeY) {
    ctx.save();
    ctx.translate(shakeX, shakeY);
    this.drawFlightBackground();
    ctx.save();
    ctx.translate(-this.camera.x, 0);
    this.drawRainbow(FLIGHT_W - 160, 272);
    ctx.restore();
    this.flightPumpkins.forEach((pumpkin) => pumpkin.draw(ctx, this.camera, this.time));
    this.ducks.forEach((duck) => duck.draw(ctx, this.camera, this.time));
    this.drawBroomTeam();
    this.particles.forEach((particle) => particle.draw(ctx, this.camera));
    ctx.restore();
    if (this.flash > 0) {
      ctx.globalAlpha = this.flash * 0.35;
      ctx.fillStyle = "#f34f48";
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    this.drawVignette();
  }

  drawFlightBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#16305e");
    grad.addColorStop(0.48, "#5d74aa");
    grad.addColorStop(1, "#f4b36c");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,246,204,0.82)";
    ctx.beginPath();
    ctx.arc(100 - this.camera.x * 0.04, 92, 34, 0, Math.PI * 2);
    ctx.fill();

    this.drawStars(0.08, 18, "#fff6cc");
    this.drawCloudLayer(0.16, 128, 0.28);
    this.drawCloudLayer(0.31, 238, 0.44);
    this.drawCloudLayer(0.52, 392, 0.6);
  }

  drawCloudLayer(rate, baseY, alpha) {
    ctx.fillStyle = `rgba(255, 245, 222, ${alpha})`;
    for (let i = 0; i < 9; i += 1) {
      const x = ((i * 280 - this.camera.x * rate + this.time * 12 * rate) % 1400) - 210;
      const y = baseY + Math.sin(i * 1.7 + this.time) * 18;
      ctx.beginPath();
      ctx.ellipse(x, y, 54, 19, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 43, y - 8, 62, 24, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 98, y, 50, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawBroomTeam() {
    const sx = this.flight.x - this.camera.x;
    const sy = this.flight.y;
    const blink = this.flight.invuln > 0 && Math.floor(this.time * 18) % 2 === 0;
    if (blink) return;

    ctx.save();
    ctx.translate(sx + 46, sy + 22);
    ctx.rotate(Math.sin(this.time * 5) * 0.03 + this.flight.vy * 0.0009);
    ctx.strokeStyle = "#7b4b2f";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-45, 18);
    ctx.lineTo(54, 10);
    ctx.stroke();
    ctx.strokeStyle = "#d69b4c";
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i += 1) {
      ctx.beginPath();
      ctx.moveTo(46, 10);
      ctx.lineTo(72, -5 + i * 4);
      ctx.stroke();
    }

    this.drawHexieRider(-12, -2);
    this.drawWendyRider(24, -8);

    ctx.fillStyle = "rgba(198,231,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(-56, 21, 20 + Math.sin(this.time * 12) * 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawHexieRider(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = COLORS.cat;
    ctx.strokeStyle = COLORS.catHi;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 8, 13, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -6, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-8, -15);
    ctx.lineTo(-4, -29);
    ctx.lineTo(2, -16);
    ctx.moveTo(6, -16);
    ctx.lineTo(13, -28);
    ctx.lineTo(14, -13);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = COLORS.cat;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-9, 6);
    ctx.bezierCurveTo(-30, 2, -26, -17, -11, -17);
    ctx.stroke();
    ctx.fillStyle = COLORS.eye;
    ctx.beginPath();
    ctx.ellipse(-4, -7, 2.5, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(6, -7, 2.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawWendyRider(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = "#f7f0d5";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-5, 18);
    ctx.lineTo(-6, 31);
    ctx.moveTo(6, 18);
    ctx.lineTo(7, 31);
    ctx.stroke();
    ctx.strokeStyle = "#d94b43";
    ctx.lineWidth = 2.5;
    for (let stripe = 21; stripe <= 29; stripe += 5) {
      ctx.beginPath();
      ctx.moveTo(-6, stripe);
      ctx.lineTo(-5, stripe + 2);
      ctx.moveTo(7, stripe);
      ctx.lineTo(8, stripe + 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#5f4a9a";
    ctx.beginPath();
    ctx.ellipse(0, 9, 15, 21, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f2dfbd";
    ctx.beginPath();
    ctx.arc(0, -8, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#241431";
    ctx.beginPath();
    ctx.moveTo(-40, -13);
    ctx.quadraticCurveTo(-11, -26, 0, -68);
    ctx.quadraticCurveTo(12, -29, 40, -13);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffcf62";
    ctx.beginPath();
    ctx.ellipse(0, -15, 43, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#151019";
    ctx.fillRect(-4, -9, 2, 3);
    ctx.fillRect(4, -9, 2, 3);
    ctx.restore();
  }

  drawRainbow(x, y) {
    const colors = ["#f24b57", "#f58b34", "#ffe05f", "#61d46f", "#52a7f7", "#9b6af7"];
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 0; i < colors.length; i += 1) {
      ctx.strokeStyle = colors[i];
      ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.arc(x, y, 148 - i * 17, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.beginPath();
    ctx.ellipse(x - 145, y + 6, 52, 24, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 145, y + 6, 52, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff6cc";
    ctx.font = "900 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Rainbow!", x, y - 166);
    ctx.restore();
  }

  drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, COLORS.skyTop);
    grad.addColorStop(0.58, COLORS.skyBottom);
    grad.addColorStop(1, "#111015");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = COLORS.moon;
    ctx.beginPath();
    ctx.arc(720 - this.camera.x * 0.08, 95, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(16,21,47,0.45)";
    ctx.beginPath();
    ctx.arc(704 - this.camera.x * 0.08, 86, 42, 0, Math.PI * 2);
    ctx.fill();

    this.drawStars(0.12, 32, "#fff6cc");
    this.drawHills(0.18, 380, COLORS.hillFar, 90);
    this.drawHills(0.32, 425, COLORS.hillNear, 68);
    this.drawTrees(0.48);

    ctx.fillStyle = COLORS.fog;
    for (let i = 0; i < 6; i += 1) {
      const x = ((i * 250 - this.camera.x * 0.22 + this.time * 12) % 1300) - 160;
      ctx.beginPath();
      ctx.ellipse(x, 410 + Math.sin(i) * 12, 140, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawStars(rate, count, color) {
    ctx.fillStyle = color;
    for (let i = 0; i < count; i += 1) {
      const x = (i * 181 + 80 - this.camera.x * rate) % (W + 80);
      const y = 35 + ((i * 47) % 180);
      const twinkle = 0.45 + Math.sin(this.time * 2 + i) * 0.3;
      ctx.globalAlpha = twinkle;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  drawHills(rate, base, color, height) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = -80; x <= W + 100; x += 120) {
      const world = x + this.camera.x * rate;
      const y = base - Math.sin(world * 0.006) * height - Math.cos(world * 0.011) * 24;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  drawTrees(rate) {
    ctx.fillStyle = "#101820";
    for (let i = 0; i < 22; i += 1) {
      const x = (i * 205 - this.camera.x * rate) % (W + 240) - 120;
      const h = 65 + (i % 4) * 18;
      ctx.fillRect(x - 5, 398 - h, 10, h);
      ctx.beginPath();
      ctx.moveTo(x, 310 - h * 0.2);
      ctx.lineTo(x - 30, 405 - h);
      ctx.lineTo(x + 30, 405 - h);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawLevel() {
    solids.forEach((solid) => {
      ctx.fillStyle = COLORS.ground;
      ctx.fillRect(solid.x, solid.y, solid.w, solid.h);
      ctx.fillStyle = COLORS.groundTop;
      ctx.fillRect(solid.x, solid.y, solid.w, Math.min(12, solid.h));
      ctx.fillStyle = COLORS.grass;
      ctx.fillRect(solid.x, solid.y, solid.w, 5);
      ctx.fillStyle = "rgba(255,210,120,0.07)";
      for (let x = solid.x + 18; x < solid.x + solid.w; x += 42) {
        ctx.fillRect(x, solid.y + 16, 16, 3);
      }
    });

    this.drawSign(112, GROUND_Y - 72, "Rescue");
    this.drawChurchSilhouette(3840, GROUND_Y);
  }

  drawSign(x, y, text) {
    ctx.fillStyle = "#4b2b1f";
    ctx.fillRect(x + 27, y + 26, 8, 46);
    ctx.fillStyle = "#7c4b2d";
    ctx.fillRect(x, y, 68, 32);
    ctx.fillStyle = "#f7d881";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text, x + 34, y + 21);
  }

  drawChurchSilhouette(x, floor) {
    ctx.fillStyle = "#151019";
    ctx.fillRect(x, floor - 150, 160, 150);
    ctx.fillRect(x + 58, floor - 235, 46, 92);
    ctx.beginPath();
    ctx.moveTo(x + 50, floor - 235);
    ctx.lineTo(x + 81, floor - 286);
    ctx.lineTo(x + 112, floor - 235);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffcf62";
    ctx.fillRect(x + 28, floor - 92, 28, 44);
    ctx.fillRect(x + 106, floor - 92, 28, 44);
  }

  drawGoal() {
    const x = goal.x;
    const y = goal.y;
    ctx.fillStyle = "rgba(138,214,201,0.16)";
    ctx.beginPath();
    ctx.ellipse(x + 42, y + 79, 58, 86, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(x + 42, y + 116 + Math.sin(this.time * 3) * 3);
    ctx.lineCap = "round";
    ctx.strokeStyle = "#f7f0d5";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-9, 19);
    ctx.lineTo(-11, 42);
    ctx.moveTo(9, 19);
    ctx.lineTo(11, 42);
    ctx.stroke();
    ctx.strokeStyle = "#d94b43";
    ctx.lineWidth = 4;
    for (let stripe = 23; stripe <= 39; stripe += 8) {
      ctx.beginPath();
      ctx.moveTo(-11, stripe);
      ctx.lineTo(-9, stripe + 3);
      ctx.moveTo(9, stripe);
      ctx.lineTo(11, stripe + 3);
      ctx.stroke();
    }
    ctx.fillStyle = "#171118";
    ctx.beginPath();
    ctx.ellipse(-12, 45, 9, 4, -0.1, 0, Math.PI * 2);
    ctx.ellipse(12, 45, 9, 4, 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#5f4a9a";
    ctx.beginPath();
    ctx.ellipse(0, 8, 21, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#241431";
    ctx.beginPath();
    ctx.moveTo(-57, -22);
    ctx.quadraticCurveTo(-17, -40, 0, -98);
    ctx.quadraticCurveTo(17, -44, 57, -22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffcf62";
    ctx.beginPath();
    ctx.ellipse(0, -24, 61, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#241431";
    ctx.beginPath();
    ctx.ellipse(0, -27, 66, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffcf62";
    ctx.fillRect(-17, -39, 34, 6);
    ctx.fillStyle = "#f2dfbd";
    ctx.beginPath();
    ctx.arc(0, -17, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#151019";
    ctx.fillRect(-5, -18, 3, 4);
    ctx.fillRect(5, -18, 3, 4);
    ctx.strokeStyle = "#f7d881";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -11, 5, 0.15, Math.PI - 0.15);
    ctx.stroke();
    ctx.fillStyle = "#f8f0dc";
    ctx.font = "700 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Wendy", 0, 60);
    ctx.restore();
  }

  drawVignette() {
    const grad = ctx.createRadialGradient(W / 2, H / 2, 140, W / 2, H / 2, 560);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.34)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
}

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(event.code)) event.preventDefault();
  if (!KEYS.has(event.code)) PRESSED.add(event.code);
  KEYS.add(event.code);
  if (event.code === "Enter") game.start();
  if (event.code === "KeyP") game.pause();
  if (event.code === "KeyM") game.audio.toggleMute();
});

window.addEventListener("keyup", (event) => {
  KEYS.delete(event.code);
});

startButton.addEventListener("click", () => game.start());
muteButton.addEventListener("click", () => {
  game.audio.init();
  game.audio.toggleMute();
});

game = new Game();
