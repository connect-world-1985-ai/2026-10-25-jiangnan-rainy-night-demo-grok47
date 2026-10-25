import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EYE, SHOTS, groundHeight, walkable } from './layout.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia('(pointer: coarse)').matches;

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function rigFrom(position, target, fov) {
  return { position, target, fov };
}

export function createDirector(camera, canvas) {
  const orbit = new OrbitControls(camera, canvas);
  orbit.enabled = false;
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.08;
  orbit.maxPolarAngle = Math.PI * 0.49;
  orbit.minPolarAngle = 0.12;
  orbit.minDistance = 3.5;
  orbit.maxDistance = 40;
  orbit.target.set(0, 1.55, 0);

  const keys = new Set();
  const walk = {
    pos: new THREE.Vector3(-7.15, EYE, -8),
    yaw: -1.32,
    pitch: -0.05,
  };
  const fly = {
    pos: new THREE.Vector3(12, 8, 14),
    yaw: 0.8,
    pitch: -0.35,
  };
  const blend = {
    t: 1,
    dur: reduced ? 0.01 : 1.7,
    fromPos: new THREE.Vector3(),
    fromQuat: new THREE.Quaternion(),
    fromFov: 50,
  };
  const dummy = new THREE.Object3D();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const wish = new THREE.Vector3();
  let mode = 'bridge';
  let locked = false;
  const stick = { x: 0, y: 0, active: false };
  const touches = new Map();
  let lookTouch = null;
  let moveTouch = null;

  const listeners = new Set();
  function emit() {
    for (const fn of listeners) fn(mode, locked);
  }

  function bridgeRig(elapsed) {
    const [x, y, z] = SHOTS.bridge.position;
    const [tx, ty, tz] = SHOTS.bridge.target;
    return rigFrom(
      new THREE.Vector3(x + Math.sin(elapsed * 0.18) * 0.08, y, z),
      new THREE.Vector3(tx, ty, tz),
      SHOTS.bridge.fov,
    );
  }

  function alleyRig(elapsed) {
    const [x, y, z] = SHOTS.alley.position;
    const [tx, ty, tz] = SHOTS.alley.target;
    return rigFrom(
      new THREE.Vector3(x, y + Math.sin(elapsed * 0.3) * 0.02, z),
      new THREE.Vector3(tx, ty + 0.05, tz),
      SHOTS.alley.fov,
    );
  }

  function roofRig(elapsed) {
    const ang = elapsed * 0.055;
    return rigFrom(
      new THREE.Vector3(Math.sin(ang) * 20.5, 11.4 + Math.sin(elapsed * 0.12) * 0.2, Math.cos(ang) * 15.5),
      new THREE.Vector3(0.4, 1.45, -1.5),
      40,
    );
  }

  function boatRig(elapsed) {
    const phase = elapsed * 0.042 + 0.4;
    const z = Math.sin(phase) * 24;
    const ahead = Math.sin(phase + 0.16) * 24;
    const x = -0.9 + Math.sin(elapsed * 0.2) * 0.15;
    return rigFrom(
      new THREE.Vector3(x, -0.12 + Math.sin(elapsed * 0.85) * 0.035, z),
      new THREE.Vector3(0.35, 0.95, ahead),
      55,
    );
  }

  function orbitRig() {
    return rigFrom(new THREE.Vector3(15.5, 8.2, 13.5), new THREE.Vector3(0, 1.5, 0), 48);
  }

  function poseFromEuler(pos, yaw, pitch, fov) {
    const look = new THREE.Vector3(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    );
    return rigFrom(pos.clone(), pos.clone().add(look), fov);
  }

  function getRig(elapsed) {
    if (mode === 'bridge') return bridgeRig(elapsed);
    if (mode === 'boat') return boatRig(elapsed);
    if (mode === 'alley') return alleyRig(elapsed);
    if (mode === 'roof') return roofRig(elapsed);
    if (mode === 'orbit') return orbitRig();
    if (mode === 'walk') return poseFromEuler(walk.pos, walk.yaw, walk.pitch, 68);
    return poseFromEuler(fly.pos, fly.yaw, fly.pitch, 70);
  }

  function applyRig(rig, k) {
    if (k >= 1) {
      camera.position.copy(rig.position);
      dummy.position.copy(rig.position);
      dummy.lookAt(rig.target);
      camera.quaternion.copy(dummy.quaternion);
    } else {
      camera.position.lerpVectors(blend.fromPos, rig.position, k);
      dummy.position.copy(rig.position);
      dummy.lookAt(rig.target);
      camera.quaternion.slerpQuaternions(blend.fromQuat, dummy.quaternion, k);
    }
    camera.fov = blend.fromFov + (rig.fov - blend.fromFov) * Math.min(1, k);
    camera.updateProjectionMatrix();
  }

  function tryMove(pos, dx, dz) {
    const nx = pos.x + dx;
    const nz = pos.z + dz;
    if (walkable(nx, nz)) {
      pos.x = nx;
      pos.z = nz;
      return;
    }
    if (walkable(nx, pos.z)) pos.x = nx;
    else if (walkable(pos.x, nz)) pos.z = nz;
  }

  function readAxes() {
    let mx = stick.x;
    let mz = stick.y;
    if (keys.has('KeyW') || keys.has('ArrowUp')) mz += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) mz -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
    return { mx, mz };
  }

  function basis() {
    forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0;
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
  }

  function updateWalk(dt) {
    camera.rotation.order = 'YXZ';
    camera.rotation.set(walk.pitch, walk.yaw, 0);
    basis();
    const { mx, mz } = readAxes();
    const slow = keys.has('ShiftLeft') || keys.has('ShiftRight');
    wish.set(0, 0, 0).addScaledVector(forward, mz).addScaledVector(right, mx);
    if (wish.lengthSq() > 1) wish.normalize();
    const speed = slow ? 1.2 : 2.55;
    tryMove(walk.pos, wish.x * speed * dt, wish.z * speed * dt);
    walk.pos.y = groundHeight(walk.pos.x, walk.pos.z) + EYE;
    camera.position.copy(walk.pos);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(walk.pitch, walk.yaw, 0);
    camera.fov = 68;
    camera.updateProjectionMatrix();
  }

  function updateFly(dt) {
    camera.rotation.order = 'YXZ';
    camera.rotation.set(fly.pitch, fly.yaw, 0);
    basis();
    const { mx, mz } = readAxes();
    let vertical = 0;
    if (keys.has('KeyE') || keys.has('Space')) vertical += 1;
    if (keys.has('KeyQ') || keys.has('ControlLeft')) vertical -= 1;
    const boost = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const speed = boost ? 12 : 6.5;
    wish.set(0, 0, 0).addScaledVector(forward, mz).addScaledVector(right, mx);
    if (wish.lengthSq() > 1) wish.setLength(1);
    fly.pos.addScaledVector(wish, speed * dt);
    fly.pos.y += vertical * speed * dt;
    fly.pos.x = THREE.MathUtils.clamp(fly.pos.x, -34, 34);
    fly.pos.y = THREE.MathUtils.clamp(fly.pos.y, 0.4, 24);
    fly.pos.z = THREE.MathUtils.clamp(fly.pos.z, -46, 52);
    camera.position.copy(fly.pos);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(fly.pitch, fly.yaw, 0);
    camera.fov = 70;
    camera.updateProjectionMatrix();
  }

  function setMode(next, instant = false) {
    if (!next || (next === mode && blend.t >= 1 && !instant)) return;
    blend.fromPos.copy(camera.position);
    blend.fromQuat.copy(camera.quaternion);
    blend.fromFov = camera.fov;
    blend.t = instant || next === 'fly' || reduced ? 1 : 0;
    mode = next;
    orbit.enabled = false;
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    if (next === 'walk') {
      const start = SHOTS.walkStart;
      walk.pos.set(start.x, groundHeight(start.x, start.z) + EYE, start.z);
      walk.yaw = start.yaw;
      walk.pitch = start.pitch;
    }
    if (next === 'fly') {
      camera.rotation.order = 'YXZ';
      const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
      fly.pitch = euler.x;
      fly.yaw = euler.y;
      fly.pos.copy(camera.position);
      if (fly.pos.y < 0.5) fly.pos.y = 6;
    }
    emit();
  }

  function addLook(dx, dy) {
    const sens = 0.0022;
    if (mode === 'walk') {
      walk.yaw -= dx * sens;
      walk.pitch -= dy * sens;
      walk.pitch = THREE.MathUtils.clamp(walk.pitch, -1.15, 1.15);
    } else if (mode === 'fly') {
      fly.yaw -= dx * sens;
      fly.pitch -= dy * sens;
      fly.pitch = THREE.MathUtils.clamp(fly.pitch, -1.25, 1.25);
    }
  }

  window.addEventListener('keydown', (event) => {
    keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => keys.clear());

  document.addEventListener('mousemove', (event) => {
    if (!locked) return;
    if (mode !== 'walk' && mode !== 'fly') return;
    addLook(event.movementX, event.movementY);
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    emit();
  });

  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  canvas.addEventListener('touchstart', (event) => {
    if (mode !== 'walk' && mode !== 'fly') return;
    for (const touch of event.changedTouches) {
      touches.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
      if (touch.clientX < window.innerWidth * 0.42 && moveTouch === null) moveTouch = touch.identifier;
      else if (lookTouch === null) lookTouch = touch.identifier;
    }
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchmove', (event) => {
    if (mode !== 'walk' && mode !== 'fly') return;
    for (const touch of event.changedTouches) {
      const prev = touches.get(touch.identifier);
      if (!prev) continue;
      if (touch.identifier === lookTouch) addLook(touch.clientX - prev.x, touch.clientY - prev.y);
      if (touch.identifier === moveTouch) {
        stick.x = THREE.MathUtils.clamp((touch.clientX - prev.x) / 48, -1, 1);
        stick.y = THREE.MathUtils.clamp((prev.y - touch.clientY) / 48, -1, 1);
        stick.active = true;
      }
      if (touch.identifier !== moveTouch) {
        touches.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
      }
    }
    event.preventDefault();
  }, { passive: false });

  function endTouch(event) {
    for (const touch of event.changedTouches) {
      if (touch.identifier === lookTouch) lookTouch = null;
      if (touch.identifier === moveTouch) {
        moveTouch = null;
        stick.x = 0;
        stick.y = 0;
        stick.active = false;
      }
      touches.delete(touch.identifier);
    }
  }
  canvas.addEventListener('touchend', endTouch);
  canvas.addEventListener('touchcancel', endTouch);

  function update(dt, elapsed) {
    if (blend.t < 1) {
      blend.t = Math.min(1, blend.t + dt / blend.dur);
      applyRig(getRig(elapsed), smooth(blend.t));
      if (blend.t >= 1 && mode === 'orbit') {
        orbit.target.set(0, 1.55, 0);
        orbit.enabled = true;
        orbit.update();
      }
      return;
    }
    if (mode === 'walk') {
      updateWalk(dt);
      return;
    }
    if (mode === 'fly') {
      updateFly(dt);
      return;
    }
    if (mode === 'orbit') {
      orbit.enabled = true;
      orbit.update();
      return;
    }
    applyRig(getRig(elapsed), 1);
  }

  return {
    setMode,
    update,
    get mode() {
      return mode;
    },
    get locked() {
      return locked;
    },
    get stick() {
      return stick;
    },
    onChange(fn) {
      listeners.add(fn);
    },
    requestLook() {
      if (!coarse && (mode === 'walk' || mode === 'fly')) canvas.requestPointerLock();
    },
  };
}

export const pointerCoarse = coarse;
