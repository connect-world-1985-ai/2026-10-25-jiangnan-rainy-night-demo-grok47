import * as THREE from 'three';

function canvasTexture(canvas, { color = true, repeat = false, anisotropy = 4 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function hash(ix, iy) {
  const s = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x, y) {
  let v = 0;
  let a = 0.55;
  let f = 1;
  for (let i = 0; i < 4; i += 1) {
    v += a * noise(x * f, y * f);
    f *= 2;
    a *= 0.5;
  }
  return v;
}

function shade(n, base, amp) {
  const v = Math.max(0, Math.min(255, base + (n - 0.5) * amp));
  return v | 0;
}

export function createTextures() {
  return {
    plaster: plasterMap(),
    roof: roofMap(),
    wood: woodMap(),
    stone: stoneMap(),
    flag: flagstoneMaps(),
    lattice: latticeMap(),
    door: doorMap(),
    umbrellaRed: umbrellaMap('#9d2a22', '#e7c27a'),
    umbrellaOil: umbrellaMap('#a56a28', '#f0e2b0'),
    glow: glowMap(),
  };
}

function plasterMap() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const n = fbm(x * 0.02, y * 0.02);
      const stain = fbm(x * 0.008 + 4, y * 0.008);
      const age = y / size;
      const i = (y * size + x) * 4;
      img.data[i] = shade(n, 236 - age * 18, 16) - stain * 8;
      img.data[i + 1] = shade(n, 230 - age * 16, 14) - stain * 6;
      img.data[i + 2] = shade(n, 216 - age * 12, 12) - stain * 4;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return canvasTexture(c, { repeat: true });
}

function roofMap() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#2a3140';
  g.fillRect(0, 0, size, size);
  const rowH = 28;
  for (let y = 0; y < size + rowH; y += rowH) {
    const offset = (y / rowH) % 2 === 0 ? 0 : 18;
    for (let x = -20; x < size + 20; x += 36) {
      g.fillStyle = '#3c4558';
      g.beginPath();
      g.arc(x + offset, y + 6, 20, Math.PI, 0);
      g.fill();
      g.strokeStyle = '#0c0e14';
      g.lineWidth = 2;
      g.stroke();
      g.strokeStyle = 'rgba(180, 190, 210, 0.18)';
      g.beginPath();
      g.arc(x + offset - 4, y + 4, 16, Math.PI * 1.05, Math.PI * 1.55);
      g.stroke();
    }
  }
  const img = g.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (hash((i / 4) % size, (i / 4) / size) - 0.5) * 16;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  return canvasTexture(c, { repeat: true });
}

function woodMap() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    const band = Math.sin(y * 0.35) * 8 + Math.sin(y * 0.08) * 14;
    for (let x = 0; x < size; x += 1) {
      const n = noise(x * 0.08, y * 0.02);
      const i = (y * size + x) * 4;
      img.data[i] = shade(n, 112 + band, 28);
      img.data[i + 1] = shade(n, 72 + band * 0.6, 18);
      img.data[i + 2] = shade(n, 42 + band * 0.3, 12);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return canvasTexture(c, { repeat: true });
}

function stoneMap() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#5c584f';
  g.fillRect(0, 0, size, size);
  g.strokeStyle = '#3a3832';
  g.lineWidth = 3;
  const h = 32;
  for (let y = 0; y < size; y += h) {
    g.strokeRect(0, y, size, h);
    const shift = (y / h) % 2 === 0 ? 0 : 40;
    for (let x = shift; x < size; x += 78) g.strokeRect(x, y, 78, h);
  }
  return canvasTexture(c, { repeat: true });
}

function flagstoneMaps() {
  const size = 512;
  const c = document.createElement('canvas');
  const r = document.createElement('canvas');
  c.width = r.width = size;
  c.height = r.height = size;
  const g = c.getContext('2d');
  const rg = r.getContext('2d');
  g.fillStyle = '#5a554e';
  g.fillRect(0, 0, size, size);
  rg.fillStyle = '#d0d0d0';
  rg.fillRect(0, 0, size, size);
  const cols = 5;
  const rows = 5;
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const jx = (hash(i, j) - 0.5) * 18;
      const jy = (hash(i + 3, j + 5) - 0.5) * 14;
      const x = (i + 0.5) * (size / cols) + jx;
      const y = (j + 0.5) * (size / rows) + jy;
      const w = size / cols * (0.72 + hash(i, j + 2) * 0.2);
      const h = size / rows * (0.68 + hash(j, i) * 0.22);
      const tone = 148 + hash(i + 9, j) * 42;
      g.fillStyle = `rgb(${tone + 8}, ${tone + 4}, ${tone - 2})`;
      g.beginPath();
      g.moveTo(x - w * 0.46, y - h * 0.32);
      g.lineTo(x + w * 0.4, y - h * 0.42);
      g.lineTo(x + w * 0.48, y + h * 0.3);
      g.lineTo(x - w * 0.36, y + h * 0.4);
      g.closePath();
      g.fill();
      rg.fillStyle = `rgb(${40 + hash(i, j) * 30}, ${40}, ${40})`;
      rg.beginPath();
      rg.moveTo(x - w * 0.36, y - h * 0.22);
      rg.lineTo(x + w * 0.3, y - h * 0.3);
      rg.lineTo(x + w * 0.34, y + h * 0.2);
      rg.lineTo(x - w * 0.26, y + h * 0.28);
      rg.closePath();
      rg.fill();
    }
  }
  // wet sheen near one edge
  const wet = g.createLinearGradient(0, 0, size, size);
  wet.addColorStop(0, 'rgba(20, 24, 28, 0.18)');
  wet.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = wet;
  g.fillRect(0, 0, size, size);
  return {
    map: canvasTexture(c, { repeat: true }),
    rough: canvasTexture(r, { color: false, repeat: true }),
  };
}

function latticeMap() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  g.clearRect(0, 0, size, size);
  g.fillStyle = '#3a2418';
  g.fillRect(0, 0, size, 16);
  g.fillRect(0, size - 16, size, 16);
  g.fillRect(0, 0, 16, size);
  g.fillRect(size - 16, 0, 16, size);
  g.strokeStyle = '#4a3020';
  g.lineWidth = 7;
  const cells = 4;
  for (let i = 1; i < cells; i += 1) {
    const p = 16 + ((size - 32) * i) / cells;
    g.beginPath();
    g.moveTo(p, 16);
    g.lineTo(p, size - 16);
    g.stroke();
    g.beginPath();
    g.moveTo(16, p);
    g.lineTo(size - 16, p);
    g.stroke();
  }
  return canvasTexture(c, { color: true, repeat: false });
}

function doorMap() {
  const w = 256;
  const h = 384;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#4a301f';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 6; i += 1) {
    g.fillStyle = i % 2 ? '#3e2818' : '#583c28';
    g.fillRect(12 + i * 38, 10, 32, h - 20);
  }
  g.fillStyle = '#c8a15a';
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      g.beginPath();
      g.arc(48 + col * 52, 70 + row * 58, 5, 0, Math.PI * 2);
      g.fill();
    }
  }
  return canvasTexture(c);
}

function umbrellaMap(paper, rib) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  g.clearRect(0, 0, size, size);
  const grd = g.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size / 2);
  grd.addColorStop(0, '#f2d7a2');
  grd.addColorStop(0.18, paper);
  grd.addColorStop(1, paper);
  g.fillStyle = grd;
  g.beginPath();
  g.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = rib;
  g.lineWidth = 2;
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2;
    g.beginPath();
    g.moveTo(size / 2, size / 2);
    g.lineTo(size / 2 + Math.cos(a) * (size / 2 - 6), size / 2 + Math.sin(a) * (size / 2 - 6));
    g.stroke();
  }
  g.strokeStyle = 'rgba(80, 30, 20, 0.35)';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2);
  g.stroke();
  return canvasTexture(c);
}

function glowMap() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,0.95)');
  grd.addColorStop(0.25, 'rgba(255,220,180,0.45)');
  grd.addColorStop(1, 'rgba(255,160,80,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return canvasTexture(c, { color: true });
}

export function createTextTexture({
  text,
  width,
  height,
  bg = '#6a432c',
  fg = '#f3e0c4',
  vertical = false,
  fontSize = 72,
  padding = 24,
}) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, width, height);
  g.strokeStyle = 'rgba(28, 16, 10, 0.45)';
  g.lineWidth = Math.max(4, width * 0.02);
  g.strokeRect(8, 8, width - 16, height - 16);
  g.fillStyle = fg;
  g.font = `${fontSize}px "Jiangnan Calligraphy", serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (vertical) {
    const chars = Array.from(text);
    const step = (height - padding * 2) / chars.length;
    chars.forEach((ch, i) => {
      g.fillText(ch, width / 2, padding + step * (i + 0.55));
    });
  } else {
    g.fillText(text, width / 2, height / 2 + fontSize * 0.06);
  }
  return canvasTexture(c);
}
