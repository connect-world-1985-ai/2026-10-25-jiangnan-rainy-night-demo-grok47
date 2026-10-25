import * as THREE from 'three';
import './style.css';
import { createTextures } from './textures.js';
import { createMaterials, tuneSceneMaterials } from './materials.js';
import { createTown } from './town.js';
import { createWater, updateWater } from './water.js';
import { createRain, createSplashes, createMist } from './rain.js';
import { createSky, createMountains, createLights, applyLights } from './sky.js';
import { createComposer, applyPost } from './post.js';
import { createAmbience } from './audio.js';
import { createDirector, pointerCoarse } from './controls.js';
import { createUI } from './ui.js';
import { sampleMood, LOOK } from './look.js';
import { hideInReflection } from './reflect.js';

const params = new URLSearchParams(location.search);
const veil = document.getElementById('veil');
const veilNote = document.getElementById('veil-note');
const canvas = document.getElementById('scene');

const state = {
  quality: detectQuality(),
  rain: Number(params.get('rain') ?? 0.72),
  fog: Number(params.get('fog') ?? 0.42),
  night: Number(params.get('night') ?? 0.62),
  dropsLeft: 1,
};

function detectQuality() {
  const forced = params.get('quality');
  if (forced === 'low' || forced === 'medium' || forced === 'high') return forced;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  if (coarse || (cores <= 4 && memory <= 4)) return 'low';
  if (cores >= 8 && memory >= 8 && !coarse) return 'high';
  return 'medium';
}

function pixelRatio(quality) {
  const dpr = window.devicePixelRatio || 1;
  if (quality === 'low') return Math.min(1, dpr);
  if (quality === 'medium') return Math.min(1.35, dpr);
  return Math.min(1.75, dpr);
}

function showError(message) {
  veilNote.textContent = message;
  veil.classList.remove('hide');
}

async function loadFonts() {
  try {
    await document.fonts.load('64px "Jiangnan Calligraphy"');
    await document.fonts.load('32px "Jiangnan Song"');
    await document.fonts.ready;
  } catch {
    /* system fonts still draw the labels */
  }
}

function boot() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: params.has('capture'),
      failIfMajorPerformanceCaveat: false,
    });
  } catch {
    showError('无法开启画境，请换用支持 WebGL 的浏览器');
    return;
  }
  if (!renderer.capabilities.isWebGL2) {
    showError('无法开启画境，请换用支持 WebGL 的浏览器');
    renderer.dispose();
    return;
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = LOOK.exposure;
  renderer.shadowMap.enabled = state.quality !== 'low';
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.info.autoReset = false;
  renderer.setClearColor(0x10141c, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x1a2230, 0.016);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.08, 280);
  camera.position.set(0, 2, 10);

  const textures = createTextures();
  const materials = createMaterials(textures);
  const town = createTown(materials, textures);
  scene.add(town.root);

  const sky = createSky();
  scene.add(sky.mesh);
  scene.add(createMountains());
  const lights = createLights();
  scene.add(lights.ambient, lights.hemi, lights.moon, lights.target);

  let water = createWater(state.quality);
  scene.add(water);

  const rain = createRain();
  const splashes = createSplashes();
  const mist = createMist();
  scene.add(rain.mesh, splashes.mesh, mist.group);
  hideInReflection.push(rain.mesh, splashes.mesh, mist.group);

  const passes = createComposer(renderer, scene, camera);
  const director = createDirector(camera, canvas);
  let elapsed = Number(params.get('t') || 0);
  const audio = createAmbience();
  const uiRoot = document.getElementById('ui');
  const ui = createUI(uiRoot, {
    onMode: (mode) => director.setMode(mode),
    onQuality: (quality) => {
      state.dropsLeft = 1;
      applyQuality(quality);
    },
    onRain: (value) => {
      state.rain = value;
      syncMood();
    },
    onFog: (value) => {
      state.fog = value;
      syncMood();
    },
    onNight: (value) => {
      state.night = value;
      syncMood();
    },
    onSound: async () => {
      if (!audio.started) await audio.start();
      else audio.toggle();
      ui.setSound(audio.started, audio.muted);
    },
  });

  if (params.has('clean')) ui.setClean(true);

  function lightBudget() {
    if (state.quality === 'low') return 4;
    if (state.quality === 'high') return 12;
    return 8;
  }

  function syncMood() {
    const mood = sampleMood(state.night, state.fog);
    renderer.toneMappingExposure = mood.exposure;
    scene.fog.color.copy(mood.horizon);
    scene.fog.density = mood.fogDensity;
    sky.apply(mood, elapsed);
    applyLights(lights, mood, state.quality);
    mist.setColor(mood.horizon);
    mist.setAmount(state.quality, state.fog);
    rain.setAmount(state.quality, state.rain);
    splashes.setAmount(state.quality, state.rain);
    audio.setRain(state.rain);
    updateWater(water, elapsed, mood.horizon, mood.fogDensity, state.rain);
    return mood;
  }

  function applyQuality(quality) {
    state.quality = quality;
    const pr = pixelRatio(quality);
    renderer.setPixelRatio(pr);
    renderer.shadowMap.enabled = quality !== 'low';
    passes.composer.setPixelRatio(pr);
    resize();
    const next = createWater(quality);
    scene.remove(water);
    water.geometry.dispose();
    water.dispose();
    water = next;
    scene.add(water);
    tuneSceneMaterials(scene, quality);
    town.setLightCount(lightBudget());
    syncMood();
    ui.setQuality(quality);
  }

  function resize() {
    const width = window.innerWidth;
    const height = Math.max(1, window.innerHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    passes.composer.setSize(width, height);
  }

  window.addEventListener('resize', resize);
  resize();
  applyQuality(state.quality);

  const shot = params.get('shot');
  const initial = ['bridge', 'boat', 'alley', 'roof', 'walk', 'orbit', 'fly'].includes(shot) ? shot : 'bridge';
  director.setMode(initial, true);
  ui.setMode(initial, false, pointerCoarse);
  ui.setQuality(state.quality);
  ui.setSound(false, false);
  director.onChange((mode, locked) => ui.setMode(mode, locked, pointerCoarse));

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const map = {
      Digit1: 'bridge',
      Digit2: 'boat',
      Digit3: 'alley',
      Digit4: 'roof',
      Digit5: 'walk',
      Digit6: 'orbit',
      Digit7: 'fly',
    };
    if (map[event.code]) director.setMode(map[event.code]);
    if (event.code === 'KeyM') {
      if (!audio.started) audio.start().then(() => ui.setSound(audio.started, audio.muted));
      else {
        audio.toggle();
        ui.setSound(true, audio.muted);
      }
    }
    if (event.code === 'KeyH') ui.toggleHelp();
  });

  canvas.addEventListener('pointerdown', () => {
    if (!audio.started) {
      audio.start().then(() => ui.setSound(audio.started, audio.muted));
    }
    director.requestLook();
  });

  let last = performance.now();
  const fpsWindow = [];
  let fpsStamp = performance.now();
  let frames = 0;
  let lowSeconds = 0;
  const bench = params.has('bench')
    ? { started: performance.now(), frames: 0, min: 999, samples: [] }
    : null;

  syncMood();
  town.update(elapsed, 0.016, sampleMood(state.night, state.fog));
  renderer.compile(scene, camera);
  passes.composer.render();

  if (params.has('capture') || params.has('bench')) {
    window.__VIEW__ = () => ({
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      mode: director.mode,
      fov: camera.fov,
    });
  }

  requestAnimationFrame(() => veil.classList.add('hide'));

  function frame(now) {
    requestAnimationFrame(frame);
    const rawDt = (now - last) / 1000;
    const dt = Math.min(0.05, rawDt);
    last = now;
    elapsed += dt;
    renderer.info.reset();
    const mood = syncMood();
    const motion = town.update(elapsed, dt, mood);
    rain.update(elapsed);
    splashes.update(elapsed, motion.tracks);
    mist.update(elapsed);
    updateWater(water, elapsed, mood.horizon, mood.fogDensity, state.rain);
    sky.apply(mood, elapsed);
    applyPost(passes, state.quality, state.fog, elapsed);
    director.update(dt, elapsed);
    ui.setStick(director.stick.x, director.stick.y, director.stick.active);
    passes.composer.render(dt);

    frames += 1;
    if (now - fpsStamp > 500) {
      const fps = Math.round((frames * 1000) / (now - fpsStamp));
      fpsWindow.push(fps);
      if (fpsWindow.length > 8) fpsWindow.shift();
      ui.setFps(fps);
      frames = 0;
      fpsStamp = now;
      if (now > 4000 && fps > 0 && fps < 30) lowSeconds += 0.5;
      else lowSeconds = 0;
      if (lowSeconds >= 4 && state.dropsLeft > 0 && state.quality !== 'low') {
        state.dropsLeft -= 1;
        applyQuality(state.quality === 'high' ? 'medium' : 'low');
        ui.note('帧缓，已改用淡墨');
        lowSeconds = 0;
      }
    }

    if (bench) {
      bench.frames += 1;
      const instant = rawDt > 0.0001 ? 1 / rawDt : 0;
      if (now - bench.started > 2500 && instant >= 1) {
        bench.samples.push(instant);
        bench.min = Math.min(bench.min, instant);
      }
      if (now - bench.started > 8000 && !bench.done) {
        bench.done = true;
        const avg = bench.samples.reduce((a, b) => a + b, 0) / Math.max(1, bench.samples.length);
        const info = renderer.info.render;
        const result = {
          fps: Math.round(avg),
          min: Math.round(bench.min === 999 ? 0 : bench.min),
          calls: info.calls,
          triangles: info.triangles,
          quality: state.quality,
          dpr: renderer.getPixelRatio(),
          mode: director.mode,
        };
        window.__BENCH__ = result;
        ui.bench(JSON.stringify(result));
        console.info('BENCH', result);
      }
    }
  }

  requestAnimationFrame(frame);
}

loadFonts().then(boot).catch((error) => {
  console.error(error);
  showError('无法开启画境，请换用支持 WebGL 的浏览器');
});
