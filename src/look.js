import * as THREE from 'three';

/** Artistic night lighting. Tuned for ACES and a readable 粉墙, not for photometric moonlight. */
export const LOOK = {
  exposure: 1.28,
  moon: 8.4,
  ambient: 1.15,
  hemi: 1.55,
  lantern: 70,
  lanternDistance: 11,
  windowEmissive: 4.2,
  lanternEmissive: 6.4,
  bloomStrength: 0.46,
  bloomThreshold: 0.62,
  bloomRadius: 0.48,
  fog: 0.012,
};

export const MOON_DIR = new THREE.Vector3(-0.48, 0.8, 0.32).normalize();

const duskH = new THREE.Color('#5a4e72');
const nightH = new THREE.Color('#3a4a62');
const deepH = new THREE.Color('#243246');
const duskZ = new THREE.Color('#2a2244');
const nightZ = new THREE.Color('#1a2436');
const deepZ = new THREE.Color('#101820');
const horizon = new THREE.Color();
const zenith = new THREE.Color();

function mix3(out, a, b, c, t) {
  if (t < 0.5) out.copy(a).lerp(b, t * 2);
  else out.copy(b).lerp(c, (t - 0.5) * 2);
  return out;
}

/** t = 0 dusk, 0.5 rainy night, 1 deep night. fogAmount 0..1 scales mist. */
export function sampleMood(t, fogAmount) {
  mix3(horizon, duskH, nightH, deepH, t);
  mix3(zenith, duskZ, nightZ, deepZ, t);
  const fogDensity = (0.007 + fogAmount * 0.026) * (0.75 + t * 0.45);
  return {
    horizon,
    zenith,
    fogDensity,
    moon: LOOK.moon * (t < 0.5 ? 0.72 + t * 0.56 : 1 - (t - 0.5) * 0.18),
    ambient: LOOK.ambient * (1.35 - t * 0.85),
    hemi: LOOK.hemi * (1.25 - t * 0.55),
    lantern: 0.72 + t * 0.55,
    exposure: LOOK.exposure * (1.06 - t * 0.1),
    mist: 0.35 + fogAmount * 0.9,
    stars: Math.max(0, t - 0.25),
  };
}
