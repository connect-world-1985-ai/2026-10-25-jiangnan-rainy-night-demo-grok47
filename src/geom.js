import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const euler = new THREE.Euler();
const quat = new THREE.Quaternion();
const pos = new THREE.Vector3();
const scl = new THREE.Vector3(1, 1, 1);
const mat = new THREE.Matrix4();

export function placeBox(bucket, sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) {
  const geo = new THREE.BoxGeometry(sx, sy, sz);
  euler.set(rx, ry, rz);
  quat.setFromEuler(euler);
  pos.set(x, y, z);
  geo.applyMatrix4(mat.compose(pos, quat, scl.set(1, 1, 1)));
  bucket.push(geo);
  return geo;
}

export function stamp(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
  euler.set(rx, ry, rz);
  quat.setFromEuler(euler);
  pos.set(x, y, z);
  geo.applyMatrix4(mat.compose(pos, quat, scl.set(1, 1, 1)));
  return geo;
}

function ensureIndexed(geo) {
  if (geo.index) return geo;
  const count = geo.getAttribute('position').count;
  const index = count > 65535 ? new Uint32Array(count) : new Uint16Array(count);
  for (let i = 0; i < count; i += 1) index[i] = i;
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  return geo;
}

export function mergeList(list) {
  if (!list.length) return null;
  if (list.length === 1) return list[0];
  for (const geo of list) ensureIndexed(geo);
  const merged = mergeGeometries(list, false);
  if (!merged) {
    console.warn('geometry merge failed');
    return list[0];
  }
  for (const geo of list) geo.dispose();
  return merged;
}

/** Tile UVs from world position and face normal so plaster, tile, and stone repeat. */
export function tileUVs(geo, scale) {
  const position = geo.attributes.position;
  const normal = geo.attributes.normal;
  if (!position || !normal) return geo;
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const ax = Math.abs(normal.getX(i));
    const ay = Math.abs(normal.getY(i));
    const az = Math.abs(normal.getZ(i));
    let u;
    let v;
    if (ay >= ax && ay >= az) {
      u = x / scale;
      v = z / scale;
    } else if (ax >= az) {
      u = z / scale;
      v = y / scale;
    } else {
      u = x / scale;
      v = y / scale;
    }
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

export function flipWinding(geo) {
  const index = geo.getIndex();
  if (!index) return geo;
  const arr = index.array;
  for (let i = 0; i < arr.length; i += 3) {
    const tmp = arr[i];
    arr[i] = arr[i + 1];
    arr[i + 1] = tmp;
  }
  index.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export function curvedRoofGeometry(lengthZ, depthX, lift) {
  const segX = 10;
  const segZ = 6;
  const hx = depthX / 2 + 0.74;
  const hz = lengthZ / 2 + 0.06;
  const positions = [];
  const uvs = [];
  const indices = [];
  const row = segX + 1;
  for (let iz = 0; iz <= segZ; iz += 1) {
    const z = (iz / segZ - 0.5) * 2 * hz;
    const zN = Math.abs(z) / hz;
    for (let ix = 0; ix <= segX; ix += 1) {
      const x = (ix / segX - 0.5) * 2 * hx;
      const dist = Math.abs(x) / hx;
      const slope = dist ** 1.16;
      const upturn = dist ** 4.4 * 0.46;
      const corner = zN ** 5.5 * upturn * 1.35;
      const y = lift * (1 - slope) + upturn + corner;
      positions.push(x, y, z);
      uvs.push(ix / segX, iz / segZ);
    }
  }
  for (let iz = 0; iz < segZ; iz += 1) {
    for (let ix = 0; ix < segX; ix += 1) {
      const a = iz * row + ix;
      indices.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  let sum = 0;
  const normal = geo.attributes.normal;
  for (let i = 0; i < normal.count; i += 1) sum += normal.getY(i);
  if (sum < 0) flipWinding(geo);
  return geo;
}

/** Stepped 马头墙 crown above the eave. Local X is the depth of the house. */
export function gableCrown(depth, eaveY, peakY) {
  const half = depth / 2 + 0.04;
  const steps = 3;
  const y0 = eaveY * 0.8;
  const y1 = peakY + 0.36;
  const shape = new THREE.Shape();
  const left = [];
  let x = -half;
  let y = y0;
  const dx = half / steps;
  const treads = [];
  left.push([x, y]);
  for (let i = 0; i < steps; i += 1) {
    const ny = y0 + ((y1 - y0) * (i + 1)) / steps;
    const nx = x + dx;
    treads.push({ x0: x, x1: nx, y });
    left.push([nx, y]);
    left.push([nx, ny]);
    x = nx;
    y = ny;
  }
  const bottom = y0 - 0.9;
  shape.moveTo(-half, bottom);
  for (const p of left) shape.lineTo(p[0], p[1]);
  for (let i = left.length - 2; i >= 0; i -= 1) shape.lineTo(-left[i][0], left[i][1]);
  shape.lineTo(half, bottom);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.28,
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1,
  });
  geo.translate(0, 0, -0.14);
  geo.computeVertexNormals();

  const caps = treads.flatMap((tread) => [tread, { x0: -tread.x1, x1: -tread.x0, y: tread.y }]);
  caps.push({ x0: -dx * 0.42, x1: dx * 0.42, y: y1 });
  return { geo, caps };
}

export function meshFrom(geo, material, { cast = true, receive = true } = {}) {
  if (!geo) return null;
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}
