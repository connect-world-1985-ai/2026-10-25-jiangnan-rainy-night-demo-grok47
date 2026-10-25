import * as THREE from 'three';
import {
  ALLEYS,
  BRIDGES,
  BUILDINGS,
  LANDINGS,
  SHOTS,
  TOWN,
  WATER_Y,
  bridgeDeckY,
  groundHeight,
} from './layout.js';
import {
  curvedRoofGeometry,
  flipWinding,
  gableCrown,
  mergeList,
  meshFrom,
  placeBox,
  stamp,
  tileUVs,
} from './geom.js';
import { createTextTexture } from './textures.js';
import { LOOK } from './look.js';
import { hideInReflection } from './reflect.js';

const buckets = {
  wall: [],
  roof: [],
  soffit: [],
  wood: [],
  stone: [],
  glow: [],
  lattice: [],
  door: [],
  doorRed: [],
  plant: [],
};

const lanterns = [];
const flags = [];
const people = [];
const boats = [];
let willowMat = null;
let willowMesh = null;
const ribbonGeos = [];

function eaveOf(floors) {
  return floors === 1 ? 3.42 : 6.12;
}
function liftOf(floors) {
  return floors === 1 ? 1.12 : 1.26;
}
function roll(n) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function hangLantern(x, y, z, priority) {
  lanterns.push({ x, y, z, phase: roll(x * 3.1 + z) * Math.PI * 2, priority });
}

function addWindow(x, y, z, dir, w, h, lit, axis) {
  if (axis === 'z') {
    const cz = z + dir * 0.05;
    if (lit) placeBox(buckets.glow, w * 0.76, h * 0.76, 0.04, x, y, cz);
    placeBox(buckets.wood, w, 0.07, 0.06, x, y + h / 2, cz + dir * 0.01);
    placeBox(buckets.wood, w, 0.07, 0.06, x, y - h / 2, cz + dir * 0.01);
    placeBox(buckets.wood, 0.07, h, 0.06, x - w / 2, y, cz + dir * 0.01);
    placeBox(buckets.wood, 0.07, h, 0.06, x + w / 2, y, cz + dir * 0.01);
    const plane = new THREE.PlaneGeometry(w * 0.9, h * 0.9);
    if (dir < 0) plane.rotateY(Math.PI);
    plane.translate(x, y, cz + dir * 0.025);
    buckets.lattice.push(plane);
    return;
  }
  const cx = x + dir * 0.05;
  if (lit) placeBox(buckets.glow, 0.04, h * 0.76, w * 0.76, cx, y, z);
  placeBox(buckets.wood, 0.06, 0.07, w, cx + dir * 0.01, y + h / 2, z);
  placeBox(buckets.wood, 0.06, 0.07, w, cx + dir * 0.01, y - h / 2, z);
  placeBox(buckets.wood, 0.06, h, 0.07, cx + dir * 0.01, y, z - w / 2);
  placeBox(buckets.wood, 0.06, h, 0.07, cx + dir * 0.01, y, z + w / 2);
  const plane = new THREE.PlaneGeometry(w * 0.9, h * 0.9);
  plane.rotateY(dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  plane.translate(cx + dir * 0.025, y, z);
  buckets.lattice.push(plane);
}

function addDoor(x, z, dir, red) {
  const w = 1.02;
  const h = 1.88;
  const y = 0.46 + h / 2;
  const cx = x + dir * 0.055;
  const plane = new THREE.PlaneGeometry(w * 0.92, h * 0.96);
  plane.rotateY(dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  plane.translate(cx, y, z);
  (red ? buckets.doorRed : buckets.door).push(plane);
  placeBox(buckets.wood, 0.08, 0.1, w + 0.18, cx + dir * 0.02, y + h / 2, z);
  placeBox(buckets.wood, 0.08, h, 0.1, cx + dir * 0.02, y, z - w / 2 - 0.04);
  placeBox(buckets.wood, 0.08, h, 0.1, cx + dir * 0.02, y, z + w / 2 + 0.04);
  placeBox(buckets.stone, 0.28, 0.36, 0.22, cx + dir * 0.18, 0.2, z - 0.72);
  placeBox(buckets.stone, 0.28, 0.36, 0.22, cx + dir * 0.18, 0.2, z + 0.72);
}

function addBuilding(b) {
  const eave = eaveOf(b.floors);
  const lift = liftOf(b.floors);
  const dir = b.side === 'left' ? 1 : -1;
  const baseH = 0.4;
  placeBox(buckets.stone, b.w + 0.1, baseH, b.d + 0.08, b.x, baseH / 2 + 0.01, b.z);

  if (b.floors === 1) {
    const h = eave - baseH;
    placeBox(buckets.wall, b.w - 0.18, h, b.d, b.x, baseH + h / 2, b.z);
  } else {
    const mid = 3.18;
    const lowerH = mid - baseH;
    placeBox(buckets.wall, b.w - 0.18, lowerH, b.d, b.x, baseH + lowerH / 2, b.z);
    const upperD = b.d + 0.36;
    const shift = dir * 0.18;
    const upperH = eave - mid;
    placeBox(buckets.wall, b.w - 0.1, upperH, upperD, b.x + shift, mid + upperH / 2, b.z);
    placeBox(buckets.wood, b.w - 0.3, 0.08, 0.42, b.front + dir * 0.18, mid - 0.01, b.z);
  }

  const roof = curvedRoofGeometry(b.w, b.d, lift);
  roof.translate(b.x, eave, b.z);
  buckets.roof.push(roof);
  const soffit = curvedRoofGeometry(b.w, b.d, lift);
  flipWinding(soffit);
  soffit.translate(b.x, eave - 0.07, b.z);
  buckets.soffit.push(soffit);
  placeBox(buckets.roof, 0.22, 0.14, b.w * 0.9, b.x, eave + lift + 0.02, b.z);

  const gableDepth = b.floors === 2 ? b.d + 0.36 : b.d;
  const gableShift = b.floors === 2 ? dir * 0.18 : 0;
  const crown = gableCrown(gableDepth, eave, eave + lift);
  for (const end of [-1, 1]) {
    const gz = end < 0 ? b.minZ - 0.01 : b.maxZ + 0.01;
    const piece = crown.geo.clone();
    piece.translate(b.x + gableShift, 0, gz);
    buckets.wall.push(piece);
    for (const cap of crown.caps) {
      const width = Math.abs(cap.x1 - cap.x0);
      if (width < 0.05) continue;
      placeBox(
        buckets.roof,
        width,
        0.09,
        0.46,
        b.x + gableShift + (cap.x0 + cap.x1) / 2,
        cap.y + 0.03,
        gz,
      );
    }
  }
  crown.geo.dispose();

  const lowerFront = b.front;
  const upperFront = b.floors === 2 ? b.front + dir * 0.36 : b.front;
  const doorZ = b.z + (b.role ? 0 : (b.w > 6.2 ? 0.7 : 0));
  addDoor(lowerFront, doorZ, dir, b.role === 'tea');

  const wide = b.w > 6.4;
  addWindow(lowerFront, 1.55, doorZ + dir * 0 + (wide ? -1.55 : 1.35), dir, 0.78, 1.05, roll(b.z + 1) > 0.28, 'x');
  if (wide) addWindow(lowerFront, 1.55, doorZ + 1.7, dir, 0.72, 0.95, roll(b.z + 2) > 0.4, 'x');
  if (b.floors === 2) {
    addWindow(upperFront, 4.55, b.z - b.w * 0.22, dir, 0.92, 1.15, roll(b.z + 4) > 0.22, 'x');
    addWindow(upperFront, 4.55, b.z + b.w * 0.22, dir, 0.92, 1.15, roll(b.z + 5) > 0.3, 'x');
    if (b.role === 'tea') addWindow(upperFront, 4.55, b.z, dir, 0.8, 1.15, true, 'x');
  }

  placeBox(buckets.wood, 0.14, eave - 0.5, 0.14, lowerFront + dir * 0.08, eave * 0.48, b.minZ + 0.3);
  placeBox(buckets.wood, 0.14, eave - 0.5, 0.14, lowerFront + dir * 0.08, eave * 0.48, b.maxZ - 0.3);
  placeBox(buckets.wood, 0.12, 0.16, b.w - 0.2, lowerFront + dir * 0.16, eave - 0.02, b.z);

  const eaveX = b.x + dir * (b.d / 2 + 0.58);
  const priority = b.role === 'tea' ? 0 : b.role === 'wine' || b.role === 'teaflag' ? 1 : 3;
  hangLantern(eaveX, eave - 0.02, b.z - Math.min(1.4, b.w * 0.28), priority);
  hangLantern(eaveX, eave - 0.02, b.z + Math.min(1.4, b.w * 0.28), priority);
  hangLantern(lowerFront + dir * 0.55, 2.55, doorZ, b.role === 'tea' ? 0 : priority + 1);

  if (b.role === 'tea') {
    const y = 3.22;
    const fx = upperFront + dir * 0.02;
    placeBox(buckets.wood, 0.1, 0.06, b.w * 0.7, fx, y, b.z);
    placeBox(buckets.wood, 0.05, 0.34, 0.05, fx, y + 0.2, b.z - b.w * 0.32);
    placeBox(buckets.wood, 0.05, 0.34, 0.05, fx, y + 0.2, b.z + b.w * 0.32);
    placeBox(buckets.wood, 0.04, 0.045, b.w * 0.64, fx, y + 0.38, b.z);
    hangLantern(eaveX, eave - 0.02, b.z, 0);
  }
}

function addBridge(root, bridge) {
  const segX = 30;
  const segZ = 8;
  const ramp = 1.5;
  const hz = bridge.halfWidth + ramp;
  const cols = segX + 1;
  const verts = [];
  for (let iz = 0; iz <= segZ; iz += 1) {
    for (let ix = 0; ix <= segX; ix += 1) {
      const x = -bridge.halfLen + (ix / segX) * bridge.halfLen * 2;
      const z = bridge.z - hz + (iz / segZ) * hz * 2;
      verts.push({ x, y: bridgeDeckY(x, z, bridge), z });
    }
  }
  const positions = [];
  const uvs = [];
  const indices = [];
  const count = verts.length;
  const thickness = 0.4;
  for (const v of verts) {
    positions.push(v.x, Math.max(v.y, 0), v.z);
    uvs.push(v.x * 0.35, v.z * 0.35);
  }
  for (const v of verts) {
    positions.push(v.x, Math.max(v.y, 0) - thickness, v.z);
    uvs.push(v.x * 0.35, v.z * 0.35);
  }
  const kept = [];
  for (let iz = 0; iz < segZ; iz += 1) {
    for (let ix = 0; ix < segX; ix += 1) {
      const ys = [verts[iz * cols + ix], verts[iz * cols + ix + 1], verts[(iz + 1) * cols + ix], verts[(iz + 1) * cols + ix + 1]];
      kept.push(Math.min(ys[0].y, ys[1].y, ys[2].y, ys[3].y) > 0.02);
    }
  }
  const keptAt = (ix, iz) => ix >= 0 && iz >= 0 && ix < segX && iz < segZ && kept[iz * segX + ix];
  const vIndex = (ix, iz, bottom) => iz * cols + ix + (bottom ? count : 0);
  for (let iz = 0; iz < segZ; iz += 1) {
    for (let ix = 0; ix < segX; ix += 1) {
      if (!keptAt(ix, iz)) continue;
      const a = vIndex(ix, iz, false);
      const b = vIndex(ix + 1, iz, false);
      const c = vIndex(ix, iz + 1, false);
      const d = vIndex(ix + 1, iz + 1, false);
      indices.push(a, c, b, b, c, d);
      const a2 = vIndex(ix, iz, true);
      const b2 = vIndex(ix + 1, iz, true);
      const c2 = vIndex(ix, iz + 1, true);
      const d2 = vIndex(ix + 1, iz + 1, true);
      indices.push(a2, b2, c2, b2, d2, c2);
      const skirts = [
        [!keptAt(ix, iz - 1), a, b, a2, b2],
        [!keptAt(ix, iz + 1), c, d, c2, d2],
        [!keptAt(ix - 1, iz), a, c, a2, c2],
        [!keptAt(ix + 1, iz), b, d, b2, d2],
      ];
      for (const [open, p, q, p2, q2] of skirts) {
        if (!open) continue;
        indices.push(p, q, p2, q, q2, p2);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  buckets.stone.push(geo);

  for (let i = 0; i <= 8; i += 1) {
    const x = -bridge.halfLen * 0.92 + (i / 8) * bridge.halfLen * 1.84;
    const y = bridgeDeckY(x, bridge.z, bridge);
    if (y < 0.28) continue;
    for (const side of [-1, 1]) {
      const z = bridge.z + side * bridge.halfWidth;
      placeBox(buckets.stone, 0.16, 0.78, 0.16, x, y + 0.39, z);
    }
  }
  for (let i = 0; i < 8; i += 1) {
    const x0 = -bridge.halfLen * 0.92 + (i / 8) * bridge.halfLen * 1.84;
    const x1 = -bridge.halfLen * 0.92 + ((i + 1) / 8) * bridge.halfLen * 1.84;
    const y0 = bridgeDeckY(x0, bridge.z, bridge);
    const y1 = bridgeDeckY(x1, bridge.z, bridge);
    if (y0 < 0.28 || y1 < 0.28) continue;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const ang = Math.atan2(y1 - y0, x1 - x0);
    for (const side of [-1, 1]) {
      const z = bridge.z + side * bridge.halfWidth;
      placeBox(buckets.stone, len, 0.1, 0.14, (x0 + x1) / 2, (y0 + y1) / 2 + 0.72, z, 0, 0, ang);
      placeBox(buckets.stone, len, 0.08, 0.1, (x0 + x1) / 2, (y0 + y1) / 2 + 0.28, z, 0, 0, ang);
    }
  }
  for (const side of [-1, 1]) {
    const x = side * 4.4;
    const y = bridgeDeckY(x, bridge.z, bridge);
    const z = bridge.z + bridge.halfWidth * 0.15 * side;
    placeBox(buckets.wood, 0.08, 0.08, 0.9, x, y + 1.55, bridge.z);
    hangLantern(x, y + 1.48, bridge.z + side * 0.15, 1);
    root.userData.bridgeLantern = true;
    void z;
  }
}

function addBanks() {
  const cuts = [-52, ...LANDINGS, 54];
  for (const side of [-1, 1]) {
    for (let i = 0; i < cuts.length - 1; i += 1) {
      let z0 = cuts[i];
      let z1 = cuts[i + 1];
      if (i > 0) z0 += 0.85;
      if (i < cuts.length - 2) z1 -= 0.85;
      if (z1 - z0 < 0.5) continue;
      const height = -WATER_Y;
      const x = side * (TOWN.bank + 0.16);
      placeBox(buckets.stone, 0.38, height, z1 - z0, x, WATER_Y + height / 2, (z0 + z1) / 2);
      placeBox(buckets.stone, 0.62, 0.12, z1 - z0, side * (TOWN.bank + 0.05), -0.02, (z0 + z1) / 2);
    }
    for (const lz of LANDINGS) {
      if (BRIDGES.some((b) => Math.abs(lz - b.z) < b.halfWidth + 2.4)) continue;
      for (let s = 0; s < 4; s += 1) {
        const x = side * (TOWN.bank + 0.05 - s * 0.26);
        const y = -0.02 - s * 0.2;
        if (y < WATER_Y + 0.02) continue;
        placeBox(buckets.stone, 0.3, 0.12, 1.25, x, y, lz);
      }
    }
  }
}

function addGround(root, materials) {
  const span = 30 - TOWN.bank;
  const geoL = new THREE.PlaneGeometry(span, 98);
  geoL.rotateX(-Math.PI / 2);
  geoL.translate(-(30 + TOWN.bank) / 2, 0.004, 2);
  const geoR = geoL.clone();
  geoR.translate((30 + TOWN.bank), 0, 0);
  const streetGeo = mergeList([geoL, geoR]);
  tileUVs(streetGeo, 1.7);
  const street = meshFrom(streetGeo, materials.street);
  root.add(street);

  const bed = new THREE.PlaneGeometry(6.85, 96);
  bed.rotateX(-Math.PI / 2);
  bed.translate(0, WATER_Y - 0.4, 2);
  const mud = meshFrom(bed, materials.earth, { cast: false, receive: false });
  root.add(mud);
}

function addReeds() {
  const geo = new THREE.ConeGeometry(0.045, 0.85, 4);
  geo.translate(0, 0.15, 0);
  const spots = [-30, -22, -8, 1, 16, 24, 33];
  for (const z of spots) {
    if (BRIDGES.some((b) => Math.abs(z - b.z) < 2.4)) continue;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i += 1) {
        const copy = geo.clone();
        stamp(copy, side * (3.35 + roll(z + i) * 0.25), WATER_Y + 0.15, z + (i - 2) * 0.18, 0, roll(i + z) * 2, (roll(i) - 0.5) * 0.4);
        buckets.plant.push(copy);
      }
    }
  }
  geo.dispose();
}

function addWillow(x, z, lean) {
  const points = [];
  for (let i = 0; i <= 5; i += 1) {
    const t = i / 5;
    points.push(new THREE.Vector3(
      x + lean * t ** 1.5 * 1.35,
      t * 4.15,
      z + Math.sin(t * Math.PI) * 0.18,
    ));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  buckets.wood.push(new THREE.TubeGeometry(curve, 7, 0.075, 4, false));
  for (let i = 0; i < 7; i += 1) {
    const start = curve.getPoint(0.62 + roll(i + z) * 0.32);
    const tip = new THREE.Vector3(
      start.x + lean * (1.1 + roll(i + 2) * 0.8),
      0.35 + roll(i + 4) * 0.7,
      start.z + (roll(i + 8) - 0.5) * 1.4,
    );
    const mid = start.clone().lerp(tip, 0.45);
    mid.y -= 0.35;
    ribbonGeos.push(ribbon(start, mid, tip, 0.16 + roll(i) * 0.08, roll(i + x) * 6));
  }
}

function ribbon(p0, p1, p2, width, phase) {
  const seg = 6;
  const positions = [];
  const uvs = [];
  const phases = [];
  const indices = [];
  for (let i = 0; i <= seg; i += 1) {
    const t = i / seg;
    const u = 1 - t;
    const x = u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x;
    const y = u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y;
    const z = u * u * p0.z + 2 * u * t * p1.z + t * t * p2.z;
    positions.push(x, y, z - width / 2, x, y, z + width / 2);
    uvs.push(0, t, 1, t);
    phases.push(phase, phase);
  }
  for (let i = 0; i < seg; i += 1) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function hullGeometry() {
  const length = 4.25;
  const seg = 12;
  const cols = 7;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= seg; i += 1) {
    const t = i / seg;
    const z = (t - 0.5) * length;
    const taper = Math.sin(t * Math.PI) ** 0.6;
    const beam = 0.42 * (0.28 + 0.72 * taper);
    const rise = 0.1 * (1 - taper);
    const keel = -0.1;
    const gun = 0.36 + rise;
    for (let j = 0; j < cols; j += 1) {
      const s = j / (cols - 1);
      const x = (s * 2 - 1) * beam;
      const bottom = Math.sin(s * Math.PI);
      const y = gun - bottom * (gun - keel);
      positions.push(x, y, z);
      uvs.push(s, t);
    }
  }
  for (let i = 0; i < seg; i += 1) {
    for (let j = 0; j < cols - 1; j += 1) {
      const a = i * cols + j;
      indices.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function lanternGroup(materials) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(shared.lathe, materials.lantern);
  const cap = new THREE.Mesh(shared.cap, materials.cap);
  cap.position.y = 0.2;
  const tassel = new THREE.Mesh(shared.tassel, materials.tassel);
  tassel.position.y = -0.24;
  group.add(body, cap, tassel);
  return group;
}

const shared = {};

function ensureShared(materials) {
  if (shared.ready) return;
  shared.lathe = new THREE.LatheGeometry([
    new THREE.Vector2(0.02, 0.18),
    new THREE.Vector2(0.085, 0.1),
    new THREE.Vector2(0.115, 0),
    new THREE.Vector2(0.08, -0.11),
    new THREE.Vector2(0.02, -0.17),
  ], 10);
  shared.cap = new THREE.CylinderGeometry(0.045, 0.07, 0.06, 6);
  shared.tassel = new THREE.CylinderGeometry(0.012, 0.004, 0.16, 4);
  shared.robe = new THREE.ConeGeometry(0.32, 1.12, 7);
  shared.head = new THREE.SphereGeometry(0.11, 8, 6);
  shared.canopy = new THREE.ConeGeometry(0.58, 0.18, 9, 1, true);
  shared.handle = new THREE.CylinderGeometry(0.015, 0.015, 0.8, 5);
  shared.ready = true;
  void materials;
}

function createBoat(materials, x, z, patrol) {
  ensureShared(materials);
  const group = new THREE.Group();
  const hull = new THREE.Mesh(hullGeometry(), materials.hull);
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);
  const canopyGeo = new THREE.CylinderGeometry(0.58, 0.62, 2.05, 8, 1, true, 0, Math.PI);
  canopyGeo.rotateZ(Math.PI / 2);
  canopyGeo.rotateY(Math.PI / 2);
  const canopy = new THREE.Mesh(canopyGeo, materials.canopy);
  canopy.position.set(0, 0.42, -0.05);
  group.add(canopy);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.35), materials.wood);
  seat.position.set(0, 0.22, 0.15);
  group.add(seat);
  const figure = new THREE.Mesh(shared.robe, materials.robeBrown);
  figure.scale.set(0.55, 0.45, 0.55);
  figure.position.set(0, 0.42, -0.15);
  group.add(figure);
  const oar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 1.8), materials.wood);
  oar.position.set(0.55, 0.35, 0.4);
  oar.rotation.y = 0.5;
  oar.rotation.z = 0.4;
  group.add(oar);
  const lamp = lanternGroup(materials);
  lamp.scale.setScalar(0.65);
  lamp.position.set(0, 0.72, 1.85);
  group.add(lamp);
  group.position.set(x, WATER_Y, z);
  group.userData.patrol = patrol;
  group.userData.phase = roll(x + z) * 6;
  group.userData.heading = 0;
  group.userData.baseX = x;
  boats.push(group);
  return group;
}

function addPerson(root, materials, x, z, rot, robe, umbrella) {
  ensureShared(materials);
  const group = new THREE.Group();
  group.position.set(x, groundHeight(x, z), z);
  group.rotation.y = rot;
  const cloth = new THREE.Mesh(shared.robe, robe);
  cloth.position.y = 0.62;
  cloth.castShadow = true;
  const head = new THREE.Mesh(shared.head, materials.skin);
  head.position.y = 1.3;
  const hair = new THREE.Mesh(shared.head, materials.hair);
  hair.scale.set(1.02, 0.62, 1.02);
  hair.position.y = 1.38;
  const canopy = new THREE.Mesh(shared.canopy, umbrella);
  canopy.position.y = 0.08;
  const handle = new THREE.Mesh(shared.handle, materials.wood);
  handle.position.y = -0.32;
  const umb = new THREE.Group();
  umb.position.y = 1.72;
  umb.add(canopy, handle);
  group.add(cloth, head, hair, umb);
  group.userData.phase = roll(x * 2 + z) * 5;
  people.push(group);
  root.add(group);
}

function addSigns(root, materials) {
  const tea = BUILDINGS.find((b) => b.role === 'tea');
  const wine = BUILDINGS.find((b) => b.role === 'wine');
  const teaflag = BUILDINGS.find((b) => b.role === 'teaflag');
  const dir = 1;
  const plaque = createTextTexture({
    text: '听雨楼',
    width: 640,
    height: 200,
    bg: '#5c3a28',
    fg: '#f6e6cf',
    fontSize: 108,
  });
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(2.15, 0.62),
    new THREE.MeshStandardMaterial({ map: plaque, roughness: 0.72 }),
  );
  board.position.set(tea.front + dir * 0.12, 2.95, tea.z);
  board.rotation.y = Math.PI / 2;
  root.add(board);

  const leftVerse = createTextTexture({
    text: '夜雨敲青石',
    width: 180,
    height: 640,
    bg: '#4e3424',
    fg: '#f3e2c8',
    vertical: true,
    fontSize: 72,
    padding: 36,
  });
  const rightVerse = createTextTexture({
    text: '扁舟泊水乡',
    width: 180,
    height: 640,
    bg: '#4e3424',
    fg: '#f3e2c8',
    vertical: true,
    fontSize: 72,
    padding: 36,
  });
  for (const [tex, z] of [[leftVerse, tea.z - 1.15], [rightVerse, tea.z + 1.15]]) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 1.45),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }),
    );
    mesh.position.set(tea.front + dir * 0.1, 1.85, z);
    mesh.rotation.y = Math.PI / 2;
    root.add(mesh);
  }

  const wineTex = createTextTexture({
    text: '酒',
    width: 256,
    height: 256,
    bg: '#7a221c',
    fg: '#f0d7a4',
    fontSize: 150,
  });
  const wineFlag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.78),
    new THREE.MeshStandardMaterial({ map: wineTex, roughness: 0.65, side: THREE.DoubleSide }),
  );
  wineFlag.position.y = -0.42;
  const winePivot = new THREE.Group();
  winePivot.position.set(wine.front + dir * 0.85, 3.15, wine.z + 0.2);
  winePivot.add(wineFlag);
  winePivot.userData.phase = 1.2;
  flags.push(winePivot);
  root.add(winePivot);
  placeBox(buckets.wood, 0.06, 2.4, 0.06, wine.front + dir * 0.85, 1.6, wine.z + 0.2);

  const teaTex = createTextTexture({
    text: '茶',
    width: 200,
    height: 420,
    bg: '#1c2830',
    fg: '#f4ead8',
    vertical: true,
    fontSize: 140,
    padding: 40,
  });
  const teaCloth = new THREE.Mesh(
    new THREE.PlaneGeometry(0.48, 1.05),
    new THREE.MeshStandardMaterial({ map: teaTex, roughness: 0.7, side: THREE.DoubleSide }),
  );
  teaCloth.position.y = -0.55;
  const teaPivot = new THREE.Group();
  const tdir = -1;
  teaPivot.position.set(teaflag.front + tdir * 0.7, 3.35, teaflag.z);
  teaPivot.rotation.y = Math.PI;
  teaPivot.add(teaCloth);
  teaPivot.userData.phase = 2.4;
  flags.push(teaPivot);
  root.add(teaPivot);
  placeBox(buckets.wood, 0.06, 2.6, 0.06, teaflag.front + tdir * 0.7, 1.7, teaflag.z);
}

function addPavilion(root) {
  const z = 46.5;
  const y0 = 0.05;
  for (const [x, zz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) {
    placeBox(buckets.wood, 0.12, 2.4, 0.12, x, WATER_Y + 1.2, z + zz);
  }
  placeBox(buckets.wood, 2.6, 0.1, 2.6, 0, y0, z);
  const roof = curvedRoofGeometry(2.5, 2.5, 0.7);
  roof.translate(0, 2.15, z);
  buckets.roof.push(roof);
  hangLantern(0, 1.9, z, 2);
  void root;
}

function addAlleyDressing() {
  for (const alley of ALLEYS) {
    if (!alley.wide) continue;
    const x = (alley.minX + alley.maxX) / 2;
    placeBox(buckets.wood, Math.abs(alley.leftBuilding.front) > 0 ? 0.08 : 0.08, 0.08, alley.maxZ - alley.minZ, x, 3.05, alley.midZ);
    hangLantern(x, 2.85, alley.midZ, 0);
    const faceA = alley.side === 'left' ? alley.leftBuilding : alley.rightBuilding;
    void faceA;
    addWindow(
      alley.side === 'left' ? alley.leftBuilding.x : alley.rightBuilding.x,
      1.7,
      alley.side === 'left' ? alley.leftBuilding.maxZ : alley.rightBuilding.minZ,
      alley.side === 'left' ? 1 : -1,
      0.7,
      0.95,
      true,
      'z',
    );
  }
}

function buildLanterns(root, materials, glowMap) {
  ensureShared(materials);
  const count = lanterns.length;
  const body = new THREE.InstancedMesh(shared.lathe, materials.lantern, count);
  const cap = new THREE.InstancedMesh(shared.cap, materials.cap, count);
  const tassel = new THREE.InstancedMesh(shared.tassel, materials.tassel, count);
  body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cap.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  tassel.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (const mesh of [body, cap, tassel]) {
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    root.add(mesh);
  }

  const positions = new Float32Array(count * 3);
  lanterns.forEach((lantern, i) => {
    positions[i * 3] = lantern.x;
    positions[i * 3 + 1] = lantern.y;
    positions[i * 3 + 2] = lantern.z;
  });
  const points = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3)),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uMap: { value: glowMap },
        uSize: { value: 78 },
      },
      vertexShader: /* glsl */ `
        uniform float uSize;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = uSize * (1.4 / max(0.35, -mv.z));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          if (tex.a < 0.03) discard;
          gl_FragColor = vec4(1.0, 0.68, 0.38, tex.a * 0.55);
        }
      `,
    }),
  );
  points.frustumCulled = false;
  points.renderOrder = 2;
  root.add(points);
  hideInReflection.push(points);

  const poolBase = new THREE.PlaneGeometry(1.6, 2.4);
  poolBase.rotateX(-Math.PI / 2);
  const pools = new THREE.InstancedMesh(poolBase, new THREE.MeshBasicMaterial({
    color: 0xff8a3a,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), count);
  const dummy = new THREE.Object3D();
  lanterns.forEach((lantern, i) => {
    const groundY = lantern.y > 2.2 ? groundHeight(lantern.x, lantern.z) + 0.05 : WATER_Y + 0.08;
    dummy.position.set(lantern.x, Math.min(lantern.y - 0.4, groundY + 0.2) > 3 ? groundHeight(lantern.x, lantern.z) + 0.06 : groundHeight(lantern.x, lantern.z) + 0.06, lantern.z);
    dummy.scale.set(lantern.priority <= 1 ? 1.15 : 0.75, 1, 1);
    dummy.updateMatrix();
    pools.setMatrixAt(i, dummy.matrix);
  });
  pools.instanceMatrix.needsUpdate = true;
  pools.frustumCulled = false;
  pools.renderOrder = 1;
  root.add(pools);
  hideInReflection.push(pools);

  const ordered = lanterns.map((lantern, index) => ({ lantern, index })).sort((a, b) => a.lantern.priority - b.lantern.priority);
  const lights = [];
  for (let i = 0; i < Math.min(12, ordered.length); i += 1) {
    const lantern = ordered[i].lantern;
    const light = new THREE.PointLight(0xff8a3c, LOOK.lantern, LOOK.lanternDistance, 2);
    light.position.set(lantern.x, lantern.y - 0.12, lantern.z);
    light.userData.base = LOOK.lantern * (lantern.priority === 0 ? 1.2 : lantern.priority === 1 ? 1 : 0.75);
    light.userData.phase = lantern.phase;
    light.userData.anchor = lantern;
    root.add(light);
    lights.push(light);
  }

  return { body, cap, tassel, lights, points };
}

function flush(root, materials) {
  const specs = [
    ['wall', materials.wall, true, true],
    ['roof', materials.roof, true, true],
    ['soffit', materials.soffit, false, false],
    ['wood', materials.wood, true, true],
    ['stone', materials.stone, true, true],
    ['glow', materials.glow, false, false],
    ['lattice', materials.lattice, false, false],
    ['door', materials.door, false, true],
    ['doorRed', materials.doorRed, false, true],
    ['plant', materials.plant, false, false],
  ];
  for (const [key, material, cast, receive] of specs) {
    const geo = mergeList(buckets[key]);
    if (!geo) continue;
    if (key !== 'lattice' && key !== 'door' && key !== 'doorRed' && key !== 'glow') {
      const scale = key === 'roof' || key === 'soffit' ? 0.85 : key === 'stone' ? 1.3 : 1.6;
      tileUVs(geo, scale);
    }
    const mesh = meshFrom(geo, material, { cast, receive });
    if (mesh) root.add(mesh);
    buckets[key] = [];
  }
}

export function createTown(materials, textures) {
  const root = new THREE.Group();
  ensureShared(materials);
  addGround(root, materials);
  addBanks();
  for (const building of BUILDINGS) addBuilding(building);
  addAlleyDressing();
  for (const bridge of BRIDGES) addBridge(root, bridge);
  addReeds();
  addWillow(-4.25, -28, 1);
  addWillow(-4.2, -6.2, 1);
  addWillow(-4.22, 18.5, 1);
  addWillow(-4.18, 31, 1);
  addWillow(4.22, -23, -1);
  addWillow(4.2, 3.2, -1);
  addWillow(4.24, 23.5, -1);
  addSigns(root, materials);
  addPavilion(root);

  willowMat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aPhase;
      uniform float uTime;
      varying float vTip;
      void main() {
        float tip = uv.y;
        vec3 p = position;
        p.x += sin(uTime * 0.85 + aPhase + tip * 2.4) * 0.22 * tip;
        p.z += cos(uTime * 0.7 + aPhase) * 0.12 * tip;
        vTip = tip;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vTip;
      void main() {
        vec3 col = mix(vec3(0.08, 0.16, 0.12), vec3(0.32, 0.4, 0.28), vTip);
        float alpha = mix(0.92, 0.2, vTip);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const ribbons = mergeList(ribbonGeos);
  if (ribbons) {
    willowMesh = new THREE.Mesh(ribbons, willowMat);
    willowMesh.frustumCulled = false;
    root.add(willowMesh);
  }

  flush(root, materials);

  const rig = buildLanterns(root, materials, textures.glow);
  root.add(createBoat(materials, 2.05, -21.5, false));
  root.add(createBoat(materials, -2.1, 29.2, false));
  root.add(createBoat(materials, 1.05, 0, true));

  const bridge = BRIDGES[0];
  addPerson(root, materials, 1.15, bridge.z + 0.15, 0.4, materials.robeIndigo, materials.umbrellaRed);
  addPerson(root, materials, -7.2, SHOTS.wideAlley.midZ + 3.1, -0.9, materials.robeBrown, materials.umbrellaOil);
  addPerson(root, materials, 7.05, 2.2, 2.4, materials.robeGreen, materials.umbrellaRed);
  addPerson(root, materials, -0.7, BRIDGES[1].z - 0.1, Math.PI, materials.robeIndigo, materials.umbrellaOil);

  const m = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3(1, 1, 1);
  let heading = 0;

  function update(elapsed, dt, mood) {
    const swayM = m;
    lanterns.forEach((lantern, i) => {
      const sway = Math.sin(elapsed * 0.9 + lantern.phase) * 0.07;
      e.set(sway, 0, sway * 0.6);
      q.setFromEuler(e);
      p.set(lantern.x, lantern.y, lantern.z);
      swayM.compose(p, q, s);
      rig.body.setMatrixAt(i, swayM);
      local.makeTranslation(0, 0.2, 0);
      rig.cap.setMatrixAt(i, local.premultiply(swayM));
      local.makeTranslation(0, -0.22, 0);
      rig.tassel.setMatrixAt(i, local.premultiply(swayM));
    });
    rig.body.instanceMatrix.needsUpdate = true;
    rig.cap.instanceMatrix.needsUpdate = true;
    rig.tassel.instanceMatrix.needsUpdate = true;

    for (const light of rig.lights) {
      const flicker = 0.82 + 0.18 * Math.sin(elapsed * 7.5 + light.userData.phase) * Math.sin(elapsed * 2.2 + light.userData.phase * 2);
      light.intensity = light.userData.base * flicker * mood.lantern;
      const anchor = light.userData.anchor;
      const sway = Math.sin(elapsed * 0.9 + anchor.phase) * 0.07;
      light.position.set(anchor.x + sway * 0.2, anchor.y - 0.12, anchor.z);
    }
    materials.lantern.emissiveIntensity = LOOK.lanternEmissive * (0.92 + 0.08 * Math.sin(elapsed * 5.5));
    materials.glow.emissiveIntensity = LOOK.windowEmissive * (0.94 + 0.06 * Math.sin(elapsed * 3.1));

    const tracks = [];
    for (const boat of boats) {
      const bob = Math.sin(elapsed * 0.85 + boat.userData.phase) * 0.03;
      boat.position.y = WATER_Y + bob;
      boat.rotation.z = Math.sin(elapsed * 0.6 + boat.userData.phase) * 0.02;
      if (boat.userData.patrol) {
        const phase = elapsed * 0.05;
        const z = Math.sin(phase) * 18;
        const vel = Math.cos(phase);
        boat.position.z = z;
        boat.position.x = boat.userData.baseX + Math.sin(phase * 0.5) * 0.15;
        const desired = vel >= 0 ? 0 : Math.PI;
        let delta = desired - heading;
        if (delta > Math.PI) delta -= Math.PI * 2;
        if (delta < -Math.PI) delta += Math.PI * 2;
        heading += delta * Math.min(1, dt * 1.6);
        boat.rotation.y = heading;
      }
      tracks.push({ x: boat.position.x, z: boat.position.z });
    }
    for (const flag of flags) {
      flag.rotation.z = Math.sin(elapsed * 0.8 + flag.userData.phase) * 0.07;
    }
    for (const person of people) {
      person.rotation.z = Math.sin(elapsed * 0.7 + person.userData.phase) * 0.012;
    }
    if (willowMat) willowMat.uniforms.uTime.value = elapsed;
    return { tracks, lights: rig.lights };
  }

  function setLightCount(count) {
    rig.lights.forEach((light, index) => {
      light.visible = index < count;
    });
  }

  return { root, update, setLightCount, lights: rig.lights };
}
