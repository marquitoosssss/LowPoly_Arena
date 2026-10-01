import assert from 'node:assert/strict';
import { stepPlayer } from '../client/src/physics.js';

const mk = (x, z, yaw) => ({ x, y: 0, z, vx: 0, vy: 0, vz: 0, yaw, grounded: true, crouch: false, sliding: false, slideT: 0, sdx: 0, sdz: 0, sprinting: false });
const inp = (o = {}) => ({ fwd: 0, back: 0, left: 0, right: 0, sprint: false, jump: false, crouch: false, crouchPressed: false, ads: false, ...o });
const run = (p, i, secs) => { for (let n = 0; n < secs * 120; n++) stepPlayer(p, i, 1 / 120); };

// 1) Subir la rampa oeste hasta la torre sin atascarse
let p = mk(-19, 0, -Math.PI / 2); // antes del pie de la rampa (x=-16)
run(p, inp({ fwd: 1, sprint: true }), 4);
assert.ok(p.y > 3.1 && p.grounded, `debe estar sobre la torre (y=${p.y.toFixed(2)})`);

// 2) Saltar y aterrizar en llano
p = mk(-26, 0, -Math.PI / 2);
stepPlayer(p, inp({ jump: true }), 1 / 120);
assert.ok(!p.grounded && p.vy > 0);
run(p, inp(), 2);
assert.ok(p.grounded && Math.abs(p.y) < 1e-6);

// 3) Slide: impulso al agacharse corriendo, y decae
p = mk(-26, 0, -Math.PI / 2);
run(p, inp({ fwd: 1, sprint: true }), 0.6);
stepPlayer(p, inp({ fwd: 1, sprint: true, crouch: true, crouchPressed: true }), 1 / 120);
assert.ok(p.sliding, 'debe iniciar slide');
const v0 = Math.hypot(p.vx, p.vz);
run(p, inp({ crouch: true }), 0.5);
const v1 = Math.hypot(p.vx, p.vz);
assert.ok(v0 > 13 && v1 < v0, `el slide decae (${v0.toFixed(1)} -> ${v1.toFixed(1)})`);

// 4) Un muro alto bloquea (muro de spawn)
p = mk(-24, 4.5, -Math.PI / 2);
run(p, inp({ fwd: 1 }), 2);
assert.ok(p.x < -20.8, 'el muro debe bloquear');

console.log('OK: física verificada');
