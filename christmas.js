'use strict';

const byId = (id) => document.getElementById(id);
const canvas = byId('scene');
const ctx = canvas.getContext('2d', { alpha: false });
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const defaultMessage = '今年もありがとう。あたたかくて素敵なクリスマスを！';
const tau = Math.PI * 2;
const total = 10_000;
const goldAndWhiteCount = 720;
const redCount = 500;
const ornamentCount = goldAndWhiteCount + redCount;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const smooth = (value) => {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
};
let seed = 2026;
function random() {
  seed = seed * 16807 % 2147483647;
  return seed / 2147483647;
}

const leaves = '.,:+*x%#';
const palette = ['#183b30','#20513d','#2a674b','#327d57','#419669','#59ac7c','#78c994','#a0deaa','#ca9650','#ffe1a0','#aebfba','#f6fff3','#714f36','#b93b50','#ff8189'];
const points = Array.from({ length: total }, (_, i) => {
  const ornamentIndex = i - (total - ornamentCount);
  const light = ornamentIndex >= 0;
  const red = ornamentIndex >= goldAndWhiteCount;
  const layerIndex = red ? ornamentIndex - goldAndWhiteCount : ornamentIndex;
  const layerCount = red ? redCount : goldAndWhiteCount;
  const angle = light ? (layerIndex * 2.39996323 + (red ? 1.2 : 0) + random() * .24) % tau : random() * tau;
  const height = light ? .025 + .9 * Math.pow((layerIndex + random()) / layerCount, 1.32) : Math.pow(random(), 1.48);
  const tier = (height * 7.15) % 1;
  const branch = .9 + .1 * Math.cos(angle * 7 + height * 54);
  const envelope = (1 - height) * (.71 + .29 * Math.pow(1 - tier, 3)) * branch;
  const trunk = i < 170;
  const radius = trunk ? .084 * Math.sqrt(random()) : envelope * (light ? 1.025 : .37 + .63 * Math.sqrt(random()));
  return {
    x: Math.cos(angle) * radius, z: Math.sin(angle) * radius,
    y: trunk ? -.15 * random() : height,
    tone: random(), phase: random() * tau,
    glyph: trunk ? '|' : leaves[Math.floor(random() * leaves.length)],
    trunk, light, red, gold: layerIndex % 3 !== 0
  };
});

const flakes = Array.from({ length: 132 }, () => ({ x: random(), y: random(), z: random(), phase: random() * tau }));
const ground = Array.from({ length: 600 }, () => ({ x: (random() - .5) * 7, z: .32 + random() * 5, tone: random() }));
const buckets = Array.from({ length: 28 }, () => []);
const projected = points.map(() => ({ x: 0, y: 0, color: 0, glyph: '.' }));
let width = 0, height = 0, pixelRatio = 1, backdrop, atlas, tile = 0;
const characters = leaves + '|o';
let quality = 0;
let frameAverage = 16.7, samples = 0, previousFrame = 0, lastDraw = 0;
let start = performance.now(), lastCountdown = '';

function resize() {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, [1.75, 1.3, 1][quality]);
  if (rect.width === width && rect.height === height && ratio === pixelRatio) return;
  width = rect.width;
  height = rect.height;
  pixelRatio = ratio;
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  backdrop = ctx.createRadialGradient(width * .5, height * .54, 6, width * .5, height * .54, Math.max(8, width * .6, height * .53));
  backdrop.addColorStop(0, '#14291f');
  backdrop.addColorStop(.53, '#0c1a14');
  backdrop.addColorStop(1, '#070e0b');
  const size = clamp(Math.min(width * .012, height * .016), 4.2, 8.4);
  tile = Math.ceil((size + 4) * ratio);
  atlas = document.createElement('canvas');
  atlas.width = characters.length * tile;
  atlas.height = palette.length * tile;
  const ink = atlas.getContext('2d');
  ink.font = `${size * ratio}px monospace`;
  ink.textAlign = 'center';
  ink.textBaseline = 'middle';
  palette.forEach((color, row) => {
    ink.fillStyle = color;
    Array.from(characters).forEach((character, column) => {
      ink.fillText(character, (column + .5) * tile, (row + .51) * tile);
    });
  });
}

function drawGround(horizon, t) {
  const fade = smooth((t - 1) / 3);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < ground.length; i += quality === 2 ? 3 : 1) {
    const dot = ground[i];
    const perspective = .65 / dot.z;
    const x = width / 2 + dot.x * width * .43 * perspective;
    const y = horizon + height * .13 * perspective;
    if (x < 0 || x > width || y > height) continue;
    ctx.fillStyle = dot.tone > .82 ? '#89a399' : '#516c5f';
    ctx.globalAlpha = fade * clamp(.12 + perspective * dot.tone, .12, .65);
    ctx.font = `${clamp(3 + perspective * 3, 4, 10)}px monospace`;
    ctx.fillText(dot.tone > .77 ? '·' : '−', x, y);
  }
  ctx.globalAlpha = 1;
}

function drawSnow(t, front) {
  if (t < 8.2) return;
  const age = t - 8.2;
  for (let i = 0; i < flakes.length; i += quality + 1) {
    const f = flakes[i];
    if ((f.z > .6) !== front) continue;
    const x = f.x * width + Math.sin(f.phase + age * .7) * (4 + 13 * f.z);
    const motion = reducedMotion.matches ? 0 : age;
    const y = (f.y * height + motion * (7 + 25 * f.z)) % height;
    ctx.globalAlpha = smooth(age / 2) * (.16 + f.z * .55);
    ctx.fillStyle = '#e8f4eb';
    ctx.font = `${4 + 7 * f.z}px monospace`;
    ctx.fillText(front ? '*' : '·', x, y);
  }
  ctx.globalAlpha = 1;
}

function drawTree(t, angle, base, treeHeight, radius) {
  const growth = smooth((t - 2.3) / 5.1);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const size = tile / pixelRatio;
  for (const bucket of buckets) bucket.length = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!growth || p.y > growth) continue;
    const lit = p.light && t >= 9.1 + p.tone * 2.35;
    if (!p.light && quality && i % 10 < (quality === 1 ? 2 : 4)) continue;
    const settle = p.trunk ? 0 : 1 - smooth((growth - p.y) * 9 + smooth((t - 7) / .8));
    const x = p.x * cos - p.z * sin;
    const z = p.x * sin + p.z * cos;
    const perspective = 2.7 / (2.7 - z);
    const item = projected[i];
    item.x = width / 2 + x * radius * perspective + Math.cos(p.phase) * settle * width * .22;
    item.y = base - p.y * treeHeight * perspective + z * radius * .28 + Math.sin(p.phase) * settle * 24;
    item.color = p.trunk ? 12 : clamp(Math.floor(2.5 + z * 4 + p.tone * 3.6), 0, 7);
    item.glyph = p.glyph;
    if (lit) {
      const bright = Math.sin(t * 2.5 + p.phase) > -.25;
      const dimColor = p.red ? 13 : p.gold ? 8 : 10;
      item.color = dimColor + Number(bright);
      item.glyph = p.red || p.gold ? 'o' : '*';
    }
    buckets[clamp(Math.floor((z + 1) * 14), 0, 27)].push(item);
  }
  for (const bucket of buckets) {
    for (const item of bucket) {
      const column = characters.indexOf(item.glyph);
      ctx.drawImage(atlas, column * tile, item.color * tile, tile, tile, item.x - size / 2, item.y - size / 2, size, size);
    }
  }
  if (t >= 8.4) {
    const starY = base - treeHeight - 10;
    ctx.globalAlpha = smooth((t - 8.4) / .65);
    ctx.fillStyle = '#fff1ba';
    ctx.font = '25px monospace';
    ctx.shadowColor = '#f4bd61';
    ctx.shadowBlur = 15;
    ctx.fillText('✦', width / 2, starY);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  if (previousFrame && document.visibilityState === 'visible') {
    const delta = now - previousFrame;
    frameAverage = frameAverage * .97 + Math.min(delta, 85) * .03;
    if (++samples >= 100) {
      if (frameAverage > 29 && quality < 2) quality++;
      samples = 0;
    }
  }
  previousFrame = now;
  const interval = reducedMotion.matches ? 100 : quality === 2 ? 32 : 0;
  if (now - lastDraw < interval) return;
  lastDraw = now;
  const elapsed = Math.max(0, (now - start) / 1000);
  const t = reducedMotion.matches ? Math.max(15, elapsed) : elapsed;
  byId('greeting').hidden = t < 12.2;
  byId('message').hidden = t < 13.8;
  resize();
  if (!width || !height) return;
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, width, height);
  const radius = Math.min(width * .48, height * .48);
  const treeHeight = Math.min(height * .75, radius * 1.93);
  const base = height * .53 + treeHeight * .43;
  const angle = reducedMotion.matches ? .6 : Math.max(0, t - 7.4) * .39 % tau;
  drawGround(base - height * .11, t);
  drawSnow(t, false);
  drawTree(t, angle, base, treeHeight, radius);
  drawSnow(t, true);
}

const recipient = byId('recipient');
const custom = byId('custom');
const countdownToggle = byId('show-countdown');

function readShareLink() {
  const params = new URLSearchParams(location.hash.slice(1));
  recipient.value = (params.get('to') || '').slice(0, 32);
  custom.value = (params.get('message') || defaultMessage).slice(0, 240);
  countdownToggle.checked = params.get('countdown') !== 'off';
  byId('share-result').hidden = true;
  byId('feedback').textContent = '';
  renderMessage();
  updateCountdown();
}

function renderMessage() {
  const name = recipient.value.trim();
  const body = custom.value.trim() || defaultMessage;
  byId('message').textContent = name ? `${name}へ\n${body}` : body;
}
function updateCountdown() {
  const output = byId('countdown');
  output.hidden = !countdownToggle.checked;
  if (output.hidden) return;
  const seconds = Math.max(0, Math.ceil((Date.parse('2026-12-25T00:00:00+09:00') - Date.now()) / 1000));
  const pad = (v) => String(v).padStart(2, '0');
  const display = seconds ? `XMAS − ${Math.floor(seconds / 86400)}d ${pad(Math.floor(seconds / 3600) % 24)}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}` : 'MERRY CHRISTMAS';
  if (display !== lastCountdown) {
    output.textContent = display;
    lastCountdown = display;
  }
}
readShareLink();
window.addEventListener('hashchange', readShareLink);
setInterval(updateCountdown, 250);
countdownToggle.addEventListener('change', updateCountdown);
for (const field of [recipient, custom, countdownToggle]) {
  field.addEventListener('input', () => {
    renderMessage();
    byId('share-result').hidden = true;
    byId('feedback').textContent = '';
  });
}
byId('share-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const share = new URLSearchParams();
  if (recipient.value.trim()) share.set('to', recipient.value.trim());
  if (custom.value.trim() && custom.value.trim() !== defaultMessage) share.set('message', custom.value.trim());
  if (!countdownToggle.checked) share.set('countdown', 'off');
  const url = new URL(location.href);
  url.search = '';
  url.hash = share.toString();
  byId('share-url').value = url.href;
  byId('share-result').hidden = false;
  byId('feedback').textContent = url.protocol === 'file:' ? 'GitHub Pages で公開すると、相手が開ける共有リンクになります。' : '共有リンクを作成しました。';
});
byId('copy').addEventListener('click', async () => {
  const input = byId('share-url');
  try {
    await navigator.clipboard.writeText(input.value);
    byId('feedback').textContent = 'リンクをコピーしました。';
  } catch {
    input.focus();
    input.select();
    input.setSelectionRange(0, input.value.length);
    byId('feedback').textContent = document.execCommand('copy') ? 'リンクをコピーしました。' : '選択したリンクをコピーしてください。';
  }
});
byId('replay').addEventListener('click', () => {
  start = performance.now();
});

const soundtrack = byId('soundtrack');
const musicButton = byId('music');
const musicState = byId('music-state');
const musicError = byId('music-error');
const stage = document.querySelector('.stage');

function updateMusicState() {
  const playing = !soundtrack.paused && !soundtrack.ended;
  musicButton.setAttribute('aria-pressed', String(playing));
  musicState.textContent = playing ? '停止' : '再生';
}

function playOnFirstStageTap() {
  playSoundtrack();
}

async function playSoundtrack(retryOnStageTap = false) {
  musicError.hidden = true;
  try {
    await soundtrack.play();
  } catch (error) {
    if (error.name === 'NotAllowedError' && retryOnStageTap) {
      stage.addEventListener('click', playOnFirstStageTap, { once: true });
    } else if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
      musicError.textContent = '音源を再生できませんでした。';
      musicError.hidden = false;
    }
  }
  updateMusicState();
}

for (const event of ['play', 'pause', 'ended']) {
  soundtrack.addEventListener(event, updateMusicState);
}
soundtrack.addEventListener('play', () => stage.removeEventListener('click', playOnFirstStageTap));
musicButton.addEventListener('click', () => {
  if (soundtrack.paused || soundtrack.ended) playSoundtrack();
  else soundtrack.pause();
});

soundtrack.volume = .35;
playSoundtrack(true);

if (ctx) requestAnimationFrame(frame);




