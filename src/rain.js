import * as THREE from 'three';
import { occlusionBoxes, WATER_Y, groundHeight, BRIDGES, TOWN } from './layout.js';

const MAX_RAIN = 11000;
const MAX_SPLASH = 360;

export function createRain() {
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.attributes.position);
  geo.setAttribute('uv', base.attributes.uv);

  const offsets = new Float32Array(MAX_RAIN * 3);
  const phase = new Float32Array(MAX_RAIN);
  const speed = new Float32Array(MAX_RAIN);
  const len = new Float32Array(MAX_RAIN);
  const seed = new Float32Array(MAX_RAIN);
  for (let i = 0; i < MAX_RAIN; i += 1) {
    offsets[i * 3] = (Math.random() - 0.5) * 48;
    offsets[i * 3 + 1] = Math.random();
    offsets[i * 3 + 2] = (Math.random() - 0.5) * 90;
    phase[i] = Math.random();
    speed[i] = 8 + Math.random() * 7;
    len[i] = 0.45 + Math.random() * 0.75;
    seed[i] = Math.random() * Math.PI * 2;
  }
  geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  geo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speed, 1));
  geo.setAttribute('aLen', new THREE.InstancedBufferAttribute(len, 1));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));

  const boxes = occlusionBoxes();
  const uBox = boxes.slice(0, 24).map((b) => new THREE.Vector4(b.minX, b.minZ, b.maxX, b.maxZ));
  while (uBox.length < 24) uBox.push(new THREE.Vector4());
  const uRoof = new Float32Array(24);
  boxes.slice(0, 24).forEach((b, i) => {
    uRoof[i] = b.roof;
  });

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uHeight: { value: 22 },
      uOpacity: { value: 0.32 },
      uBox: { value: uBox },
      uRoof: { value: uRoof },
      uBoxCount: { value: Math.min(24, boxes.length) },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aOffset;
      attribute float aPhase;
      attribute float aSpeed;
      attribute float aLen;
      attribute float aSeed;
      uniform float uTime;
      uniform float uHeight;
      uniform vec4 uBox[24];
      uniform float uRoof[24];
      uniform int uBoxCount;
      varying vec2 vUv;
      varying float vFade;
      void main() {
        float travel = mod(uTime * aSpeed + aPhase * uHeight, uHeight);
        vec3 root = aOffset;
        float dx = root.x - cameraPosition.x;
        float dz = root.z - cameraPosition.z;
        dx = mod(dx + 22.0, 44.0) - 22.0;
        dz = mod(dz + 40.0, 80.0) - 40.0;
        root.x = cameraPosition.x + dx;
        root.z = cameraPosition.z + dz;
        root.y = uHeight - travel;
        root.x += travel * 0.045;
        vec3 down = normalize(vec3(-0.14, -1.0, -0.04));
        vec3 toCam = normalize(cameraPosition - root);
        vec3 side = normalize(cross(down, toCam));
        vec3 pos = root + side * position.x * 0.016 + down * (position.y - 0.5) * aLen;
        float fade = smoothstep(0.0, 0.06, travel / uHeight) * smoothstep(1.0, 0.86, travel / uHeight);
        for (int i = 0; i < 24; i++) {
          if (i >= uBoxCount) break;
          vec4 b = uBox[i];
          if (pos.x > b.x && pos.x < b.z && pos.z > b.y && pos.z < b.w && pos.y < uRoof[i]) fade = 0.0;
        }
        float dist = length(cameraPosition - pos);
        fade *= smoothstep(36.0, 14.0, dist);
        vFade = fade;
        vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec2 vUv;
      varying float vFade;
      void main() {
        float core = smoothstep(0.5, 0.05, abs(vUv.x - 0.5));
        float tail = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.45, vUv.y);
        float alpha = core * tail * vFade * uOpacity;
        if (alpha < 0.02) discard;
        gl_FragColor = vec4(0.78, 0.84, 0.9, alpha);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  geo.instanceCount = 5000;
  return {
    mesh,
    setAmount(quality, rainAmount) {
      const cap = quality === 'low' ? 2000 : quality === 'high' ? 10000 : 5200;
      geo.instanceCount = Math.max(200, Math.floor(cap * (0.12 + rainAmount * 0.88)));
      material.uniforms.uOpacity.value = 0.12 + rainAmount * 0.28;
    },
    update(elapsed) {
      material.uniforms.uTime.value = elapsed;
    },
  };
}

export function createSplashes() {
  const base = new THREE.PlaneGeometry(1, 1);
  base.rotateX(-Math.PI / 2);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.attributes.position);
  geo.setAttribute('uv', base.attributes.uv);

  const offsets = new Float32Array(MAX_SPLASH * 3);
  const phase = new Float32Array(MAX_SPLASH);
  const speed = new Float32Array(MAX_SPLASH);
  const scale = new Float32Array(MAX_SPLASH);
  function place(i, x, y, z) {
    offsets[i * 3] = x;
    offsets[i * 3 + 1] = y;
    offsets[i * 3 + 2] = z;
  }
  for (let i = 0; i < MAX_SPLASH; i += 1) {
    if (i < 8) {
      place(i, 0, WATER_Y + 0.04, 0);
      phase[i] = i * 0.17;
      speed[i] = 0.55;
      scale[i] = 0.34;
      continue;
    }
    const k = i / MAX_SPLASH;
    let x;
    let y;
    let z;
    if (k < 0.42) {
      x = (Math.random() - 0.5) * 6.4;
      z = -40 + Math.random() * 84;
      y = WATER_Y + 0.035;
    } else if (k < 0.72) {
      const side = Math.random() < 0.5 ? -1 : 1;
      x = side * (TOWN.streetInner + 0.3 + Math.random() * (TOWN.streetOuter - TOWN.streetInner - 0.4));
      z = -34 + Math.random() * 70;
      y = groundHeight(x, z) + 0.045;
    } else {
      const bridge = BRIDGES[i % BRIDGES.length];
      x = (Math.random() - 0.5) * bridge.halfLen * 1.5;
      z = bridge.z + (Math.random() - 0.5) * bridge.halfWidth;
      y = groundHeight(x, z) + 0.05;
    }
    place(i, x, y, z);
    phase[i] = Math.random();
    speed[i] = 0.35 + Math.random() * 0.55;
    scale[i] = 0.18 + Math.random() * 0.28;
  }
  geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  geo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speed, 1));
  geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(scale, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.45 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aOffset;
      attribute float aPhase;
      attribute float aSpeed;
      attribute float aScale;
      uniform float uTime;
      varying vec2 vUv;
      varying float vAge;
      void main() {
        float age = fract(uTime * aSpeed + aPhase);
        vAge = age;
        vec3 pos = aOffset + position * aScale * (0.25 + age * 1.4);
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec2 vUv;
      varying float vAge;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float ring = smoothstep(0.12, 0.0, abs(r - (0.2 + vAge * 0.75)));
        float alpha = ring * (1.0 - vAge) * uOpacity;
        if (alpha < 0.03) discard;
        gl_FragColor = vec4(0.75, 0.82, 0.86, alpha);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  geo.instanceCount = 180;
  return {
    mesh,
    setAmount(quality, rainAmount) {
      const cap = quality === 'low' ? 70 : quality === 'high' ? 280 : 160;
      geo.instanceCount = Math.max(16, Math.floor(cap * (0.2 + rainAmount)));
      material.uniforms.uOpacity.value = 0.2 + rainAmount * 0.4;
    },
    update(elapsed, boats) {
      material.uniforms.uTime.value = elapsed;
      if (!boats || !boats.length) return;
      const attr = geo.getAttribute('aOffset');
      boats.forEach((boat, index) => {
        const i = index * 2;
        if (i + 1 >= 8) return;
        attr.setXYZ(i, boat.x, WATER_Y + 0.04, boat.z - 0.9);
        attr.setXYZ(i + 1, boat.x + 0.25, WATER_Y + 0.04, boat.z + 0.35);
      });
      attr.needsUpdate = true;
    },
  };
}

export function createMist() {
  const geo = new THREE.PlaneGeometry(78, 9);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#243044') },
      uDensity: { value: 0.5 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uDensity;
      varying vec2 vUv;
      void main() {
        float n = sin(vUv.x * 18.0 + uTime * 0.12) * sin(vUv.y * 6.0 - uTime * 0.08);
        n += sin(vUv.x * 7.0 - uTime * 0.05) * 0.6;
        float band = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.45, vUv.y);
        float alpha = smoothstep(0.15, 1.1, n) * 0.09 * uDensity * band;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
  const group = new THREE.Group();
  const heights = [0.35, 1.15, 2.05, 3.1];
  heights.forEach((y, i) => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(0, y, 1);
    mesh.rotation.y = i % 2 ? 0.08 : -0.05;
    group.add(mesh);
  });
  return {
    group,
    setAmount(quality, fogAmount) {
      material.uniforms.uDensity.value = (quality === 'low' ? 0.45 : 0.8) * (0.35 + fogAmount);
      group.children.forEach((child, i) => {
        child.visible = quality === 'low' ? i < 2 : quality === 'medium' ? i < 3 : true;
      });
    },
    setColor(color) {
      material.uniforms.uColor.value.copy(color);
    },
    update(elapsed) {
      material.uniforms.uTime.value = elapsed;
    },
  };
}
