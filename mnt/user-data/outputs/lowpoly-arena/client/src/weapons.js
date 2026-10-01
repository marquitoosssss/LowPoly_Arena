import * as THREE from 'three';

// Viewmodels procedurales hechos con cajas. hip = posición desde la cadera, ads = posición apuntando.
export function buildViewmodels(camera) {
  const mk = (parts) => {
    const g = new THREE.Group();
    for (const [w, h, d, col, x, y, z, em] of parts) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: col, flatShading: true, roughness: 0.6, emissive: em ?? 0x000000 }));
      m.position.set(x, y, z);
      g.add(m);
    }
    g.visible = false;
    camera.add(g);
    return g;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  return {
    pistol: { // Desert-X
      group: mk([
        [0.05, 0.07, 0.32, 0xc9ccd8, 0, 0, -0.16],
        [0.045, 0.13, 0.075, 0x2d2a3a, 0, -0.09, -0.03],
        [0.052, 0.012, 0.22, 0xffd166, 0, 0.042, -0.16, 0x805f10],
        [0.012, 0.014, 0.012, 0xff5d73, 0, 0.045, -0.31, 0xff5d73], // alza
      ]),
      hip: V(0.2, -0.17, -0.38), ads: V(0, -0.062, -0.3),
    },
    sniper: { // Longshot
      group: mk([
        [0.06, 0.09, 0.55, 0x3b3160, 0, 0, -0.05],
        [0.022, 0.022, 0.65, 0x1d1833, 0, 0.01, -0.62],
        [0.05, 0.05, 0.24, 0x1d1833, 0, 0.085, -0.1],
        [0.04, 0.04, 0.01, 0x2ec4b6, 0, 0.085, -0.225, 0x2ec4b6], // lente
        [0.055, 0.1, 0.26, 0x2d2a3a, 0, -0.01, 0.35],
      ]),
      hip: V(0.2, -0.19, -0.42), ads: V(0, -0.085, -0.3),
    },
    rifle: { // ASR-9
      group: mk([
        [0.06, 0.09, 0.46, 0x4a3a85, 0, 0, -0.05],
        [0.028, 0.028, 0.32, 0x1d1833, 0, 0.01, -0.4],
        [0.04, 0.15, 0.07, 0xff8a5c, 0, -0.11, -0.04],
        [0.05, 0.09, 0.24, 0x2d2a3a, 0, -0.01, 0.3],
        [0.02, 0.03, 0.02, 0xffd166, 0, 0.06, -0.3, 0x805f10],
      ]),
      hip: V(0.2, -0.18, -0.4), ads: V(0, -0.07, -0.3),
    },
  };
}
