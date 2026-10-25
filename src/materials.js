import * as THREE from 'three';
import { LOOK } from './look.js';

function standard(params) {
  return new THREE.MeshStandardMaterial({
    roughness: 0.8,
    metalness: 0,
    ...params,
  });
}

export function createMaterials(textures) {
  const wood = standard({ map: textures.wood, roughness: 0.74, color: 0xffffff });
  const soffit = wood.clone();
  soffit.color = new THREE.Color(0x6a5344);

  const lantern = standard({
    color: 0xffe0c2,
    emissive: 0xff5724,
    emissiveIntensity: LOOK.lanternEmissive,
    roughness: 0.42,
  });

  const glow = standard({
    color: 0xffd0b0,
    emissive: 0xff6a30,
    emissiveIntensity: LOOK.windowEmissive,
    roughness: 1,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  return {
    wall: standard({ map: textures.plaster, roughness: 0.91, color: 0xffffff }),
    roof: standard({ map: textures.roof, roughness: 0.56, metalness: 0.08, color: 0xffffff }),
    soffit,
    wood,
    stone: standard({ map: textures.stone, roughness: 0.9, color: 0xb7b1a6 }),
    street: new THREE.MeshPhysicalMaterial({
      map: textures.flag.map,
      roughnessMap: textures.flag.rough,
      roughness: 0.48,
      metalness: 0.03,
      clearcoat: 0.42,
      clearcoatRoughness: 0.22,
      color: 0xffffff,
    }),
    earth: standard({ color: 0x1a1816, roughness: 1 }),
    glow,
    lattice: standard({
      map: textures.lattice,
      transparent: true,
      alphaTest: 0.4,
      roughness: 0.72,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
    door: standard({ map: textures.door, roughness: 0.68, color: 0xffffff }),
    doorRed: standard({ map: textures.door, roughness: 0.62, color: 0x8a3a32 }),
    lantern,
    cap: standard({ map: textures.wood, roughness: 0.6, color: 0x2a211c }),
    tassel: standard({ color: 0x7a1e1a, roughness: 0.5, emissive: 0x3a0808, emissiveIntensity: 0.4 }),
    canopy: standard({ color: 0x141614, roughness: 0.86, side: THREE.DoubleSide }),
    hull: standard({ map: textures.wood, roughness: 0.62, color: 0xc9a27a, side: THREE.DoubleSide }),
    plant: standard({ color: 0x1c3328, roughness: 0.9 }),
    willow: null,
    robeIndigo: standard({ color: 0x1c2838, roughness: 0.82 }),
    robeBrown: standard({ color: 0x4a3024, roughness: 0.84 }),
    robeGreen: standard({ color: 0x24352c, roughness: 0.84 }),
    skin: standard({ color: 0xd7b394, roughness: 0.7 }),
    hair: standard({ color: 0x140e0c, roughness: 0.8 }),
    umbrellaRed: standard({ map: textures.umbrellaRed, roughness: 0.55, side: THREE.DoubleSide }),
    umbrellaOil: standard({ map: textures.umbrellaOil, roughness: 0.5, side: THREE.DoubleSide }),
    bannerRed: standard({ color: 0x6e1c1c, roughness: 0.7, side: THREE.DoubleSide }),
    bannerDark: standard({ color: 0x1a242c, roughness: 0.75, side: THREE.DoubleSide }),
  };
}

export function tuneSceneMaterials(root, quality) {
  root.traverse((obj) => {
    const list = obj.material ? [].concat(obj.material) : [];
    for (const material of list) material.needsUpdate = true;
  });
  const anisotropy = quality === 'low' ? 1 : quality === 'medium' ? 4 : 8;
  root.traverse((obj) => {
    const list = obj.material ? [].concat(obj.material) : [];
    for (const material of list) {
      for (const key of ['map', 'roughnessMap']) {
        if (material[key]) material[key].anisotropy = anisotropy;
      }
    }
  });
}
