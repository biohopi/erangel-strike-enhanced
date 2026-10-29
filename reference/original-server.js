const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const rooms = new Map();

const server = http.createServer((req, res) => {
  if(req.url === '/' || req.url === '/index.html'){
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
  } else if(req.url === '/health'){
    res.setHeader('Content-Type', 'text/plain');
    res.end('ok');
  } else {
    res.statusCode = 404;
    res.end('not found');
  }
});

const wss = new WebSocketServer({ server, path: '/ws' });

function genCode(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }
function send(ws, msg){ if(ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function broadcast(room, msg, exceptId){
  const s = JSON.stringify(msg);
  for(const c of wss.clients){
    if(c.room === room.code && c.id !== exceptId && c.readyState === 1) c.send(s);
  }
}

wss.on('connection', (ws) => {
  ws.id = Math.random().toString(36).slice(2,10);
  ws.room = null;
  ws.state = { x:0, y:0, z:0, yaw:0, pitch:0, hp:100, weapon:null, alive:true, team:0, kills:0, name:'player' };

  ws.on('message', (raw) => {
    let msg; try{ msg = JSON.parse(raw); }catch(e){ return; }
    handle(ws, msg);
  });

  ws.on('close', () => {
    if(ws.room && rooms.has(ws.room)){
      const room = rooms.get(ws.room);
      delete room.players[ws.id];
      broadcast(room, { t:'playerLeave', id: ws.id });
      const remaining = Object.keys(room.players);
      if(remaining.length === 0){ rooms.delete(ws.room); }
      else if(room.hostId === ws.id){
        room.hostId = remaining[0];
        broadcast(room, { t:'hostChange', id: room.hostId });
      }
    }
  });
});

function handle(ws, msg){
  if(msg.t === 'create'){
    const code = genCode();
    ws.room = code;
    ws.state.name = msg.name || 'HOST';
    ws.state.team = msg.team || 0;
    const room = {
      code,
      hostId: ws.id,
      settings: msg.settings || { blueBots:10, redBots:10, bluePlayers:4, redPlayers:4 },
      players: {},
      started: false,
    };
    room.players[ws.id] = { ...ws.state, id: ws.id };
    rooms.set(code, room);
    send(ws, { t:'created', id: ws.id, code, settings: room.settings, hostId: room.hostId });
  }
  else if(msg.t === 'join'){
    const room = rooms.get(msg.code);
    if(!room){ send(ws, { t:'error', message:'room not found' }); return; }
    const chosenTeam = msg.team || 0;
    let teamCount = [0,0];
    for(const pid in room.players) teamCount[room.players[pid].team]++;
    const maxPlayers = chosenTeam === 0 ? room.settings.bluePlayers : room.settings.redPlayers;
    if(teamCount[chosenTeam] >= maxPlayers){
      send(ws, { t:'error', message:'that team is full — pick the other' }); return;
    }
    ws.room = msg.code;
    ws.state.name = msg.name || 'PLAYER';
    ws.state.team = chosenTeam;
    room.players[ws.id] = { ...ws.state, id: ws.id };
    send(ws, { t:'joined', id: ws.id, code: msg.code, settings: room.settings, hostId: room.hostId, players: room.players });
    broadcast(room, { t:'playerJoin', id: ws.id, player: room.players[ws.id] }, ws.id);
    // ── KEY FIX: if the match is already running, drop the guest straight in.
    if(room.started){
      send(ws, { t:'started', settings: room.settings });
    }
  }
  else if(msg.t === 'start'){
    if(!ws.room || !rooms.has(ws.room)) return;
    const room = rooms.get(ws.room);
    if(room.hostId !== ws.id) return;
    room.started = true;
    broadcast(room, { t:'started', settings: room.settings });
  }
  else if(msg.t === 'state'){
    if(!ws.room || !rooms.has(ws.room)) return;
    const room = rooms.get(ws.room);
    if(!room.players[ws.id]) return;
    if(msg.d){ Object.assign(room.players[ws.id], msg.d); Object.assign(ws.state, msg.d); }
  }
  else if(msg.t === 'hostBots'){
    if(!ws.room || !rooms.has(ws.room)) return;
    const room = rooms.get(ws.room);
    if(room.hostId !== ws.id) return;
    broadcast(room, { t:'hostBots', d: msg.d }, ws.id);
  }
  else if(msg.t === 'hitBot'){
    if(!ws.room || !rooms.has(ws.room)) return;
    const room = rooms.get(ws.room);
    if(room.hostId === ws.id) return;
    const host = findWs(room, room.hostId);
    if(host) send(host, { t:'hitBot', d: msg.d });
  }
  else if(msg.t === 'damage'){
    if(!ws.room || !rooms.has(ws.room)) return;
    const room = rooms.get(ws.room);
    const target = room.players[msg.to];
    if(!target) return;
    const dmg = Math.max(0, Math.min(500, msg.dmg || 0));
    target.hp = Math.max(0, target.hp - dmg);
    if(target.hp <= 0) target.alive = false;
    const targetWs = findWs(room, msg.to);
    if(targetWs) send(targetWs, { t:'damage', dmg, head: !!msg.head, from: ws.id });
  }
  else if(msg.t === 'shoot'){
    if(!ws.room || !rooms.has(ws.room)) return;
    const room = rooms.get(ws.room);
    broadcast(room, { t:'shoot', from: ws.id, d: msg.d }, ws.id);
  }
}

function findWs(room, id){
  for(const c of wss.clients){ if(c.id === id && c.room === room.code) return c; }
  return null;
}

setInterval(() => {
  for(const room of rooms.values()){
    if(!room.started) continue;
    const states = Object.values(room.players).map(p => ({
      id: p.id, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch,
      hp: p.hp, alive: p.alive, team: p.team, weapon: p.weapon, kills: p.kills, name: p.name
    }));
    const s = JSON.stringify({ t:'players', d: states });
    for(const c of wss.clients){
      if(c.room === room.code && c.readyState === 1) c.send(s);
    }
  }
}, 100);

server.listen(PORT, () => console.log('DROPZONE live on :' + PORT));
