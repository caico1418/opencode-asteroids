'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Skins ─────────────────────────────────────────────────────────────────────
const SKINS = [
  { id: 'clasica', nombre: 'Clásica', stroke: '#fff',    fill: null,                         shadow: null,     llama: 'rgba(255,130,0,0.85)', bullet: '#fff', scale: 1, pointsMult: 1 },
  { id: 'neon',    nombre: 'Neón',    stroke: '#0ff',    fill: 'rgba(0,255,255,0.06)',        shadow: '#0ff',    llama: 'rgba(0,255,255,0.9)', bullet: '#0ff', scale: 1, pointsMult: 1 },
  { id: 'inferno', nombre: 'Ínfero',  stroke: '#ff3b30', fill: null,                         shadow: '#ff3b30', llama: 'rgba(255,60,30,0.9)', bullet: '#ff6b60', scale: 1, pointsMult: 1 },
  { id: 'void',    nombre: 'Vacío',   stroke: '#b07cff', fill: 'rgba(176,124,255,0.07)',      shadow: '#b07cff', llama: 'rgba(176,124,255,0.85)', bullet: '#b07cff', scale: 1, pointsMult: 1 },
  { id: 'oro',     nombre: 'Oro',     stroke: '#ffeb3b', fill: 'rgba(255,235,59,0.07)',       shadow: '#ffeb3b', llama: 'rgba(255,235,59,0.9)', bullet: '#ffeb3b', scale: 1, pointsMult: 1 },
  { id: 'morada',  nombre: 'Morada',  stroke: '#9c27b0', fill: 'rgba(156,39,176,0.08)',       shadow: '#9c27b0', llama: 'rgba(255,130,255,0.9)', bullet: '#ce93d8', scale: 2, pointsMult: 2 },
];
const SKIN_IDS = SKINS.map(s => s.id);
function getSkin(id) { return SKINS.find(s => s.id === id) || SKINS[0]; }
let currentSkinId;
try { currentSkinId = localStorage.getItem('asteroids_skin') || 'clasica'; } catch { currentSkinId = 'clasica'; }
if (!SKIN_IDS.includes(currentSkinId)) currentSkinId = 'clasica';
function setSkin(id) {
  if (!SKIN_IDS.includes(id)) return;
  currentSkinId = id;
  try { localStorage.setItem('asteroids_skin', id); } catch {}
  if (typeof ship !== 'undefined' && ship) ship.skinId = id;
}
// Exponer para el selector HTML (const/let no se cuelgan de window)
try { window.SKINS = SKINS; window.getSkin = getSkin; window.setSkin = setSkin; } catch {}
Object.defineProperty(window, 'currentSkinId', { get() { return currentSkinId; }, set(v) { currentSkinId = v; }, configurable: true });

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle, color) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
    this.color = color || getSkin(currentSkinId).bullet;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = this.color;
    if (this.color !== '#fff') {
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 6;
    }
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    if (this.color !== '#fff') ctx.shadowBlur = 0;
  }
}

// ── Power-ups ─────────────────────────────────────────────────────────────────
const VELOCIDAD_DURATION = 5;       // segundos
const VELOCIDAD_MULT = 2;           // multiplicador de THRUST
const TRIPLE_DURATION = 5;          // segundos — triple disparo en línea recta
const POWERUP_DROP_CHANCE = 0.15;   // 15% al destruir asteroide grande/mediano
const POWERUP_RADIUS = 14;
const POWERUP_TTL = 8;              // segundos antes de desaparecer

// ── Escudo ───────────────────────────────────────────────────────────────────
const ESCUDO_DURATION = 7;          // segundos
const ESCUDO_HITS = 3;              // impactos que aguanta
const ESCUDO_RADIUS_EXTRA = 10;     // radio extra sobre ship.radius
const ESCUDO_COLOR = '#4fc3f7';

// ── Estrella Fugaz ──────────────────────────────────────────────────────────
const ESTRELLA_FUGAZ_RADIUS = 18;
const ESTRELLA_FUGAZ_SPEED  = 200;  // base, + rand(-20,20) — ~2.5x asteroide pequeño
const ESTRELLA_FUGAZ_TTL    = 6;    // segundos hasta desaparecer sola
const ESTRELLA_FUGAZ_POINTS = 250;
const ESTRELLA_FUGAZ_SPAWN_INTERVAL = 10; // seg entre intentos de spawn
const ESTRELLA_FUGAZ_SPAWN_CHANCE   = 0.6; // probabilidad por intento

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Estrella Fugaz (asteroide especial) ─────────────────────────────────────
class EstrellaFugaz extends Asteroid {
  constructor(x, y) {
    super(x, y, 1);
    this.esFugaz = true;
    this.radius = ESTRELLA_FUGAZ_RADIUS;
    this.ttl = ESTRELLA_FUGAZ_TTL;
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = ESTRELLA_FUGAZ_SPEED + rand(-20, 20);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-3, 3);
    this.rot = rand(0, Math.PI * 2);

    this.trail = [];
    this.verts = null;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;

    this.trail.unshift({ x: this.x, y: this.y });
    if (this.trail.length > 6) this.trail.pop();
  }

  split() {
    return [];
  }

  draw() {
    let alpha = 1;
    if (this.ttl < 1.5) {
      alpha = Math.max(0, this.ttl / 1.5);
      if (Math.floor(this.ttl * 10) % 2 === 0) alpha *= 0.35;
    }

    for (let i = 0; i < this.trail.length; i++) {
      const p = this.trail[i];
      const tAlpha = alpha * (1 - i / this.trail.length) * 0.35;
      if (tAlpha <= 0.02) continue;
      ctx.save();
      ctx.globalAlpha = tAlpha;
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.radius * (0.45 - i * 0.05), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = '#ffeb3b';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = '#ffeb3b';
    ctx.fillStyle = 'rgba(255, 235, 59, 0.18)';
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';

    const outer = this.radius;
    const inner = this.radius * 0.42;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(255,255,255,${(0.85 * alpha).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.skinId = currentSkinId;
    this.radius = 12 * (getSkin(this.skinId).scale || 1);
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.velocidadTimer = 0;
    this.tripleTimer   = 0;
    this.escudoTimer = 0;
    this.escudoHits = 0;
    this.dead          = false;
  }

  tieneEscudo() {
    return this.escudoTimer > 0 && this.escudoHits > 0;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.velocidadTimer > 0) this.velocidadTimer -= dt;
    if (this.tripleTimer    > 0) this.tripleTimer    -= dt;
    if (this.escudoTimer > 0) {
      this.escudoTimer -= dt;
      if (this.escudoTimer <= 0) {
        this.escudoTimer = 0;
        this.escudoHits = 0;
      }
    }

    const ROT   = 3.5;   // rad/s
    const baseThrust = 260;  // px/s²
    const THRUST = this.velocidadTimer > 0 ? baseThrust * VELOCIDAD_MULT : baseThrust;
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const sc = getSkin(this.skinId).scale || 1;
    const NOSE = 21 * sc;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    const skin = getSkin(this.skinId);
    if (this.tripleTimer > 0) {
      const OFFSET = 8 * sc;
      const sx = -Math.sin(this.angle) * OFFSET;
      const sy =  Math.cos(this.angle) * OFFSET;
      return [
        new Bullet(ox, oy, this.angle, skin.bullet),
        new Bullet(ox + sx, oy + sy, this.angle, skin.bullet),
        new Bullet(ox - sx, oy - sy, this.angle, skin.bullet),
      ];
    }
    return [new Bullet(ox, oy, this.angle, skin.bullet)];
  }

  draw() {
    if (this.dead) return;
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    const skin = getSkin(this.skinId);
    const sc = skin.scale || 1;

    const velocidadActiva = this.velocidadTimer > 0;
    const tripleActivo = this.tripleTimer > 0;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.scale(sc, sc);
    // Aura según power-ups activos (power-up sobrescribe skin)
    if (velocidadActiva && tripleActivo) {
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 14;
    } else if (tripleActivo) {
      ctx.shadowColor = '#f0f';
      ctx.shadowBlur = 14;
    } else if (velocidadActiva) {
      ctx.shadowColor = '#0ff';
      ctx.shadowBlur = 14;
    } else if (skin.shadow) {
      ctx.shadowColor = skin.shadow;
      ctx.shadowBlur = 10;
    }
    ctx.strokeStyle = tripleActivo && velocidadActiva ? '#fff' : tripleActivo ? '#f0f' : velocidadActiva ? '#0ff' : skin.stroke;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    ctx.beginPath();
    ctx.moveTo( 20,  0);
    ctx.lineTo(-12, -9);
    ctx.lineTo( -7,  0);
    ctx.lineTo(-12,  9);
    ctx.closePath();
    if (skin.fill) {
      ctx.fillStyle = skin.fill;
      ctx.fill();
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8,  4);
      ctx.strokeStyle = skin.llama;
      ctx.stroke();
    }

    ctx.restore();

    // — Escudo — burbuja independiente de la rotación
    if (this.tieneEscudo()) {
      const pulse = 0.6 + Math.sin(Date.now() * 0.005) * 0.25;
      const alpha = this.escudoTimer < 1.5 ? Math.max(0, this.escudoTimer / 1.5) : 1;
      const blinkAlpha = this.escudoTimer < 1.5 && Math.floor(this.escudoTimer * 10) % 2 === 0 ? 0.35 : 1;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.globalAlpha = alpha * blinkAlpha * (0.45 + pulse * 0.2);
      ctx.strokeStyle = ESCUDO_COLOR;
      ctx.shadowColor = ESCUDO_COLOR;
      ctx.shadowBlur = 16 * pulse;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const r = this.radius + ESCUDO_RADIUS_EXTRA + Math.sin(Date.now() * 0.004) * 1.5;
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = alpha * blinkAlpha * 0.18;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, r - 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── PowerUp ───────────────────────────────────────────────────────────────────
class PowerUp {
  constructor(x, y, tipo = 'velocidad') {
    this.x = x;
    this.y = y;
    this.tipo = tipo; // 'velocidad' | 'triple' | 'escudo'
    this.radius = POWERUP_RADIUS;
    this.ttl = POWERUP_TTL;
    this.dead = false;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(15, 35);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.pulsePhase = rand(0, Math.PI * 2);
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
    this.pulsePhase += dt * 4;
  }

  draw() {
    const pulse = 0.7 + Math.sin(this.pulsePhase) * 0.3;
    const alpha = Math.min(1, this.ttl > 2 ? 1 : this.ttl / 2);
    let rgb, letter;
    if (this.tipo === 'triple') { rgb = '255, 0, 255'; letter = 'T'; }
    else if (this.tipo === 'escudo') { rgb = '79, 195, 247'; letter = 'E'; }
    else { rgb = '0, 255, 255'; letter = 'V'; }
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = `rgba(${rgb}, ${(0.35 * pulse * alpha).toFixed(2)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 4 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = `rgba(${rgb}, ${(0.9 * alpha).toFixed(2)})`;
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const r = this.radius * 0.7;
    ctx.moveTo(0, -r);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = `rgba(0, 0, 0, ${(0.85 * alpha).toFixed(2)})`;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 0, 1);
    ctx.restore();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerUps;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;
let estrellaFugazTimer = 0;

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function spawnEstrellaFugaz() {
  const edge = randInt(0, 3);
  let x, y;
  if (edge === 0) { x = rand(0, W); y = -ESTRELLA_FUGAZ_RADIUS; }
  else if (edge === 1) { x = W + ESTRELLA_FUGAZ_RADIUS; y = rand(0, H); }
  else if (edge === 2) { x = rand(0, W); y = H + ESTRELLA_FUGAZ_RADIUS; }
  else { x = -ESTRELLA_FUGAZ_RADIUS; y = rand(0, H); }
  const ef = new EstrellaFugaz(x, y);
  const toCenterX = W / 2 - x;
  const toCenterY = H / 2 - y;
  const baseAngle = Math.atan2(toCenterY, toCenterX);
  const angle = baseAngle + rand(-0.6, 0.6);
  const speed = ESTRELLA_FUGAZ_SPEED + rand(-20, 20);
  ef.vx = Math.cos(angle) * speed;
  ef.vy = Math.sin(angle) * speed;
  asteroids.push(ef);
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  powerUps  = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  estrellaFugazTimer = ESTRELLA_FUGAZ_SPAWN_INTERVAL + rand(-2, 2);
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  powerUps  = [];
  ship.reset();
  estrellaFugazTimer = ESTRELLA_FUGAZ_SPAWN_INTERVAL + rand(-2, 2);
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  powerUps.forEach(p => p.update(dt));

  estrellaFugazTimer -= dt;
  if (estrellaFugazTimer <= 0) {
    estrellaFugazTimer = ESTRELLA_FUGAZ_SPAWN_INTERVAL + rand(-2, 2);
    if (Math.random() < ESTRELLA_FUGAZ_SPAWN_CHANCE) {
      spawnEstrellaFugaz();
    }
  }

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);
  powerUps  = powerUps.filter(p => !p.dead);
  asteroids = asteroids.filter(a => !a.dead);

  // Bala vs asteroide (incluye estrella fugaz)
  const newAsteroids = [];
  const newPowerUps = [];
  const pm = (getSkin(currentSkinId).pointsMult || 1);
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        if (a.esFugaz) {
          score += ESTRELLA_FUGAZ_POINTS * pm;
          explode(a.x, a.y, 12);
        } else {
          score += POINTS[a.size] * pm;
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          if (a.size > 1 && Math.random() < POWERUP_DROP_CHANCE) {
            const r = Math.random();
            let tipo;
            if (r < 0.33) tipo = 'velocidad';
            else if (r < 0.66) tipo = 'triple';
            else tipo = 'escudo';
            newPowerUps.push(new PowerUp(a.x, a.y, tipo));
          }
        }
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  powerUps.push(...newPowerUps);
  bullets   = bullets.filter(b => !b.dead);

  // Nave vs power-up (Velocidad / Triple / Escudo)
  if (!ship.dead) {
    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        if (p.tipo === 'triple') ship.tripleTimer = TRIPLE_DURATION;
        else if (p.tipo === 'escudo') { ship.escudoTimer = ESCUDO_DURATION; ship.escudoHits = ESCUDO_HITS; }
        else ship.velocidadTimer = VELOCIDAD_DURATION;
        explode(p.x, p.y, 6);
      }
    }
    powerUps = powerUps.filter(p => !p.dead);
  }

  // Nave vs asteroide (con escudo)
  if (ship.invincible <= 0) {
    for (const a of asteroids) {
      if (a.dead) continue;
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        if (ship.tieneEscudo()) {
          ship.escudoHits--;
          if (ship.escudoHits <= 0) ship.escudoTimer = 0;
          explode(a.x, a.y, 6);
          for (let i = 0; i < 4; i++) particles.push(new Particle(ship.x, ship.y));
          a.dead = true;
        } else {
          killShip();
        }
        break;
      }
    }
    asteroids = asteroids.filter(a => !a.dead);
  }

  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y, color) {
  const c = color || getSkin(currentSkinId).stroke;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  if (c !== '#fff') {
    ctx.shadowColor = c;
    ctx.shadowBlur = 6;
  }
  ctx.strokeStyle = c;
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo( 9,  0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3,  0);
  ctx.lineTo(-6,  5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  const hudSkin = getSkin(currentSkinId);
  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18, hudSkin.stroke);

  let hudY = 44;
  if (ship && ship.velocidadTimer > 0) {
    const t = ship.velocidadTimer;
    ctx.fillStyle = '#0ff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`VELOCIDAD ${t.toFixed(1)}s`, W / 2, hudY);
    const barW = 100;
    const barH = 4;
    const bx = W / 2 - barW / 2;
    const by = hudY + 6;
    ctx.fillStyle = 'rgba(0,255,255,0.25)';
    ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = '#0ff';
    ctx.fillRect(bx, by, barW * (t / VELOCIDAD_DURATION), barH);
    hudY += 20;
  }
  if (ship && ship.tripleTimer > 0) {
    const t = ship.tripleTimer;
    ctx.fillStyle = '#f0f';
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`TRIPLE ${t.toFixed(1)}s`, W / 2, hudY);
    const barW = 100;
    const barH = 4;
    const bx = W / 2 - barW / 2;
    const by = hudY + 6;
    ctx.fillStyle = 'rgba(255,0,255,0.25)';
    ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = '#f0f';
    ctx.fillRect(bx, by, barW * (t / TRIPLE_DURATION), barH);
    hudY += 20;
  }
  if (ship && ship.tieneEscudo()) {
    const t = ship.escudoTimer;
    ctx.fillStyle = ESCUDO_COLOR;
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`ESCUDO ${t.toFixed(1)}s  [${ship.escudoHits}/${ESCUDO_HITS}]`, W / 2, hudY);
    const barW = 100;
    const barH = 4;
    const bx = W / 2 - barW / 2;
    const by = hudY + 6;
    ctx.fillStyle = 'rgba(79,195,247,0.25)';
    ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = ESCUDO_COLOR;
    ctx.fillRect(bx, by, barW * (t / ESCUDO_DURATION), barH);
    hudY += 20;
    for (let i = 0; i < ESCUDO_HITS; i++) {
      const ix = W / 2 - (ESCUDO_HITS - 1) * 10 + i * 20;
      const iy = by + 12;
      ctx.save();
      ctx.translate(ix, iy);
      ctx.globalAlpha = i < ship.escudoHits ? 1 : 0.2;
      ctx.strokeStyle = ESCUDO_COLOR;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  powerUps.forEach(p => p.draw());
  bullets.forEach(b => b.draw());
  ship.draw();

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
