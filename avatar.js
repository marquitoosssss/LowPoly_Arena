import * as THREE from 'three';

// Origen del grupo = pies. Mira hacia -Z con rotation.y = 0 (igual que la cámara).
export function makeAvatar() {
  const g = new THREE.Group();
  const M = (c, e = 0x000000) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, emissive: e, roughness: 0.7 });
  const part = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };

  const coral = M(0xff5d73), dark = M(0x2b2350);
  part(new THREE.BoxGeometry(0.6, 0.75, 0.34), coral, 0, 1.05, 0);              // torso
  part(new THREE.BoxGeometry(0.22, 0.7, 0.24), dark, -0.16, 0.35, 0);           // piernas
  part(new THREE.BoxGeometry(0.22, 0.7, 0.24), dark, 0.16, 0.35, 0);
  part(new THREE.IcosahedronGeometry(0.22, 0), M(0xffd166), 0, 1.58, 0);        // cabeza
  part(new THREE.BoxGeometry(0.3, 0.08, 0.1), M(0x2ec4b6, 0x2ec4b6), 0, 1.6, -0.2); // visor
  part(new THREE.BoxGeometry(0.08, 0.1, 0.5), dark, 0.3, 1.1, -0.3);            // arma

  // Hitboxes invisibles (Raycaster las ignora si no están visibles? no: Mesh.raycast no comprueba .visible)
  const inv = new THREE.MeshBasicMaterial({ visible: false });
  const hitBody = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.35, 8), inv);
  hitBody.position.y = 0.675;
  const hitHead = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), inv);
  hitHead.position.y = 1.6;
  g.add(hitBody, hitHead);
  g.userData = { hitBody, hitHead };
  return g;
}
