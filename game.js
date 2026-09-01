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

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Power-up Velocidad ────────────────────────────────────────────────────────
const VELOCIDAD_DURATION = 5;       // segundos
const VELOCIDAD_MULT = 2;           // multiplicador de THRUST
const POWERUP_DROP_CHANCE = 0.15;   // 15% al destruir asteroide grande/mediano
const POWERUP_RADIUS = 14;
const POWERUP_TTL = 8;              // segundos antes de desaparecer

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

    // Velocidad mucho mayor que asteroides normales (SPEEDS max 85)
    const angle = rand(0, Math.PI * 2);
    const speed = ESTRELLA_FUGAZ_SPEED + rand(-20, 20);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-3, 3);
    this.rot = rand(0, Math.PI * 2);

    // Estela para efecto de velocidad
    this.trail = [];
    // No usa verts de asteroide — se dibuja como estrella
    this.verts = null;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;

    // Guardar estela (max 6 posiciones)
    this.trail.unshift({ x: this.x, y: this.y });
    if (this.trail.length > 6) this.trail.pop();
  }

  split() {
    // No se divide al destruirse
    return [];
  }

  draw() {
    // Alpha con fade + parpadeo en ultimos 1.5s
    let alpha = 1;
    if (this.ttl < 1.5) {
      alpha = Math.max(0, this.ttl / 1.5);
      // Parpadeo rapido
      if (Math.floor(this.ttl * 10) % 2 === 0) alpha *= 0.35;
    }

    // — Estela —
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

    // Estrella de 5 puntas (10 vertices alternando radio exterior/interior)
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

    // Brillo central
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
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.velocidadTimer = 0;
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.velocidadTimer > 0) this.velocidadTimer -= dt;

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
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    const velocidadActiva = this.velocidadTimer > 0;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    // Aura cyan cuando velocidad está activa
    if (velocidadActiva) {
      ctx.shadowColor = '#0ff';
      ctx.shadowBlur = 14;
    }
    ctx.strokeStyle = velocidadActiva ? '#0ff' : '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo( 20,  0);   // nariz
    ctx.lineTo(-12, -9);   // ala izquierda
    ctx.lineTo( -7,  0);   // muesca trasera
    ctx.lineTo(-12,  9);   // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8,  4);
      ctx.strokeStyle = 'rgba(255, 130, 0, 0.85)';
      ctx.stroke();
    }

    ctx.restore();
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
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = POWERUP_RADIUS;
    this.ttl = POWERUP_TTL;
    this.dead = false;
    // Deriva lenta para que sea alcanzable
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
    ctx.save();
    ctx.translate(this.x, this.y);
    // Aura exterior
    ctx.strokeStyle = `rgba(0, 255, 255, ${(0.35 * pulse * alpha).toFixed(2)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 4 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    // Diamante central
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = `rgba(0, 255, 255, ${(0.9 * alpha).toFixed(2)})`;
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
    // Letra V
    ctx.fillStyle = `rgba(0, 0, 0, ${(0.85 * alpha).toFixed(2)})`;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('V', 0, 1);
    ctx.restore();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerUps;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;
let estrellaFugazTimer = 0; // timer para spawn periodico de estrella fugaz

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
  // Aparece en un borde aleatorio con direccion hacia el interior
  const edge = randInt(0, 3);
  let x, y;
  if (edge === 0) { x = rand(0, W); y = -ESTRELLA_FUGAZ_RADIUS; }
  else if (edge === 1) { x = W + ESTRELLA_FUGAZ_RADIUS; y = rand(0, H); }
  else if (edge === 2) { x = rand(0, W); y = H + ESTRELLA_FUGAZ_RADIUS; }
  else { x = -ESTRELLA_FUGAZ_RADIUS; y = rand(0, H); }
  const ef = new EstrellaFugaz(x, y);
  // Reorientar velocidad hacia el centro con variacion
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

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  powerUps.forEach(p => p.update(dt));

  // Spawn estrella fugaz periodico (solo en playing)
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
  // Limpiar estrellas fugaces expiradas (dead por ttl) antes de colisiones
  asteroids = asteroids.filter(a => !a.dead);

  // Bala vs asteroide (incluye estrella fugaz)
  const newAsteroids = [];
  const newPowerUps = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        if (a.esFugaz) {
          score += ESTRELLA_FUGAZ_POINTS;
          explode(a.x, a.y, 12);
        } else {
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          // Drop power-up Velocidad: 15% si era grande/mediano
          if (a.size > 1 && Math.random() < POWERUP_DROP_CHANCE) {
            newPowerUps.push(new PowerUp(a.x, a.y));
          }
        }
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  powerUps.push(...newPowerUps);
  bullets   = bullets.filter(b => !b.dead);

  // Nave vs power-up Velocidad
  if (!ship.dead) {
    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        ship.velocidadTimer = VELOCIDAD_DURATION; // reinicia timer si ya estaba activo
        explode(p.x, p.y, 6);
      }
    }
    powerUps = powerUps.filter(p => !p.dead);
  }

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    for (const a of asteroids) {
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        killShip();
        break;
      }
    }
  }

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = '#fff';
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

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  // Indicador power-up Velocidad
  if (ship && ship.velocidadTimer > 0) {
    const t = ship.velocidadTimer;
    ctx.fillStyle = '#0ff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`VELOCIDAD ${t.toFixed(1)}s`, W / 2, 44);
    // Barra de progreso
    const barW = 100;
    const barH = 4;
    const bx = W / 2 - barW / 2;
    const by = 50;
    ctx.fillStyle = 'rgba(0,255,255,0.25)';
    ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = '#0ff';
    ctx.fillRect(bx, by, barW * (t / VELOCIDAD_DURATION), barH);
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
