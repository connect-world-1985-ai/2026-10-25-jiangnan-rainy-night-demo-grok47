import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { LOOK } from './look.js';

const GradeShader = {
  name: 'InkGrade',
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.22 },
    uInk: { value: 0.18 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uInk;
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      vec3 ink = vec3(l * 0.86, l * 0.9, l * 0.98);
      c = mix(c, ink, uInk);
      float grain = fract(sin(dot(vUv * vec2(960.0, 540.0) + uTime, vec2(12.9898, 78.233))) * 43758.5453);
      c += (grain - 0.5) * 0.012;
      float vig = smoothstep(0.92, 0.28, length(vUv - 0.5));
      c *= mix(1.0 - uVignette, 1.0, vig);
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

export function createComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    LOOK.bloomStrength,
    LOOK.bloomRadius,
    LOOK.bloomThreshold,
  );
  const grade = new ShaderPass(GradeShader);
  const output = new OutputPass();
  const fxaa = new FXAAPass();
  composer.addPass(renderPass);
  composer.addPass(bloom);
  composer.addPass(grade);
  composer.addPass(output);
  composer.addPass(fxaa);
  return { composer, bloom, grade, fxaa, renderPass };
}

export function applyPost(passes, quality, fogAmount, elapsed) {
  passes.bloom.enabled = quality !== 'low';
  passes.bloom.strength = quality === 'high' ? LOOK.bloomStrength + 0.08 : LOOK.bloomStrength;
  passes.bloom.threshold = LOOK.bloomThreshold;
  passes.bloom.radius = LOOK.bloomRadius;
  passes.fxaa.enabled = quality !== 'low';
  passes.grade.uniforms.uInk.value = 0.08 + fogAmount * 0.16;
  passes.grade.uniforms.uTime.value = elapsed;
}
