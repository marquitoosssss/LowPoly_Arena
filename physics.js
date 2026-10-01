// Física del jugador: cilindro vertical + "step-up" sobre sólidos (cajas y rampas).
// Sin motor externo: la altura del suelo se consulta por posición, así las rampas
// y desniveles (<= step) se suben suavemente y nunca se atasca el jugador.
import { SOLIDS, PLAYER, topAt, inRect } from '../../shared/map.js';

export const MOVE = {
  walk: 6.2, sprint: 9.8, crouch: 3.2,
  slide: 15, slideEnd: 3.5, slideTime: 0.95,   // impulso inicial -> decae (cuadrático) hasta slideEnd
  jump: 8.2, gravity: 24, accelGround: 60, accelAir: 9,
};

// Altura del suelo bajo (x,z): el techo más alto alcanzable (<= pies + step)
export function groundAt(x, z, feet) {
  let g = 0;
  for (const s of SOLIDS) {
    if (!inRect(s, x, z, PLAYER.radius * 0.7)) continue;
    const t = topAt(s, x, z);
    if (t <= feet + PLAYER.step && t > g) g = t;
  }
  return g;
}

// ¿Hay un muro (sólido más alto que el escalón) a la altura del cuerpo?
export function blocked(x, z, feet, h) {
  for (const s of SOLIDS) {
    if (!inRect(s, x, z, PLAYER.radius)) continue;
    if (s.y0 >= feet + h - 0.05) continue;               // está por encima de la cabeza
    if (topAt(s, x, z) > feet + PLAYER.step) return true;
  }
  return false;
}

/**
 * p:  {x,y(pies),z,vx,vy,vz,yaw,grounded,crouch,sliding,slideT,sdx,sdz,sprinting}
 * i:  {fwd,back,left,right,sprint,jump,crouch,crouchPressed,ads}
 */
export function stepPlayer(p, i, dt, adsMul = 1) {
  const fwd = i.fwd - i.back, side = i.right - i.left;
  const sn = Math.sin(p.yaw), cs = Math.cos(p.yaw);
  let wx = -sn * fwd + cs * side, wz = -cs * fwd - sn * side;
  const len = Math.hypot(wx, wz);
  if (len > 0) { wx /= len; wz /= len; }
  const speed = Math.hypot(p.vx, p.vz);

  // --- Deslizamiento: agacharse mientras se corre ---
  if (i.crouchPressed && p.grounded && !p.sliding && p.sprinting && speed > MOVE.walk) {
    p.sliding = true; p.slideT = 0; p.sdx = p.vx / speed; p.sdz = p.vz / speed;
  }
  if (p.sliding && !i.crouch) p.sliding = false;         // soltar agacharse cancela
  if (i.jump && p.grounded) { p.vy = MOVE.jump; p.grounded = false; p.sliding = false; } // conserva inercia

  // --- Agachado (no se levanta si hay techo) ---
  if (i.crouch || p.sliding) p.crouch = true;
  else if (p.crouch && !blocked(p.x, p.z, p.y, PLAYER.height)) p.crouch = false;
  p.sprinting = !!(i.sprint && fwd > 0 && !i.ads && !p.crouch && p.grounded);
  const h = p.crouch ? PLAYER.crouchHeight : PLAYER.height;

  // --- Velocidad horizontal ---
  if (p.sliding) {
    p.slideT += dt;
    const k = Math.max(0, 1 - p.slideT / MOVE.slideTime);
    const s = MOVE.slideEnd + (MOVE.slide - MOVE.slideEnd) * k * k;
    p.vx = p.sdx * s; p.vz = p.sdz * s;
    if (p.slideT >= MOVE.slideTime) p.sliding = false;
  } else if (p.grounded || len > 0) {
    const base = p.crouch ? MOVE.crouch : p.sprinting ? MOVE.sprint : MOVE.walk * adsMul;
    const t = p.grounded ? base : Math.max(base, speed);  // en el aire se conserva el impulso
    const tx = wx * t, tz = wz * t;
    const a = (p.grounded ? MOVE.accelGround : MOVE.accelAir) * dt;
    const dx = tx - p.vx, dz = tz - p.vz, d = Math.hypot(dx, dz);
    if (d <= a) { p.vx = tx; p.vz = tz; } else { p.vx += (dx / d) * a; p.vz += (dz / d) * a; }
  }

  // --- Movimiento con colisión por ejes (desliza por las paredes) ---
  const nx = p.x + p.vx * dt;
  if (!blocked(nx, p.z, p.y, h)) p.x = nx; else { p.vx = 0; p.sliding = false; }
  const nz = p.z + p.vz * dt;
  if (!blocked(p.x, nz, p.y, h)) p.z = nz; else { p.vz = 0; p.sliding = false; }

  // --- Vertical: gravedad + aterrizaje + pegado al suelo en bajadas ---
  p.vy -= MOVE.gravity * dt;
  const ny = p.y + p.vy * dt;
  const g = groundAt(p.x, p.z, p.y);
  if (p.vy <= 0 && (ny <= g || (p.grounded && p.y - g < 0.4))) {
    p.y = g; p.vy = 0; p.grounded = true;
  } else {
    p.y = ny; p.grounded = false;
  }
}
