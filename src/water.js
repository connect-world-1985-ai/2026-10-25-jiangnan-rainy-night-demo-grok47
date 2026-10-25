import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { WATER_Y } from './layout.js';
import { guardReflection } from './reflect.js';

const shader = {
  name: 'CanalWater',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uTime: { value: 0 },
    uDistortion: { value: 0.085 },
    uWaterColor: { value: new THREE.Color('#1a4a52') },
    uFogColor: { value: new THREE.Color('#1a2230') },
    uFogDensity: { value: 0.016 },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    void main() {
      vec4 world = modelMatrix * vec4(position, 1.0);
      vWorld = world.xyz;
      vUv = textureMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uDistortion;
    uniform vec3 uWaterColor;
    uniform vec3 uFogColor;
    uniform float uFogDensity;
    varying vec4 vUv;
    varying vec3 vWorld;

    float wave(vec2 p) {
      float w = sin(p.x * 1.6 + uTime * 1.15);
      w += sin(p.y * 2.2 - uTime * 0.95) * 0.65;
      w += sin((p.x + p.y) * 3.7 + uTime * 1.8) * 0.28;
      return w;
    }

    void main() {
      float h = wave(vWorld.xz);
      float hx = wave(vWorld.xz + vec2(0.18, 0.0));
      float hz = wave(vWorld.xz + vec2(0.0, 0.18));
      vec4 proj = vUv;
      proj.x += (hx - h) * uDistortion * vUv.w;
      proj.y += (hz - h) * uDistortion * vUv.w;
      vec3 refl = texture2DProj(tDiffuse, proj).rgb;
      vec3 viewDir = normalize(cameraPosition - vWorld);
      float fres = pow(1.0 - clamp(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0, 1.0), 2.4);
      vec3 deep = uWaterColor * 0.55;
      vec3 col = mix(deep, refl * color, mix(0.18, 0.92, fres));
      col += vec3(0.35, 0.18, 0.08) * smoothstep(0.65, 1.3, abs(h)) * 0.08;
      float dist = length(cameraPosition - vWorld);
      float fogF = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
      col = mix(col, uFogColor, clamp(fogF, 0.0, 1.0));
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createWater(quality) {
  const resolution = quality === 'low' ? 320 : quality === 'high' ? 896 : 560;
  const geo = new THREE.PlaneGeometry(7.05, 92);
  const water = new Reflector(geo, {
    textureWidth: resolution,
    textureHeight: resolution,
    clipBias: 0.002,
    color: 0xb7c4c2,
    multisample: 0,
    shader,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, WATER_Y, 2);
  water.receiveShadow = false;
  water.castShadow = false;
  guardReflection(water);
  return water;
}

export function updateWater(water, elapsed, fogColor, fogDensity, rainAmount) {
  const uniforms = water.material.uniforms;
  uniforms.uTime.value = elapsed;
  uniforms.uFogColor.value.copy(fogColor);
  uniforms.uFogDensity.value = fogDensity;
  uniforms.uDistortion.value = 0.045 + rainAmount * 0.07;
}
