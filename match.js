import { ROUNDS, MAX_HP, WEAPONS } from '../shared/weapons.js';
import { SPAWNS } from '../shared/map.js';

const COUNTDOWN_MS = 3000;
const BETWEEN_MS = 3500;

// Una partida = 2 sockets, exactamente ROUNDS rondas (se juegan todas; gana quien tenga más).
export class Match {
  constructor(io, a, b, onEnd) {
    this.io = io;
    this.onEnd = onEnd;
    this.sockets = [a, b];
    this.room = `match_${a.id}_${b.id}`;
    this.round = 0;
    this.phase = 'idle'; // idle | countdown | live | between | over
    this.timers = [];
    this.p = {};
    for (const s of this.sockets) {
      s.join(this.room);
      this.p[s.id] = { score: 0, hp: MAX_HP, lastShot: 0 };
    }
    a.emit('matchStart', { opponent: b.id });
    b.emit('matchStart', { opponent: a.id });
    this.startRound();
  }

  later(fn, ms) { this.timers.push(setTimeout(fn, ms)); }
  scores() { return Object.fromEntries(this.sockets.map((s) => [s.id, this.p[s.id].score])); }
  other(sock) { return this.sockets.find((s) => s.id !== sock.id); }

  startRound() {
    this.round++;
    this.phase = 'countdown';
    this.sockets.forEach((s, i) => {
      this.p[s.id].hp = MAX_HP;
      // Los spawns se alternan cada ronda para que sea justo
      const spawn = SPAWNS[(i + this.round) % 2];
      s.emit('roundStart', { round: this.round, total: ROUNDS, spawn, scores: this.scores(), countdown: COUNTDOWN_MS / 1000 });
    });
    this.later(() => { this.phase = 'live'; this.io.to(this.room).emit('roundLive'); }, COUNTDOWN_MS);
  }

  relayState(sock, state) {
    if (this.phase === 'over') return;
    sock.to(this.room).volatile.emit('enemyState', state);
  }

  // El cliente tirador informa del disparo y si su rayo impactó.
  // Servidor autoritativo en: daño, cadencia, HP y puntuación.
  // (Para producción: validar posiciones/lag-compensation en servidor.)
  shot(sock, d) {
    if (this.phase !== 'live') return;
    const w = WEAPONS[d?.weapon];
    const me = this.p[sock.id];
    if (!w || !me) return;
    const now = Date.now();
    if (now - me.lastShot < w.cd * 1000 * 0.8) return; // anti-spam de cadencia
    me.lastShot = now;
    this.other(sock).emit('enemyShot', { weapon: d.weapon, o: d.o, e: d.e });
    if (!d.hit) return;

    const victim = this.other(sock);
    const v = this.p[victim.id];
    v.hp = Math.max(0, v.hp - Math.round(w.dmg * (d.head ? w.head : 1)));
    this.io.to(this.room).emit('hp', { id: victim.id, hp: v.hp, head: !!d.head });
    if (v.hp <= 0) this.endRound(sock);
  }

  endRound(winner) {
    this.phase = 'between';
    this.p[winner.id].score++;
    this.io.to(this.room).emit('roundEnd', { winner: winner.id, scores: this.scores() });
    if (this.round >= ROUNDS) this.later(() => this.finish(), BETWEEN_MS);
    else this.later(() => this.startRound(), BETWEEN_MS);
  }

  finish() {
    this.phase = 'over';
    const [a, b] = this.sockets;
    const sa = this.p[a.id].score, sb = this.p[b.id].score;
    this.io.to(this.room).emit('matchEnd', { winner: sa > sb ? a.id : b.id, scores: this.scores() });
    this.dispose();
  }

  leave(sock) {
    if (this.phase === 'over') return;
    this.phase = 'over';
    this.other(sock)?.emit('opponentLeft');
    this.dispose();
  }

  dispose() {
    this.timers.forEach(clearTimeout);
    this.onEnd?.(this);
  }
}
