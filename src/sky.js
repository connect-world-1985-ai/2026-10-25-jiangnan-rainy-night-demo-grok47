import * as THREE from 'three';
import { MOON_DIR } from './look.js';

export function createSky() {
  const geo = new THREE.SphereGeometry(210, 32, 20);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uHorizon: { value: new THREE.Color('#1a2230') },
      uZenith: { value: new THREE.Color('#0b1018') },
      uMoon: { value: MOON_DIR.clone() },
      uStar: { value: 0.4 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vDir = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uHorizon;
      uniform vec3 uZenith;
      uniform vec3 uMoon;
      uniform float uStar;
      uniform float uTime;
      varying vec3 vDir;
      float hash(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
      }
      void main() {
        vec3 dir = normalize(vDir);
        float h = clamp(dir.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.72, h));
        float cloud = sin(dir.x * 6.0 + uTime * 0.02) * sin(dir.z * 5.0 - dir.y * 3.0);
        col += vec3(0.04, 0.045, 0.06) * smoothstep(0.2, 0.9, cloud) * (1.0 - h);
        float moon = smoothstep(0.9982, 0.9996, dot(dir, normalize(uMoon)));
        float halo = smoothstep(0.985, 0.999, dot(dir, normalize(uMoon)));
        col += vec3(1.0, 0.96, 0.88) * moon * 1.6;
        col += vec3(0.55, 0.62, 0.75) * halo * 0.28;
        float star = step(0.9975, hash(floor(dir * 220.0)));
        star *= smoothstep(0.25, 0.7, dir.y) * uStar;
        col += star * 0.85;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return {
    mesh,
    apply(mood, elapsed) {
      material.uniforms.uHorizon.value.copy(mood.horizon);
      material.uniforms.uZenith.value.copy(mood.zenith);
      material.uniforms.uStar.value = mood.stars;
      material.uniforms.uTime.value = elapsed;
    },
  };
}

export function createMountains() {
  const group = new THREE.Group();
  const layers = [
    { radius: 78, amp: 6.5, base: 2.2, color: '#2c3c52' },
    { radius: 112, amp: 9, base: 3.4, color: '#3a4e68' },
    { radius: 156, amp: 12, base: 4.6, color: '#4d6480' },
  ];
  for (const layer of layers) {
    const seg = 90;
    const positions = [];
    const indices = [];
    for (let i = 0; i <= seg; i += 1) {
      const a = (i / seg) * Math.PI * 2;
      const n = Math.sin(a * 3) * 0.55 + Math.sin(a * 7.3 + 1.4) * 0.28 + Math.sin(a * 13) * 0.12;
      const y = layer.base + n * layer.amp;
      const x = Math.cos(a) * layer.radius;
      const z = Math.sin(a) * layer.radius;
      positions.push(x, -4, z, x, y, z);
    }
    for (let i = 0; i < seg; i += 1) {
      const b = i * 2;
      indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ color: layer.color, side: THREE.DoubleSide, fog: true });
    group.add(new THREE.Mesh(geo, mat));
  }
  return group;
}

export function createLights() {
  const ambient = new THREE.AmbientLight(0x8e9bb4, 0.2);
  const hemi = new THREE.HemisphereLight(0x9eb0c8, 0x1a140f, 0.42);
  const moon = new THREE.DirectionalLight(0xc9d6ea, 2.35);
  moon.position.copy(MOON_DIR).multiplyScalar(48);
  moon.target.position.set(0, 0, 0);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.near = 8;
  moon.shadow.camera.far = 90;
  moon.shadow.camera.left = -42;
  moon.shadow.camera.right = 42;
  moon.shadow.camera.top = 42;
  moon.shadow.camera.bottom = -42;
  moon.shadow.bias = -0.00025;
  moon.shadow.normalBias = 0.035;
  return { ambient, hemi, moon, target: moon.target };
}

export function applyLights(lights, mood, quality) {
  lights.ambient.intensity = mood.ambient;
  lights.hemi.intensity = mood.hemi;
  lights.moon.intensity = mood.moon;
  lights.moon.castShadow = quality !== 'low';
  const size = quality === 'high' ? 2048 : 1024;
  if (lights.moon.shadow.mapSize.x !== size) {
    lights.moon.shadow.mapSize.set(size, size);
    if (lights.moon.shadow.map) {
      lights.moon.shadow.map.dispose();
      lights.moon.shadow.map = null;
    }
  }
}
