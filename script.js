const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let width = 0;
let height = 0;
let S = 1;          // масштаб: 1 единица сердца = S пикселей
let cx = 0;         // центр сердца по X
let cy = 0;         // центр сердца по Y
let PLAT_Y = 0;     // положение светящейся платформы
let PLAT_RX = 0;
let PLAT_RY = 0;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  S = Math.min(width, height) / 46;
  cx = width / 2;
  cy = height * 0.42;
  PLAT_Y = cy + 22 * S;
  PLAT_RX = 11 * S;
  PLAT_RY = 2.6 * S;
}
resize();
window.addEventListener("resize", resize);

const BLUE_SHADES = [
  "#3b82f6", "#60a5fa",
  "#93c5fd", "#2563eb",
  "#bfdbfe", "#1d4ed8",
];

// Заранее рисуем мягкое свечение для каждого оттенка
function makeGlow(color, size = 32) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, color + "66");
  grad.addColorStop(1, color + "00");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}
const GLOWS = BLUE_SHADES.map((c) => makeGlow(c));

/* ---------- Частицы, из которых состоит вращающееся 3D-сердце ---------- */

const FOV = 70;

class HeartPoint {
  constructor() {
    this.respawn();
    this.life = Math.random() * this.maxLife;
  }

  respawn() {
    const t = Math.random() * Math.PI * 2;
    // k < 1 — точка ближе к центру; степень смещает плотность к контуру
    const k = 1 - Math.pow(Math.random(), 2.2) * 0.85;

    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy =
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t);

    this.x = hx * k + (Math.random() - 0.5) * 0.9;
    this.y = (hy - 2) * k + (Math.random() - 0.5) * 0.9;

    // у центра сердце толще, у краёв тоньше
    const depth = 7 * Math.sqrt(Math.max(0, 1 - k * k * 0.9)) + 1.2;
    this.z = (Math.random() - 0.5) * 2 * depth;

    this.ci = Math.floor(Math.random() * BLUE_SHADES.length);
    this.size = 0.8 + Math.random() * 1.6;
    this.big = Math.random() < 0.06;
    this.phase = Math.random() * Math.PI * 2;
    this.maxLife = 160 + Math.random() * 340;
    this.life = 0;
  }

  draw(cos, sin, beat, time) {
    this.life++;
    if (this.life >= this.maxLife) this.respawn();

    const t = this.life / this.maxLife;
    const env = Math.sin(Math.PI * t);                    // появление/затухание
    const twinkle = 0.6 + 0.4 * Math.sin(time * 4 + this.phase);

    // вращение вокруг вертикальной оси
    const X = this.x * cos + this.z * sin;
    const Z = -this.x * sin + this.z * cos;

    const persp = FOV / (FOV + Z);
    const sx = cx + X * S * beat * persp;
    const sy = cy - this.y * S * beat * persp;

    // дальние точки темнее
    const depthFade = Math.min(1, Math.max(0.35, 0.5 + 0.5 * (1 - (Z + 14) / 28)));
    const alpha = env * twinkle * depthFade;
    if (alpha < 0.02) return;

    ctx.globalAlpha = alpha;
    if (this.big) {
      const r = this.size * 4.5 * persp;
      ctx.drawImage(GLOWS[this.ci], sx - r, sy - r, r * 2, r * 2);
    } else {
      ctx.fillStyle = BLUE_SHADES[this.ci];
      const s = this.size * persp;
      ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
    }
  }
}

/* ---------- Буква И в центре сердца ---------- */

// true — буква всегда смотрит на зрителя, false — вращается вместе с сердцем
const F_FIXED = false;

// Части буквы И в единицах сердца:
//   { rect: [x1, x2, y1, y2] }        — прямоугольник
//   { line: [x1, y1, x2, y2, толщина] } — наклонная линия
const LETTER_PARTS = [
  { rect: [-3.5, -1.5, -9, 3] },        // левая ножка
  { rect: [1.5, 3.5, -9, 3] },          // правая ножка
  { line: [2.4, 3, -2.4, -9, 2.2] },    // диагональ сверху справа вниз влево
];
const F_COLORS = ["#ffffff", "#bfdbfe", "#93c5fd"];
const F_GLOWS = F_COLORS.map((c) => makeGlow(c));

class LetterPoint {
  constructor() {
    // выбираем часть буквы пропорционально её площади
    const areas = LETTER_PARTS.map((part) => {
      if (part.rect) {
        const [x1, x2, y1, y2] = part.rect;
        return (x2 - x1) * (y2 - y1);
      }
      const [x1, y1, x2, y2, w] = part.line;
      return Math.hypot(x2 - x1, y2 - y1) * w;
    });
    const total = areas.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let idx = 0;
    while (idx < areas.length - 1 && r > areas[idx]) {
      r -= areas[idx];
      idx++;
    }

    const part = LETTER_PARTS[idx];
    if (part.rect) {
      const [x1, x2, y1, y2] = part.rect;
      this.x = x1 + Math.random() * (x2 - x1);
      this.y = y1 + Math.random() * (y2 - y1);
    } else {
      const [x1, y1, x2, y2, w] = part.line;
      const len = Math.hypot(x2 - x1, y2 - y1);
      const t = Math.random();
      const off = (Math.random() - 0.5) * w;
      this.x = x1 + (x2 - x1) * t + (-(y2 - y1) / len) * off;
      this.y = y1 + (y2 - y1) * t + ((x2 - x1) / len) * off;
    }
    this.z = (Math.random() - 0.5) * 2.4; // толщина буквы
    this.ci = Math.floor(Math.random() * F_COLORS.length);
    this.size = 1.2 + Math.random() * 1.6;
    this.big = Math.random() < 0.08;
    this.phase = Math.random() * Math.PI * 2;
  }

  draw(cos, sin, beat, time) {
    const X = this.x * cos + this.z * sin;
    const Z = -this.x * sin + this.z * cos;

    const persp = FOV / (FOV + Z);
    const sx = cx + X * S * beat * persp;
    const sy = cy - this.y * S * beat * persp;

    const twinkle = 0.75 + 0.25 * Math.sin(time * 5 + this.phase);
    ctx.globalAlpha = twinkle;

    if (this.big) {
      const r = this.size * 4 * persp;
      ctx.drawImage(F_GLOWS[this.ci], sx - r, sy - r, r * 2, r * 2);
    } else {
      ctx.fillStyle = F_COLORS[this.ci];
      const s = this.size * persp;
      ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
    }
  }
}

/* ---------- Искры у платформы и взрыв сердечек по клику ---------- */

class Particle {
  constructor(x, y, type) {
    this.type = type;
    this.reset(x, y);
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.life = 0;
    this.ci = Math.floor(Math.random() * BLUE_SHADES.length);

    if (this.type === "float") {
      this.size = 1 + Math.random() * 2.2;
      this.maxLife = 180 + Math.random() * 220;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = -(0.5 + Math.random() * 1.2);
      this.swing = Math.random() * Math.PI * 2;
    } else {
      this.size = 1.5 + Math.random() * 2.5;
      this.maxLife = 70 + Math.random() * 60;
      this.vx = 0;
      this.vy = 0;
      this.swing = 0;
    }
  }

  get dead() {
    return this.life >= this.maxLife;
  }

  update() {
    this.life++;

    if (this.type === "float") {
      this.swing += 0.03;
      this.x += this.vx + Math.sin(this.swing) * 0.4;
      this.y += this.vy;

      if (this.dead || this.y < -20) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random());
        this.reset(
          cx + Math.cos(a) * r * PLAT_RX,
          PLAT_Y + Math.sin(a) * r * PLAT_RY
        );
      }
    } else {
      this.x += this.vx;
      this.y += this.vy;
      this.vx *= 0.96;
      this.vy *= 0.96;
    }
  }

  draw() {
    const t = this.life / this.maxLife;
    const alpha =
      this.type === "float" ? Math.sin(Math.PI * Math.min(t, 1)) : 1 - t;
    if (alpha <= 0) return;

    const r = this.size * 3.5;
    ctx.globalAlpha = alpha * 0.9;
    ctx.drawImage(GLOWS[this.ci], this.x - r, this.y - r, r * 2, r * 2);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = BLUE_SHADES[this.ci];
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
  }
}

/* ---------- Создание частиц ---------- */

const HEART_COUNT = window.innerWidth < 600 ? 4500 : 7500;
const heartPoints = [];
for (let i = 0; i < HEART_COUNT; i++) {
  heartPoints.push(new HeartPoint());
}

const LETTER_COUNT = window.innerWidth < 600 ? 1200 : 2200;
const letterPoints = [];
for (let i = 0; i < LETTER_COUNT; i++) {
  letterPoints.push(new LetterPoint());
}

const floatParticles = [];
const burstParticles = [];
const FLOAT_COUNT = 140;

for (let i = 0; i < FLOAT_COUNT; i++) {
  const p = new Particle(
    Math.random() * width,
    Math.random() * height,
    "float"
  );
  p.life = Math.random() * p.maxLife; // разброс стартовой «жизни»
  floatParticles.push(p);
}

let pulse = 0;

// Взрыв: частицы разлетаются по контуру сердца
function spawnHeartBurst(x, y) {
  const count = 140;
  for (let i = 0; i < count; i++) {
    const p = new Particle(x, y, "burst");
    const t = (i / count) * Math.PI * 2;
    const k = (0.85 + Math.random() * 0.3) * 0.3;

    p.vx = 16 * Math.pow(Math.sin(t), 3) * k;
    p.vy =
      -(
        13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t)
      ) * k;

    burstParticles.push(p);
  }
  pulse = 1;
}

/* ---------- Светящаяся платформа под сердцем ---------- */

function drawPlatform(time) {
  // мягкое свечение
  ctx.save();
  ctx.translate(cx, PLAT_Y);
  ctx.scale(1, PLAT_RY / PLAT_RX);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, PLAT_RX * 1.3);
  g.addColorStop(0, "rgba(90, 210, 255, 0.95)");
  g.addColorStop(0.45, "rgba(30, 120, 255, 0.5)");
  g.addColorStop(1, "rgba(0, 60, 255, 0)");
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, PLAT_RX * 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // вращающиеся световые дуги
  ctx.save();
  ctx.shadowColor = "#38bdf8";
  ctx.shadowBlur = 18;
  ctx.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const a0 = time * (1.4 + i * 0.35) + i * 1.7;
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = i % 2 ? "#bfdbfe" : "#7dd3fc";
    ctx.lineWidth = 1.5 + (i % 2);
    ctx.beginPath();
    ctx.ellipse(
      cx,
      PLAT_Y,
      PLAT_RX * (0.7 + i * 0.1),
      PLAT_RY * (0.7 + i * 0.1),
      0,
      a0,
      a0 + 1.6
    );
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------- Главный цикл ---------- */

function animate(now) {
  const time = now / 1000;
  const angle = time * 0.6;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // биение сердца + всплеск при клике
  pulse *= 0.93;
  const beat = 1 + 0.035 * Math.pow(Math.max(0, Math.sin(time * 3)), 6) + pulse * 0.07;

  // шлейф: вместо полной очистки слегка затемняем прошлый кадр
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.fillRect(0, 0, width, height);

  // аддитивное смешивание даёт эффект свечения
  ctx.globalCompositeOperation = "lighter";

  drawPlatform(time);

  for (const p of heartPoints) {
    p.draw(cos, sin, beat, time);
  }

  const fCos = F_FIXED ? 1 : cos;
  const fSin = F_FIXED ? 0 : sin;
  for (const p of letterPoints) {
    p.draw(fCos, fSin, beat, time);
  }

  for (const p of floatParticles) {
    p.update();
    p.draw();
  }

  for (let i = burstParticles.length - 1; i >= 0; i--) {
    const p = burstParticles[i];
    p.update();
    if (p.dead) {
      burstParticles.splice(i, 1);
    } else {
      p.draw();
    }
  }

  ctx.globalAlpha = 1;
  requestAnimationFrame(animate);
}

canvas.addEventListener("click", (e) => spawnHeartBurst(e.clientX, e.clientY));
canvas.addEventListener(
  "touchstart",
  (e) => {
    const t = e.touches[0];
    spawnHeartBurst(t.clientX, t.clientY);
  },
  { passive: true }
);

/* ---------- Музыка ---------- */

const music = document.getElementById("music");
const startScreen = document.getElementById("start");
const muteBtn = document.getElementById("mute");

// Первый тап запускает звук (браузеры не разрешают автозапуск)
startScreen.addEventListener("click", () => {
  startScreen.classList.add("hidden");
  music.volume = 0.7;
  music.play().catch(() => {});
});

muteBtn.addEventListener("click", () => {
  music.muted = !music.muted;
  muteBtn.textContent = music.muted ? "🔇" : "🔊";
});

requestAnimationFrame(animate);