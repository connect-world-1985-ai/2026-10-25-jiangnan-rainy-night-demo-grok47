/** Town plan in meters. X crosses the canal, Z runs along it, Y is up. */

export const WATER_Y = -0.86;
export const EYE = 1.62;

export const TOWN = {
  zMin: -36.5,
  zMax: 39,
  streetInner: 5.28,
  streetOuter: 9.06,
  front: 9.34,
  waterHalf: 3.46,
  bank: 3.86,
};

const LEFT_SPECS = [
  { w: 6.2, d: 6.1, floors: 2, gapAfter: 1.15 },
  { w: 5.3, d: 5.6, floors: 1, gapAfter: 1.2 },
  { w: 6.4, d: 6.4, floors: 2, gapAfter: 2.62 },
  { w: 8.7, d: 7.05, floors: 2, gapAfter: 1.28, role: 'tea' },
  { w: 5.7, d: 6.0, floors: 2, gapAfter: 1.16, role: 'wine' },
  { w: 6.3, d: 5.9, floors: 1, gapAfter: 1.22 },
  { w: 6.8, d: 6.5, floors: 2, gapAfter: 2.2 },
  { w: 5.5, d: 6.0, floors: 2, gapAfter: 1.14 },
  { w: 6.0, d: 5.7, floors: 1, gapAfter: 1.1 },
];

const RIGHT_SPECS = [
  { w: 5.8, d: 6.0, floors: 2, gapAfter: 1.28 },
  { w: 6.7, d: 6.55, floors: 2, gapAfter: 1.18, role: 'teaflag' },
  { w: 5.2, d: 5.5, floors: 1, gapAfter: 2.35 },
  { w: 7.2, d: 6.7, floors: 2, gapAfter: 1.24 },
  { w: 6.0, d: 6.1, floors: 2, gapAfter: 1.18 },
  { w: 5.6, d: 5.8, floors: 1, gapAfter: 1.32 },
  { w: 6.9, d: 6.4, floors: 2, gapAfter: 2.05 },
  { w: 5.9, d: 6.0, floors: 2, gapAfter: 1.16 },
  { w: 6.4, d: 5.8, floors: 1, gapAfter: 1.1 },
];

function row(specs, side, startZ) {
  let cursor = startZ;
  const out = [];
  for (const spec of specs) {
    const { w, d } = spec;
    const z = cursor + w / 2;
    const front = side === 'left' ? -TOWN.front : TOWN.front;
    const x = side === 'left' ? front - d / 2 : front + d / 2;
    const extent = side === 'left' ? front - d : front + d;
    out.push({
      ...spec,
      side,
      x,
      z,
      minX: Math.min(front, extent),
      maxX: Math.max(front, extent),
      minZ: z - w / 2,
      maxZ: z + w / 2,
      front,
    });
    cursor += w + (spec.gapAfter ?? 1.15);
  }
  return out;
}

export const LEFT_BUILDINGS = row(LEFT_SPECS, 'left', -33.4);
export const RIGHT_BUILDINGS = row(RIGHT_SPECS, 'right', -31.2);
export const BUILDINGS = [...LEFT_BUILDINGS, ...RIGHT_BUILDINGS];

function alleysOf(buildings) {
  const out = [];
  for (let i = 0; i < buildings.length - 1; i += 1) {
    const a = buildings[i];
    const b = buildings[i + 1];
    const gap = b.minZ - a.maxZ;
    if (gap < 0.85) continue;
    const back = Math.min(a.minX, b.minX);
    const front = a.side === 'left' ? -TOWN.streetOuter : TOWN.streetOuter;
    const minX = a.side === 'left' ? back + 0.55 : front;
    const maxX = a.side === 'left' ? front : Math.max(a.maxX, b.maxX) - 0.55;
    out.push({
      side: a.side,
      minX,
      maxX,
      minZ: a.maxZ + 0.12,
      maxZ: b.minZ - 0.12,
      midZ: (a.maxZ + b.minZ) / 2,
      wide: gap >= 2.15,
      leftBuilding: a,
      rightBuilding: b,
    });
  }
  return out;
}

export const ALLEYS = [...alleysOf(LEFT_BUILDINGS), ...alleysOf(RIGHT_BUILDINGS)];

const tea = LEFT_BUILDINGS.find((b) => b.role === 'tea');

export const BRIDGES = [
  { z: tea.z - 7.2, halfLen: TOWN.streetOuter, halfWidth: 1.46, H: 1.78 },
  { z: tea.z + 16.8, halfLen: TOWN.streetOuter, halfWidth: 1.32, H: 1.52 },
];

export const LANDINGS = [-27.5, -2.2, 5.6, 27.4];

/** Arch height of a bridge deck, including the street aprons that blend to the road. */
export function bridgeDeckY(x, z, bridge) {
  const arch = bridge.H * Math.max(0, 1 - (x * x) / (bridge.halfLen * bridge.halfLen));
  if (arch <= 0) return 0;
  const dz = Math.abs(z - bridge.z);
  const overWater = Math.abs(x) < TOWN.bank + 0.85;
  const ramp = overWater ? 0 : 1.5;
  if (dz > bridge.halfWidth + ramp) return 0;
  if (dz <= bridge.halfWidth) return arch;
  const t = 1 - (dz - bridge.halfWidth) / ramp;
  const k = t * t * (3 - 2 * t);
  return arch * k;
}

export function groundHeight(x, z) {
  let h = 0;
  for (const bridge of BRIDGES) h = Math.max(h, bridgeDeckY(x, z, bridge));
  return h;
}

function insideBuilding(x, z) {
  for (const b of BUILDINGS) {
    if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) return true;
  }
  return false;
}

export function walkable(x, z) {
  if (z < TOWN.zMin || z > TOWN.zMax) return false;
  if (insideBuilding(x, z)) return false;
  for (const bridge of BRIDGES) {
    if (Math.abs(x) <= bridge.halfLen - 0.02 && Math.abs(z - bridge.z) <= bridge.halfWidth - 0.16) {
      return true;
    }
  }
  if (Math.abs(x) >= TOWN.streetInner && Math.abs(x) <= TOWN.streetOuter) return true;
  for (const alley of ALLEYS) {
    if (x >= alley.minX && x <= alley.maxX && z >= alley.minZ && z <= alley.maxZ) return true;
  }
  return false;
}

export function roofTop(floors) {
  const eave = floors === 1 ? 3.42 : 6.12;
  const lift = floors === 1 ? 1.12 : 1.26;
  return eave + lift + 0.45;
}

export function occlusionBoxes() {
  return BUILDINGS.map((b) => ({
    minX: b.minX - 0.75,
    maxX: b.maxX + 0.75,
    minZ: b.minZ - 0.05,
    maxZ: b.maxZ + 0.05,
    roof: roofTop(b.floors),
  }));
}

const wideAlley = ALLEYS.find((a) => a.wide && a.side === 'left') ?? ALLEYS[0];

export const SHOTS = {
  bridge: {
    position: [0.85, groundHeight(0.85, BRIDGES[0].z) + EYE, BRIDGES[0].z + 0.05],
    target: [0.15, 1.15, BRIDGES[0].z + 13.5],
    fov: 46,
  },
  alley: {
    position: [wideAlley.minX + 0.7, 1.58, wideAlley.midZ],
    target: [-1.6, 1.25, wideAlley.midZ + 0.05],
    fov: 52,
  },
  roof: {
    fov: 40,
  },
  walkStart: {
    x: -7.15,
    z: wideAlley.midZ + 2.4,
    yaw: -Math.PI / 2 + 0.25,
    pitch: -0.05,
  },
  wideAlley,
};

export function validateLayout() {
  const errors = [];
  if (walkable(0, 0)) errors.push('canal is walkable');
  if (!walkable(-7, 0)) errors.push('left street blocked');
  if (!walkable(7, -2)) errors.push('right street blocked');
  const house = BUILDINGS[0];
  const hx = (house.minX + house.maxX) / 2;
  const hz = (house.minZ + house.maxZ) / 2;
  if (walkable(hx, hz)) errors.push('building interior walkable');
  const bridge = BRIDGES[0];
  if (!walkable(0, bridge.z)) errors.push('bridge crown blocked');
  if (walkable(0, bridge.z + bridge.halfWidth + 0.45)) errors.push('water beside bridge is walkable');
  if (!walkable((wideAlley.minX + wideAlley.maxX) / 2, wideAlley.midZ)) errors.push('alley blocked');
  const crown = groundHeight(0, bridge.z);
  if (crown < 1.2) errors.push(`bridge crown too low (${crown.toFixed(2)})`);
  if (groundHeight(-7.2, bridge.z + 6) > 0.001) errors.push('street rises away from the bridge');
  const [ax, , az] = SHOTS.alley.position;
  if (!walkable(ax, az)) errors.push('alley camera is outside the lane');
  return errors;
}
