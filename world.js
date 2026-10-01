import * as THREE from 'three';
import { SOLIDS, ARENA, rampPoint } from '../../shared/map.js';

// Paleta "atardecer": violetas profundos de base, menta en rampas (se leen al instante),
// coral y ámbar como acentos de cobertura.
const PAL = {
  sky: 0x2a1650, fog: 0x4a2470, floorA: 0x2f2a5e, floorB: 0x3a3272,
  wall: 0x4a3a85, plat: 0x5f4cae, ramp: 0x2ec4b6, crate: 0xff5d73, crate2: 0xffd166, accent: 0xff8a5c,
  trim: 0xffe9b0,
};

function rampGeo(r) {
  const P = (u, w, h) => { const [x, z] = rampPoint(r, u, w); return [x, h, z]; };
  const L0 = P(0, 0, r.y0), L1 = P(0, 1, r.y0), B0 = P(1, 0, r.y0), B1 = P(1, 1, r.y0);
  const T0 = P(1, 0, r.y1), T1 = P(1, 1, r.y1);
  const tris = [L0, L1, T1, L0, T1, T0,  L0, T0, B0,  L1, B1, T1,  B0, T0, T1, B0, T1, B1,  L0, B0, B1, L0, B1, L1];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  return g;
}

export function buildWorld(scene) {
  scene.background = new THREE.Color(PAL.sky);
  scene.fog = new THREE.Fog(PAL.fog, 45, 140);

  // Iluminación: cielo violeta + sol bajo ámbar con sombras largas + puntos de color en zonas clave
  scene.add(new THREE.HemisphereLight(0xb9a6ff, 0x2a1840, 1.3));
  const sunPos = new THREE.Vector3(-45, 38, -50);
  const sun = new THREE.DirectionalLight(0xffb27a, 2.6);
  sun.position.copy(sunPos);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, far: 160 });
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  [[0, 7, 0, 0x2ec4b6], [0, 5, 21, 0xff5d73], [0, 5, -21, 0xff5d73], [-24, 5, 0, 0xffd166], [24, 5, 0, 0xffd166]]
    .forEach(([x, y, z, c]) => { const l = new THREE.PointLight(c, 120, 32, 2); l.position.set(x, y, z); scene.add(l); });

  // Suelo en damero con colores por vértice (flat shaded)
  const N = 12;
  const fg = new THREE.PlaneGeometry(ARENA * 2, ARENA * 2, N, N).toNonIndexed();
  fg.rotateX(-Math.PI / 2);
  const cols = new Float32Array(fg.attributes.position.count * 3);
  const A = new THREE.Color(PAL.floorA), B = new THREE.Color(PAL.floorB);
  for (let i = 0; i < fg.attributes.position.count; i++) {
    const cell = Math.floor(i / 6), c = ((cell % N) + Math.floor(cell / N)) % 2 ? A : B;
    cols.set([c.r, c.g, c.b], i * 3);
  }
  fg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const floor = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }));
  floor.receiveShadow = true;
  scene.add(floor);

  // Sólidos del mapa (los mismos que usa la física)
  const collidables = [floor];
  const mats = {};
  const mat = (k) => (mats[k] ??= new THREE.MeshStandardMaterial({
    color: PAL[k], flatShading: true, roughness: 0.75, side: THREE.DoubleSide,
    emissive: k === 'ramp' || k === 'accent' ? PAL[k] : 0x000000, emissiveIntensity: 0.12,
  }));
  const trim = new THREE.LineBasicMaterial({ color: PAL.trim, transparent: true, opacity: 0.35 });
  for (const s of SOLIDS) {
    let mesh;
    if (s.t === 'box') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(s.x1 - s.x0, s.y1 - s.y0, s.z1 - s.z0), mat(s.c));
      mesh.position.set((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, (s.z0 + s.z1) / 2);
    } else {
      mesh = new THREE.Mesh(rampGeo(s), mat(s.c));
    }
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 20), trim));
    scene.add(mesh);
    collidables.push(mesh);
  }

  // Horizonte: montañas de 5 caras y un sol poligonal alineado con la luz
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2, r = 95 + (i % 3) * 8, h = 22 + ((i * 7) % 5) * 8;
    const m = new THREE.Mesh(new THREE.ConeGeometry(14 + (i % 4) * 3, h, 5),
      new THREE.MeshStandardMaterial({ color: i % 2 ? 0x2b1650 : 0x3a1f68, flatShading: true }));
    m.position.set(Math.cos(ang) * r, h / 2 - 2, Math.sin(ang) * r);
    m.rotation.y = i;
    scene.add(m);
  }
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(22, 6), new THREE.MeshBasicMaterial({ color: 0xff9a62, fog: false }));
  sunDisc.position.copy(sunPos).multiplyScalar(2.2);
  sunDisc.lookAt(0, 0, 0);
  scene.add(sunDisc);

  return { collidables };
}
