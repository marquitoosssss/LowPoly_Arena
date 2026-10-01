// ============================================================
//  LOWPOLY ARENA - servidor
//  Cómo ejecutar:
//    1) npm install
//    2) npm start            (http://localhost:3000)
//    3) Abre DOS pestañas/navegadores en esa URL: al conectarse el
//       segundo jugador la partida empieza sola.
//  Variables: PORT=3000
//  Tests de física: npm test
// ============================================================
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { Match } from './match.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use('/shared', express.static(path.join(root, 'shared')));
app.use('/vendor/three', express.static(path.join(root, 'node_modules/three')));
app.use(express.static(path.join(root, 'client')));

const queue = [];            // sockets esperando rival
const matches = new Map();   // socket.id -> Match

function tryPair() {
  while (queue.length >= 2) {
    const a = queue.shift(), b = queue.shift();
    const m = new Match(io, a, b, (done) => done.sockets.forEach((s) => matches.delete(s.id)));
    matches.set(a.id, m);
    matches.set(b.id, m);
  }
}

io.on('connection', (sock) => {
  queue.push(sock);
  sock.emit('waiting');
  tryPair();

  sock.on('state', (s) => matches.get(sock.id)?.relayState(sock, s));
  sock.on('shot', (d) => matches.get(sock.id)?.shot(sock, d));
  sock.on('disconnect', () => {
    const i = queue.indexOf(sock);
    if (i >= 0) queue.splice(i, 1);
    matches.get(sock.id)?.leave(sock);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Lowpoly Arena en http://localhost:${PORT}`));
