// Mapa "Dusk Yard": una única fuente de verdad para física (cliente), render y spawns (servidor).
// Sólidos = cajas y rampas. Una rampa sube desde y0 hasta y1 en dirección `dir`.
export const PLAYER = { radius: 0.4, height: 1.8, crouchHeight: 1.0, step: 0.55 };
export const ARENA = 30; // semilado

// Mirando a -Z con yaw=0 -> forward = (-sin yaw, -cos yaw)
export const SPAWNS = [
  { x: -26, z: 0, yaw: -Math.PI / 2 },
  { x: 26, z: 0, yaw: Math.PI / 2 },
];

const box = (x0, x1, z0, z1, y0, y1, c) => ({ t: 'box', x0, x1, z0, z1, y0, y1, c });
const ramp = (x0, x1, z0, z1, y0, y1, dir, c = 'ramp') => ({ t: 'ramp', x0, x1, z0, z1, y0, y1, dir, c });

export const SOLIDS = [
  // Perímetro
  box(-31, -30, -31, 31, 0, 9, 'wall'), box(30, 31, -31, 31, 0, 9, 'wall'),
  box(-30, 30, -31, -30, 0, 9, 'wall'), box(-30, 30, 30, 31, 0, 9, 'wall'),
  // Torre central (3.2 m) con cobertura encima
  box(-6, 6, -6, 6, 0, 3.2, 'plat'),
  box(-1.2, 1.2, -1.2, 1.2, 3.2, 4.4, 'crate'),
  box(-4.5, -3.9, -3, 3, 3.2, 4.2, 'accent'), box(3.9, 4.5, -3, 3, 3.2, 4.2, 'accent'),
];

for (const sx of [-1, 1]) {
  const X = (a, b) => (sx > 0 ? [a, b] : [-b, -a]);
  SOLIDS.push(
    ramp(...X(6, 16), -3, 3, 0, 3.2, sx > 0 ? '-x' : '+x'), // rampa a la torre
    box(...X(20, 20.8), -7, -2, 0, 2.6, 'wall'),            // muros junto al spawn
    box(...X(20, 20.8), 2, 7, 0, 2.6, 'wall'),
  );
  for (const sz of [-1, 1]) {
    const Z = (a, b) => (sz > 0 ? [a, b] : [-b, -a]);
    SOLIDS.push(
      box(...X(21, 23), ...Z(13, 15), 0, 4, 'accent'),      // pilares
      box(...X(13, 15), ...Z(9, 11), 0, 1.4, 'crate'),      // cajas medias
      box(...X(24, 26), ...Z(8, 10), 0, 1.2, 'crate2'),     // cobertura baja de spawn
    );
  }
}
for (const sz of [-1, 1]) {
  const Z = (a, b) => (sz > 0 ? [a, b] : [-b, -a]);
  SOLIDS.push(
    box(-10, 10, ...Z(17, 25), 0, 2.4, 'plat'),             // miradores norte/sur
    ramp(-4, 4, ...Z(9, 17), 0, 2.4, sz > 0 ? '+z' : '-z'),
    box(-5, 5, ...Z(22, 22.6), 2.4, 3.6, 'accent'),         // muro bajo sobre el mirador
  );
}

// Fracción [0..1] a lo largo de la subida de la rampa
export function rampU(r, x, z) {
  const cx = Math.min(Math.max(x, r.x0), r.x1), cz = Math.min(Math.max(z, r.z0), r.z1);
  switch (r.dir) {
    case '+x': return (cx - r.x0) / (r.x1 - r.x0);
    case '-x': return (r.x1 - cx) / (r.x1 - r.x0);
    case '+z': return (cz - r.z0) / (r.z1 - r.z0);
    default:   return (r.z1 - cz) / (r.z1 - r.z0);
  }
}
// Punto XZ de la rampa: u a lo largo de la subida, w a lo ancho
export function rampPoint(r, u, w) {
  const lx = r.x1 - r.x0, lz = r.z1 - r.z0;
  switch (r.dir) {
    case '+x': return [r.x0 + lx * u, r.z0 + lz * w];
    case '-x': return [r.x1 - lx * u, r.z0 + lz * w];
    case '+z': return [r.x0 + lx * w, r.z0 + lz * u];
    default:   return [r.x0 + lx * w, r.z1 - lz * u];
  }
}
export const topAt = (s, x, z) => (s.t === 'box' ? s.y1 : s.y0 + (s.y1 - s.y0) * rampU(s, x, z));
export const inRect = (s, x, z, m) => x > s.x0 - m && x < s.x1 + m && z > s.z0 - m && z < s.z1 + m;
