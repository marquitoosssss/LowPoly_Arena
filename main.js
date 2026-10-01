import * as THREE from 'three';
import { io } from '/socket.io/socket.io.esm.min.js';
import { WEAPONS, BASE_FOV, MAX_HP } from '../../shared/weapons.js';
import { stepPlayer } from './physics.js';
import { buildWorld } from './world.js';
import { buildViewmodels } from './weapons.js';
import { makeAvatar } from './avatar.js';

const $ = (id) => document.getElementById(id);
const screens = ['menu', 'wait', 'pause', 'end'];
const show = (n) => screens.forEach((s) => ($('s-' + s).hidden = s !== n));
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------- Escena ----------------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(BASE_FOV, innerWidth / innerHeight, 0.05, 300);
camera.rotation.order = 'YXZ';
scene.add(camera);
const world = buildWorld(scene);
const vm = buildViewmodels(camera);
const enemy = makeAvatar();
enemy.visible = false;
scene.add(enemy);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// ---------------- Estado ----------------
const p = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, grounded: true, crouch: false, sliding: false, slideT: 0, sdx: 0, sdz: 0, sprinting: false };
const G = { phase: 'menu', hp: MAX_HP, me: 0, op: 0 };
const ammo = {};
let cur = 'pistol', reloadT = 0, cdT = 0, triggerReady = true;
let adsAmt = 0, punch = 0, kick = 0, eye = 1.62, sprintBlend = 0, fovBase = BASE_FOV, bobT = 0, roll = 0;
let locked = false, crouchEdge = false, mouseL = false, mouseR = false, netT = 0;
const keys = new Set();
const enemyT = { x: 0, y: 0, z: 0, yaw: 0, crouch: false, seen: false };
const fx = [];
const ray = new THREE.Raycaster();
const resetAmmo = () => Object.keys(WEAPONS).forEach((k) => (ammo[k] = WEAPONS[k].mag));
resetAmmo();

// ---------------- Red ----------------
const socket = io({ autoConnect: false });
const setScores = (s) => {
  G.me = s[socket.id] ?? 0;
  G.op = Object.entries(s).find(([k]) => k !== socket.id)?.[1] ?? 0;
  $('sMe').textContent = G.me; $('sOp').textContent = G.op;
};
let bannerTimer;
function banner(title, sub = '', ms = 1800) {
  const b = $('banner');
  b.querySelector('h1').textContent = title; b.querySelector('p').textContent = sub;
  b.classList.add('on');
  clearTimeout(bannerTimer);
  if (ms) bannerTimer = setTimeout(() => b.classList.remove('on'), ms);
}
const flash = (el, head = false) => { el.classList.toggle('head', head); el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); };

socket.on('waiting', () => { G.phase = 'waiting'; show('wait'); });
socket.on('matchStart', () => { $('hud').hidden = false; });
socket.on('roundStart', (d) => {
  G.phase = 'countdown'; G.hp = MAX_HP;
  show(locked ? 'none' : 'pause');
  Object.assign(p, { x: d.spawn.x, z: d.spawn.z, y: 0, vx: 0, vy: 0, vz: 0, yaw: d.spawn.yaw, pitch: 0, grounded: true, crouch: false, sliding: false });
  resetAmmo(); reloadT = 0; enemyT.seen = false; enemy.visible = false;
  $('round').textContent = `Ronda ${d.round} de ${d.total}`;
  setScores(d.scores);
  let n = d.countdown;
  const tick = () => { if (G.phase !== 'countdown') return; banner(`Ronda ${d.round}`, `Empieza en ${n}`, 0); if (n-- > 0) setTimeout(tick, 1000); };
  tick();
});
socket.on('roundLive', () => { G.phase = 'live'; banner('¡Fuego!', '', 700); });
socket.on('hp', ({ id, hp }) => { if (id === socket.id) { G.hp = hp; flash($('hurt')); } });
socket.on('roundEnd', ({ winner, scores }) => {
  G.phase = 'between'; setScores(scores); mouseL = false; mouseR = false;
  banner(winner === socket.id ? 'Ronda ganada' : 'Ronda perdida', `${G.me} – ${G.op}`, 3000);
});
socket.on('matchEnd', ({ winner, scores }) => {
  G.phase = 'over'; setScores(scores); document.exitPointerLock?.();
  $('endTitle').textContent = winner === socket.id ? 'Victoria' : 'Derrota';
  $('endSub').textContent = `Resultado final: ${G.me} – ${G.op}`;
  $('hud').hidden = true; show('end');
});
socket.on('opponentLeft', () => {
  G.phase = 'over'; document.exitPointerLock?.();
  $('endTitle').textContent = 'Rival desconectado'; $('endSub').textContent = 'La partida se ha cancelado.';
  $('hud').hidden = true; show('end');
});
socket.on('enemyState', (s) => { Object.assign(enemyT, s, { seen: true }); if (!enemy.visible) { enemy.position.set(s.x, s.y, s.z); enemy.visible = true; } });
socket.on('enemyShot', ({ o, e }) => tracer(new THREE.Vector3(...o), new THREE.Vector3(...e), 0xff5d73));

// ---------------- Input ----------------
$('play').onclick = () => { canvas.requestPointerLock(); socket.connect(); show('wait'); };
$('again').onclick = () => location.reload();
$('s-pause').onclick = () => canvas.requestPointerLock();
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (!locked && ['countdown', 'live', 'between'].includes(G.phase)) show('pause');
  else if (locked && !['waiting', 'menu'].includes(G.phase)) show('none');
});
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'KeyC' || e.code === 'ControlLeft') crouchEdge = true;
  if (e.code === 'Digit1') switchW('pistol');
  if (e.code === 'Digit2') switchW('sniper');
  if (e.code === 'Digit3') switchW('rifle');
  if (e.code === 'KeyR') startReload();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('mousedown', (e) => { if (!locked) return; if (e.button === 0) { mouseL = true; triggerReady = true; } if (e.button === 2) mouseR = true; });
addEventListener('mouseup', (e) => { if (e.button === 0) mouseL = false; if (e.button === 2) mouseR = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('mousemove', (e) => {
  if (!locked || G.phase === 'between') return;
  const sens = 0.0022 * (camera.fov / BASE_FOV);   // menos sensibilidad con zoom
  p.yaw -= e.movementX * sens;
  p.pitch = Math.max(-1.5, Math.min(1.5, p.pitch - e.movementY * sens));
});

function switchW(k) { if (k === cur || G.phase === 'between') return; cur = k; reloadT = 0; cdT = 0.3; }
function startReload() {
  const w = WEAPONS[cur];
  if (reloadT > 0 || ammo[cur] === w.mag || G.phase !== 'live') return;
  reloadT = w.reload;
}

// ---------------- Disparo / ADS ----------------
function spread() {
  const w = WEAPONS[cur];
  const speed = Math.hypot(p.vx, p.vz);
  let s = lerp(w.hip, w.ads, adsAmt) * (1 + Math.min(1, speed / 10) * 0.6 + (p.grounded ? 0 : 0.8));
  if (p.crouch && !p.sliding) s *= 0.7;
  return s;
}

function tracer(a, b, color) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, len), new THREE.MeshBasicMaterial({ color, transparent: true }));
  m.position.copy(a).lerp(b, 0.5); m.lookAt(b);
  scene.add(m); fx.push({ m, t: 0.07, max: 0.07 });
}
function spark(pt) {
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true }));
  m.position.copy(pt); scene.add(m); fx.push({ m, t: 0.15, max: 0.15 });
}

function shoot() {
  const w = WEAPONS[cur];
  ammo[cur]--; cdT = w.cd;
  const sp = spread();
  const o = camera.getWorldPosition(new THREE.Vector3());
  const d = new THREE.Vector3((Math.random() * 2 - 1) * sp, (Math.random() * 2 - 1) * sp, -1).applyQuaternion(camera.quaternion).normalize();
  ray.set(o, d); ray.far = 300;

  const wh = ray.intersectObjects(world.collidables, false)[0];
  let end = wh ? wh.point.clone() : o.clone().addScaledVector(d, 120), hit = false, head = false;
  if (enemy.visible) {
    enemy.updateMatrixWorld(true);
    const eh = ray.intersectObjects([enemy.userData.hitHead, enemy.userData.hitBody], false)[0];
    if (eh && (!wh || eh.distance < wh.distance)) { hit = true; head = eh.object === enemy.userData.hitHead; end = eh.point.clone(); }
  }
  const muzzle = new THREE.Vector3(0.2, -0.14, -0.7).applyMatrix4(camera.matrixWorld);
  tracer(muzzle, end, 0xffe9b0);
  if (wh && !hit) spark(end);
  socket.emit('shot', { weapon: cur, hit, head, o: muzzle.toArray(), e: end.toArray() });
  if (hit) flash($('hit'), head);

  punch += w.recoil * (1 - adsAmt * 0.4);
  p.pitch = Math.min(1.5, p.pitch + w.recoil * 0.25);
  kick = cur === 'sniper' ? 0.12 : 0.05;
  if (!w.auto) triggerReady = false;
}

// ---------------- Bucle ----------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (G.phase !== 'menu' && G.phase !== 'waiting') update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function update(dt) {
  const w = WEAPONS[cur];
  const active = locked && G.phase === 'live';
  const k = (c) => (active && keys.has(c) ? 1 : 0);

  // 1) Movimiento
  const adsWanted = active && mouseR && reloadT <= 0;
  const inp = {
    fwd: k('KeyW'), back: k('KeyS'), left: k('KeyA'), right: k('KeyD'),
    sprint: k('ShiftLeft') === 1, jump: k('Space') === 1,
    crouch: k('KeyC') === 1 || k('ControlLeft') === 1, crouchPressed: active && crouchEdge, ads: adsWanted,
  };
  crouchEdge = false;
  const adsMul = adsWanted ? w.adsMove : 1;
  for (let rem = dt; rem > 0;) { const s = Math.min(rem, 1 / 90); stepPlayer(p, inp, s, adsMul); inp.crouchPressed = false; rem -= s; }

  // 2) Cámara: altura de ojos, FOV (sprint/ADS) y alabeo al deslizarse
  const k8 = 1 - Math.exp(-dt * 12);
  eye = lerp(eye, p.sliding ? 0.7 : p.crouch ? 0.9 : 1.62, k8);
  adsAmt = lerp(adsAmt, adsWanted ? 1 : 0, 1 - Math.exp(-dt * (cur === 'sniper' ? 9 : 14)));
  fovBase = lerp(fovBase, p.sprinting || p.sliding ? BASE_FOV + 7 : BASE_FOV, k8);
  camera.fov = lerp(fovBase, w.fov, adsAmt);          // <- zoom de ADS por arma
  camera.updateProjectionMatrix();
  punch *= Math.exp(-dt * 10);
  roll = lerp(roll, p.sliding ? 0.07 : 0, k8);
  const speed = Math.hypot(p.vx, p.vz);
  bobT += dt * speed * 1.4;
  camera.position.set(p.x, p.y + eye + (p.grounded && !p.sliding ? Math.sin(bobT) * 0.012 * (speed / 6) : 0), p.z);
  camera.rotation.set(p.pitch + punch, p.yaw, roll);
  camera.updateMatrixWorld(true);

  // 3) Armas
  cdT -= dt;
  if (reloadT > 0) { reloadT -= dt; if (reloadT <= 0) ammo[cur] = w.mag; }
  if (active && mouseL && cdT <= 0 && reloadT <= 0 && (w.auto || triggerReady)) {
    if (ammo[cur] <= 0) startReload(); else shoot();
  }

  // 4) Viewmodel
  sprintBlend = lerp(sprintBlend, p.sprinting ? 1 : 0, k8);
  kick *= Math.exp(-dt * 14);
  const scoped = cur === 'sniper' && adsAmt > 0.85;
  for (const key in vm) {
    const m = vm[key], g = m.group;
    g.visible = key === cur && !scoped;
    if (key !== cur) continue;
    g.position.lerpVectors(m.hip, m.ads, adsAmt);
    g.position.z += kick;
    g.position.y += (reloadT > 0 ? -0.12 : 0) - Math.abs(Math.sin(bobT)) * 0.008 * (1 - adsAmt);
    g.rotation.set(-0.15 * sprintBlend + (reloadT > 0 ? 0.5 : 0), 0.45 * sprintBlend, 0);
  }

  // 5) Rival y efectos
  const ke = 1 - Math.exp(-dt * 18);
  if (enemy.visible) {
    enemy.position.x = lerp(enemy.position.x, enemyT.x, ke);
    enemy.position.y = lerp(enemy.position.y, enemyT.y, ke);
    enemy.position.z = lerp(enemy.position.z, enemyT.z, ke);
    enemy.rotation.y = enemyT.yaw;
    enemy.scale.y = lerp(enemy.scale.y, enemyT.crouch ? 0.65 : 1, ke);
  }
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.t -= dt; f.m.material.opacity = Math.max(0, f.t / f.max);
    if (f.t <= 0) { scene.remove(f.m); f.m.geometry.dispose(); f.m.material.dispose(); fx.splice(i, 1); }
  }

  // 6) Red (20 Hz)
  netT += dt;
  if (netT > 0.05 && G.phase !== 'over') {
    netT = 0;
    socket.volatile.emit('state', { x: p.x, y: p.y, z: p.z, yaw: p.yaw, crouch: p.crouch });
  }

  // 7) HUD
  const cross = $('xh');
  cross.style.setProperty('--g', `${4 + spread() * 520}px`);
  cross.classList.toggle('off', scoped);
  $('scope').classList.toggle('on', scoped);
  $('hpBar').style.width = `${G.hp}%`;
  $('hpBar').classList.toggle('low', G.hp <= 35);
  $('hpTxt').textContent = G.hp;
  document.querySelectorAll('#weapons div').forEach((d) => d.classList.toggle('cur', d.dataset.w === cur));
  $('ammo').textContent = reloadT > 0 ? 'Recargando' : `${ammo[cur]} / ${w.mag}`;
  $('ammo').classList.toggle('reload', reloadT > 0);
}

show('menu');
requestAnimationFrame(frame);
