const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT || 3000);
const DIST = path.join(__dirname, 'dist');
const rooms = new Map();
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.json':'application/json; charset=utf-8' };

const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200, {'content-type':'text/plain; charset=utf-8'}); return res.end('ok'); }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); return res.end('bad request'); }
  let target = path.resolve(DIST, '.' + pathname);
  if (!target.startsWith(DIST + path.sep) && target !== path.join(DIST, 'index.html')) { res.writeHead(403); return res.end('forbidden'); }
  if (pathname === '/') target = path.join(DIST, 'index.html');
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    if (!path.extname(pathname)) target = path.join(DIST, 'index.html');
    else { res.writeHead(404); return res.end('not found'); }
  }
  if (!fs.existsSync(target)) { res.writeHead(503); return res.end('Build the app first with npm run build.'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream', 'cache-control': path.extname(target) === '.html' ? 'no-cache' : 'public, max-age=3600' });
  fs.createReadStream(target).pipe(res);
});
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
const defaults = { blueBots: 10, redBots: 10, bluePlayers: 4, redPlayers: 4 };
const cleanSettings = (input = {}) => ({
  blueBots: clampInt(input.blueBots, 0, 25, defaults.blueBots),
  redBots: clampInt(input.redBots, 0, 25, defaults.redBots),
  bluePlayers: clampInt(input.bluePlayers, 1, 8, defaults.bluePlayers),
  redPlayers: clampInt(input.redPlayers, 1, 8, defaults.redPlayers),
});
function clampInt(v, min, max, fallback) { const n = Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback; }
function code() { let value; do { value = Math.random().toString(36).slice(2, 8).toUpperCase(); } while (rooms.has(value)); return value; }
function send(ws, data) { if (ws.readyState === 1) ws.send(JSON.stringify(data)); }
function socketsFor(room) { return [...wss.clients].filter(c => c.roomCode === room.code && c.readyState === 1); }
function broadcast(room, data, exceptId = null) { const payload = JSON.stringify(data); for (const c of socketsFor(room)) if (c.id !== exceptId) c.send(payload); }
function roster(room) { return Object.values(room.players).map(p => ({ id:p.id, name:p.name, team:p.team, host:p.id === room.hostId, alive:p.alive, x:p.x, y:p.y, z:p.z, yaw:p.yaw, pitch:p.pitch, hp:p.hp, weapon:p.weapon, kills:p.kills })); }
function publishRoom(room) { broadcast(room, { t:'roomUpdate', code:room.code, settings:room.settings, players:roster(room), hostId:room.hostId, started:room.started }); }
function findSocket(room, id) { return socketsFor(room).find(c => c.id === id); }
function leave(ws) {
  if (!ws.roomCode) return;
  const room = rooms.get(ws.roomCode); const roomCode = ws.roomCode; ws.roomCode = null;
  if (!room) return;
  delete room.players[ws.id];
  if (Object.keys(room.players).length === 0) { rooms.delete(roomCode); return; }
  if (room.hostId === ws.id) {
    room.hostId = Object.keys(room.players)[0];
    broadcast(room, { t:'hostChange', id:room.hostId });
  }
  broadcast(room, { t:'playerLeave', id:ws.id });
  publishRoom(room);
}
function joinRoom(ws, room, team, name) {
  team = team === 1 ? 1 : 0;
  const cap = team === 0 ? room.settings.bluePlayers : room.settings.redPlayers;
  const count = Object.values(room.players).filter(p => p.team === team).length;
  if (count >= cap) { send(ws, {t:'error', message:'That team is full — choose the other team'}); return false; }
  ws.roomCode = room.code;
  ws.state = { id:ws.id, name:String(name || 'PLAYER').slice(0,20), team, x:0,y:0,z:0,yaw:0,pitch:0,hp:100,weapon:null,alive:true,kills:0 };
  room.players[ws.id] = ws.state;
  send(ws, {t:'joined', id:ws.id, code:room.code, settings:room.settings, hostId:room.hostId, players:roster(room), started:room.started});
  broadcast(room, {t:'playerJoin', id:ws.id, player:{...ws.state,host:false}}, ws.id);
  publishRoom(room);
  if (room.started) send(ws, {t:'started', settings:room.settings});
  return true;
}
function handle(ws, msg) {
  if (!msg || typeof msg.t !== 'string') return;
  if (msg.t === 'create') {
    if (ws.roomCode) leave(ws);
    const roomCode = code();
    const settings = cleanSettings(msg.settings);
    const room = { code:roomCode, hostId:ws.id, settings, players:{}, started:false };
    rooms.set(roomCode, room);
    if (!joinRoom(ws, room, msg.team, msg.name || 'HOST')) { rooms.delete(roomCode); return; }
    // A created message lets the host know it owns the room; joining the room itself never auto-starts a match.
    send(ws, {t:'created', id:ws.id, code:roomCode, settings, hostId:ws.id, players:roster(room)});
    publishRoom(room);
    return;
  }
  if (msg.t === 'join') {
    const room = rooms.get(String(msg.code || '').trim().toUpperCase());
    if (!room) return send(ws, {t:'error', message:'Room not found'});
    if (room.started) return send(ws, {t:'error', message:'Match already started — create a new room'});
    if (ws.roomCode) leave(ws);
    joinRoom(ws, room, msg.team, msg.name);
    return;
  }
  if (msg.t === 'roomSettings') {
    const room = rooms.get(ws.roomCode); if (!room || room.hostId !== ws.id || room.started) return;
    const next = cleanSettings(msg.settings);
    // Do not let the host shrink a team below the current player count.
    for (const team of [0,1]) {
      const count = Object.values(room.players).filter(p => p.team === team).length;
      const key = team === 0 ? 'bluePlayers' : 'redPlayers';
      next[key] = Math.max(next[key], count, 1);
    }
    room.settings = next; publishRoom(room); return;
  }
  if (msg.t === 'team') {
    const room = rooms.get(ws.roomCode); if (!room || room.started || !room.players[ws.id]) return;
    const team = msg.team === 1 ? 1 : 0;
    const cap = team === 0 ? room.settings.bluePlayers : room.settings.redPlayers;
    if (Object.values(room.players).filter(p => p.team === team).length >= cap) return send(ws, {t:'error', message:'That team is full', code:room.code, settings:room.settings, players:roster(room)});
    room.players[ws.id].team = team; if (ws.state) ws.state.team = team; publishRoom(room); return;
  }
  if (msg.t === 'start') {
    const room = rooms.get(ws.roomCode); if (!room || room.hostId !== ws.id || room.started) return;
    room.started = true;
    broadcast(room, {t:'started', settings:room.settings, players:roster(room)});
    publishRoom(room);
    return;
  }
  if (msg.t === 'state') {
    const room = rooms.get(ws.roomCode); if (!room || !room.started || !room.players[ws.id] || !msg.d || typeof msg.d !== 'object') return;
    const d = msg.d; const p = room.players[ws.id];
    for (const key of ['x','y','z','yaw','pitch']) if (Number.isFinite(Number(d[key]))) p[key] = Math.max(-5000, Math.min(5000, Number(d[key])));
    if (Number.isFinite(Number(d.hp))) p.hp = clampInt(d.hp, 0, 100, p.hp);
    if (typeof d.alive === 'boolean') p.alive = d.alive;
    // Team assignment is controlled by the room server; never trust a client state packet to change it.
    if (typeof d.weapon === 'string') p.weapon = d.weapon.slice(0,40);
    if (Number.isFinite(Number(d.kills))) p.kills = clampInt(d.kills,0,999,p.kills);
    return;
  }
  if (msg.t === 'hostBots') {
    const room = rooms.get(ws.roomCode); if (!room || room.hostId !== ws.id || !room.started) return;
    broadcast(room, {t:'hostBots', d:msg.d}, ws.id); return;
  }
  if (msg.t === 'hitBot') {
    const room = rooms.get(ws.roomCode); if (!room || room.hostId === ws.id) return;
    const host = findSocket(room, room.hostId); if (host) send(host, {t:'hitBot', d:msg.d}); return;
  }
  if (msg.t === 'damage') {
    const room = rooms.get(ws.roomCode); if (!room || !room.started || !room.players[msg.to]) return;
    const target = room.players[msg.to]; const dmg = Math.max(0, Math.min(100, Number(msg.dmg) || 0));
    target.hp = Math.max(0, target.hp - dmg); if (target.hp <= 0) target.alive = false;
    const targetWs = findSocket(room, msg.to); if (targetWs) send(targetWs, {t:'damage', dmg, head:!!msg.head, from:ws.id});
    publishRoom(room); return;
  }
  if (msg.t === 'shoot') { const room = rooms.get(ws.roomCode); if (room && room.started) broadcast(room, {t:'shoot', from:ws.id, d:msg.d}, ws.id); }
}

wss.on('connection', ws => {
  ws.id = Math.random().toString(36).slice(2, 12);
  ws.roomCode = null;
  ws.state = null;
  ws.on('message', raw => { let msg; try { msg = JSON.parse(raw.toString()); } catch { return; } try { handle(ws, msg); } catch (err) { console.error('WebSocket message failed:', err); send(ws, {t:'error', message:'Server could not process that action'}); } });
  ws.on('close', () => leave(ws));
});
setInterval(() => {
  for (const room of rooms.values()) {
    if (!room.started) continue;
    const payload = JSON.stringify({t:'players', d:roster(room)});
    for (const ws of socketsFor(room)) ws.send(payload);
  }
}, 100);
server.listen(PORT, '0.0.0.0', () => console.log(`Erangel Strike server listening on ${PORT}`));
