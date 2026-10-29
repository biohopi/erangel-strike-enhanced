from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
original = (root / 'reference/original-game.html').read_text()
engine = original.split('<script type="module">', 1)[1].split('</script>', 1)[0]
shell = original.split('<script type="importmap">', 1)[0]

def replace(old, new):
    global engine
    assert old in engine, f'Missing source: {old[:100]}'
    engine = engine.replace(old, new)

def section(start, end, new):
    global engine
    a = engine.index(start)
    b = engine.index(end, a)
    engine = engine[:a] + new + '\n\n' + engine[b:]

replace("import * as THREE from 'three';", "import * as THREE from 'three';\nimport { Sky } from 'three/addons/objects/Sky.js';")
replace("import { mergeGeometries } from 'https://unpkg.com/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js';", """import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeWeapon, makeOptic, makeOperative, setOperativeWeapon, animateOperatives, surfaceTexture, soldierReady } from './visuals.js';
import { DEFAULT_INVENTORY, DEFAULT_SETTINGS, SCOPE_IDS, SCOPE_ZOOM } from './data.ts';

let gameSettings = { ...DEFAULT_SETTINGS };
let inventoryState = structuredClone(DEFAULT_INVENTORY);
let initialized = false, training = false;
let syncTimer = null;
const post = (type, data = {}) => parent.postMessage({ source: 'erangel-game', type, ...data }, location.origin);
""")

# There must never be an ambient, source-less weapon event.
replace("  if(phase==='ground' && !layoutEditing && Math.random() < dt*0.6) Audio_.shot('ar', rand(0.03,0.12));", '')
replace('let ctx=null, noiseBuf=null;', 'let ctx=null, noiseBuf=null, master=null;')
replace('function init(){ if(ctx) return;', 'function init(){ if(ctx){ ctx.resume(); return; }')
replace('    const len = ctx.sampleRate*0.5;', "    master = ctx.createGain(); master.gain.value = gameSettings.muted ? 0 : gameSettings.volume / 100; master.connect(ctx.destination);\n    const len = ctx.sampleRate*0.5;")
replace('function boom(vol,freq,dur){', 'function boom(vol,freq,dur,pan=0){')
replace('src.connect(flt); flt.connect(g); g.connect(ctx.destination);', 'const panner=ctx.createStereoPanner(); panner.pan.value=pan; src.connect(flt); flt.connect(g); g.connect(panner); panner.connect(master);')
replace('g.connect(ctx.destination); o.start();', 'g.connect(master); o.start();')
section('    shot(kind,vol=1){', '    hit(){', """    configure(){ if(master) master.gain.value = gameSettings.muted || document.hidden || paused ? 0 : gameSettings.volume / 100; },
    suspend(){ if(master) master.gain.value=0; },
    shot(kind,vol=1,position=null){
      if(!ctx || !initialized || paused || phase!=='ground' || !player.alive || document.hidden || gameSettings.muted) return;
      let pan=0;
      if(position){
        const distance=player.pos.distanceTo(position);
        if(distance>130) return;
        vol *= Math.pow(1-distance/130, 2);
        const dx=position.x-player.pos.x, dz=position.z-player.pos.z;
        pan=clamp((dx*Math.cos(player.yaw)-dz*Math.sin(player.yaw))/Math.max(1,distance),-.9,.9);
      }
      if(vol<.005) return;
      if(kind==='sniper') boom(.65*vol,3000,.31,pan);
      else if(kind==='shotgun') boom(.55*vol,1900,.24,pan);
      else if(kind==='ar') boom(.38*vol,2400,.13,pan);
      else if(kind==='smg') boom(.25*vol,2900,.085,pan);
      else boom(.28*vol,2600,.1,pan);
    },
""")
replace('renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));', 'renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));')
replace('sun.shadow.mapSize.set(2048,2048);', 'sun.shadow.mapSize.set(1024,1024);')
replace('renderer.outputColorSpace = THREE.SRGBColorSpace;', 'renderer.outputColorSpace = THREE.SRGBColorSpace;\nrenderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;')
replace('renderer.shadowMap.type = THREE.PCFSoftShadowMap;', 'renderer.shadowMap.type = THREE.PCFShadowMap;')
replace('new THREE.Fog(0xcfe0ef, 220, 950)', 'new THREE.Fog(0xc6c7ae, 130, 820)')
replace('new THREE.HemisphereLight(0xbfd8f0, 0x40602c, 1.15)', 'new THREE.HemisphereLight(0xd0dbe0, 0x57583f, 2.0)')
replace('new THREE.DirectionalLight(0xfff2cf, 2.1)', 'new THREE.DirectionalLight(0xffe3b0, 3.0)')
replace('0x3f7fc4', '0x718b96')
replace('0xd6e6f2', '0xd7d4bd')
section('{\n  const g = new THREE.SphereGeometry(2000,24,12);', '/* ══════ TERRAIN ══════ */', """const sky=new Sky();sky.scale.setScalar(2000);
sky.material.uniforms.turbidity.value=8;
sky.material.uniforms.rayleigh.value=2;
sky.material.uniforms.mieCoefficient.value=.004;
sky.material.uniforms.mieDirectionalG.value=.78;
sky.material.uniforms.sunPosition.value.copy(sun.position).normalize();scene.add(sky);
""")
replace('   const d = Math.sqrt(x*x+z*z);', '   const d = Math.sqrt(x*x+z*z);') if '   const d = Math.sqrt(x*x+z*z);' in engine else None
replace('  return h;\n}', '  if(Math.abs(x)<100 && Math.abs(z)<110) h*=.08;\n  return h;\n}')
replace('new THREE.Color(0x5f8f3c), cB = new THREE.Color(0x3f6b28), cD = new THREE.Color(0x7b6a47)', 'new THREE.Color(0xa3a17d), cB = new THREE.Color(0x7f8862), cD = new THREE.Color(0x8c8065)')
replace('new THREE.MeshLambertMaterial({vertexColors:true})', "new THREE.MeshStandardMaterial({vertexColors:true, map:surfaceTexture('ground'), roughness:1})")
replace('const worldMeshes = [], buildingSpots = [];', """const worldMeshes = [], buildingSpots = [], floorSurfaces = [], stairRamps = [];
let activeWall='wall';

function walkableHeight(x,z,y){
  let height=terrainHeight(x,z);
  for(const f of floorSurfaces){
    if(x>=f.x0 && x<=f.x1 && z>=f.z0 && z<=f.z1 && y>=f.y-.45) height=Math.max(height,f.y);
  }
  for(const r of stairRamps){
    if(x<r.x0 || x>r.x1 || z<r.z0 || z>r.z1) continue;
    const h=r.y0+(z-r.z0)/(r.z1-r.z0)*(r.y1-r.y0);
    if(y>=h-.55 && y<=h+1.5) height=Math.max(height,h);
  }
  return height;
}
""")
replace("    const name = (Math.random()<0.5)?'wall':'wall2';", '    const name = activeWall;')
replace("function pushGeo(name, geo){ (geosByName[name] ||= []).push(geo); }", """const renderChunks=[];
function pushGeo(name,geo){
  geo.computeBoundingBox();
  const center=geo.boundingBox.getCenter(new THREE.Vector3());
  const key=name+'|'+Math.floor(center.x/80)+'|'+Math.floor(center.z/80);
  (geosByName[key] ||= []).push(geo);
}
""")
section('for(const name in geosByName){', '/* ══════ WEAPONS ══════ */', """for(const key in geosByName){
  const name=key.split('|')[0],source=geosByName[key];
  const merged=mergeGeometries(source,false);if(!merged)continue;
  for(const geo of source)geo.dispose();
  merged.computeBoundingSphere();
  const mesh=new THREE.Mesh(merged,MATS[name]);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
  mesh.userData.center=merged.boundingSphere.center;renderChunks.push(mesh);
  if(!['leaf','leaf2','trunk','rock'].includes(name))worldMeshes.push(mesh);
}
""")
section('const MATS = {', 'const geosByName = {};', """const plaster=surfaceTexture('plaster'), tile=surfaceTexture('roof');
const MATS = {
  wall: new THREE.MeshStandardMaterial({color:0xc3bd9f,map:plaster,bumpMap:plaster,bumpScale:.025,roughness:.98}),
  wall2: new THREE.MeshStandardMaterial({color:0x9ca799,map:plaster,roughness:.98}),
  roof: new THREE.MeshStandardMaterial({color:0x986d50,map:tile,bumpMap:tile,bumpScale:.05,roughness:.95}),
  wood: new THREE.MeshStandardMaterial({color:0x756247,map:surfaceTexture('wood'),roughness:.9}),
  metal: new THREE.MeshStandardMaterial({color:0x6b7268,roughness:.6,metalness:.5}),
  crate: new THREE.MeshStandardMaterial({color:0x8d7957,map:surfaceTexture('wood'),roughness:.9}),
  trunk: new THREE.MeshStandardMaterial({color:0x66513d,roughness:1}),
  leaf: new THREE.MeshStandardMaterial({color:0x536947,roughness:1}),
  leaf2: new THREE.MeshStandardMaterial({color:0x697650,roughness:1}),
  rock: new THREE.MeshStandardMaterial({color:0x989782,roughness:1}),
};
""")
section('function makeBuilding(', 'const used = [];', """function makeBuilding(cx,cz,w,d){
  const gy=terrainHeight(cx,cz), H=3.25, t=.28, levels=Math.random()<.55?2:3;
  activeWall=Math.random()<.48?'wall':'wall2';
  const b={x:cx,z:cz,w,d,gy,levels,H}; buildingSpots.push(b);
  addBox('wall2',w+.55,.55,d+.55,cx,gy-.2,cz,false);
  const stairX=cx+w/2-1.6, z0=cz-d/2+1.1, z1=cz+d/2-1.1;
  for(let floor=0;floor<levels;floor++){
    const y=gy+floor*H+.08;
    if(floor===0){
      addBox('wood',w,.14,d,cx,y-.07,cz,false);
      floorSurfaces.push({x0:cx-w/2,x1:cx+w/2,z0:cz-d/2,z1:cz+d/2,y});
    } else {
      const leftEnd=stairX-1.05, leftStart=cx-w/2;
      addBox('wood',leftEnd-leftStart,.16,d,(leftStart+leftEnd)/2,y-.08,cz,false);
      floorSurfaces.push({x0:leftStart,x1:leftEnd,z0:cz-d/2,z1:cz+d/2,y});
      addBox('wood',2.7,.16,1.5,stairX,y-.08,cz+d/2-.75,false);
      floorSurfaces.push({x0:leftEnd,x1:cx+w/2,z0:cz+d/2-1.5,z1:cz+d/2,y});
    }
    for(const alongX of [true,false]) for(const side of [-1,1]){
      const span=alongX?w:d, cells=Math.max(3,Math.floor(span/3.4)), cell=span/cells;
      for(let i=0;i<cells;i++){
        const offset=-span/2+cell*(i+.5), front=alongX&&side===-1;
        const door=floor===0&&alongX&&i===Math.floor(cells/2);
        const opening={type:door?'door':'window',pos:0,width:door?1.7:1.35};
        makeWall(alongX,cell,side*(alongX?d:w)/2,alongX?cx+offset:cx,alongX?cz:cz+offset,y,H,t,opening);
        if(!door){
          const wx=alongX?cx+offset:cx+side*w/2, wz=alongX?cz+side*d/2:cz+offset;
          addBox('wood',alongX?1.57:.12,.1,alongX?.12:1.57,wx,y+1.04,wz,false);
          for(const edge of [-1,1]) addBox('wood',alongX?.075:.13,1.27,alongX?.13:.075,wx+(alongX?edge*.7:0),y+1.66,wz+(!alongX?edge*.7:0),false);
        }
      }
    }
    for(const side of [-1,1]){
      addBox('wall2',w+.35,.12,.32,cx,y+H-.04,cz+side*d/2,false);
      addBox('wall2',.32,.12,d+.35,cx+side*w/2,y+H-.04,cz,false);
    }
    if(floor<levels-1){
      stairRamps.push({x0:stairX-.8,x1:stairX+.8,z0,z1,y0:y,y1:y+H});
      for(let i=0;i<20;i++){
        const step=(z1-z0)/20;
        addBox('wood',1.6,.17,step+.025,stairX,y+(i+1)*H/20-.085,z0+(i+.5)*step,false);
      }
      const rail=new THREE.BoxGeometry(.045,.045,Math.hypot(z1-z0,H));
      rail.rotateX(-Math.atan2(H,z1-z0));rail.translate(stairX-.85,y+H/2+.85,(z0+z1)/2);pushGeo('metal',rail);
      for(let i=0;i<5;i++) addBox('metal',.035,.85,.035,stairX-.85,y+i*H/4+.425,z0+i*(z1-z0)/4,false);
    }
    addBox('crate',.85,.85,.85,cx-w*.22,y+.425,cz+d*.22);
  }
  const roofY=gy+levels*H+.15, rise=1.7, half=d/2+.65, length=Math.hypot(half,rise);
  for(const side of [-1,1]){
    const g=new THREE.BoxGeometry(w+1.2,.18,length);
    g.rotateX(side*Math.atan2(rise,half)); g.translate(cx,roofY+rise/2,cz+side*half/2); pushGeo('roof',g);
  }
  addBox('wall2',.8,2.1,.8,cx+w*.25,roofY+1.2,cz+d*.18,false);
  if(levels===3){
    const by=gy+H+.08;
    addBox('wall2',w*.48,.16,1.5,cx,by-.08,cz-d/2-.65,false);
    addBox('metal',w*.48,.06,.06,cx,by+.9,cz-d/2-1.35,false);
    for(let i=0;i<6;i++) addBox('metal',.04,.88,.04,cx-w*.24+i*w*.48/5,by+.45,cz-d/2-1.35,false);
  }
}
""")
replace('const used = [];', """const used = [];
for(const x of [-55,-25,25,55]) for(const z of [-65,-32,12,48]){
  makeBuilding(x,z,16,18); used.push({x,z,r:16});
}
""")
replace('for(let i=0;i<100;i++){', 'for(let i=0;i<170;i++){')
replace('function spotFree(x,z,r){', 'function spotFree(x,z,r){ if(Math.abs(x)<9 && Math.abs(z)<125)return false;')
replace('w=rand(10,22); d=rand(10,22);', 'w=rand(12,19); d=rand(12,19);')
replace("const fg=new THREE.ConeGeometry(rand(1.6,2.8), hh*0.85, 7); fg.translate(x, gy+hh*0.55+hh*0.42, z);", "const fg=new THREE.IcosahedronGeometry(rand(2.3,3.7),1); fg.scale(1,1.3,1); fg.translate(x,gy+hh*.85,z);")
replace('/* ══════ WEAPONS ══════ */', """const roadGeometry=new THREE.PlaneGeometry(13,230,1,45); roadGeometry.rotateX(-Math.PI/2);
for(let i=0;i<roadGeometry.attributes.position.count;i++){
  const p=roadGeometry.attributes.position; p.setY(i,terrainHeight(p.getX(i),p.getZ(i))+.05);
}
roadGeometry.computeVertexNormals();
const roadTexture=surfaceTexture('road'); roadTexture.repeat.set(1,20);
const road=new THREE.Mesh(roadGeometry,new THREE.MeshStandardMaterial({map:roadTexture,roughness:1})); road.receiveShadow=true; scene.add(road);

/* WEAPONS */""")
section('function buildGun(kind){', 'let vmModel = null;', """function buildGun(kind){ return makeWeapon(kind,currentSlot()?.scope,currentSlot()?.id); }
""")
replace('function setViewModel(kind){', "function setViewModel(kind){\n  if(typeof localOperative!=='undefined')setOperativeWeapon(localOperative,currentSlot()?.id,kind,currentSlot()?.scope);")
replace('const player = {', 'const localOperative=makeOperative(0); scene.add(localOperative);\nconst player = {')
section('  const mat = new THREE.MeshLambertMaterial({color:TEAM_COLORS[team]});', "  const id = 'b'+(botIdCounter++);", """  const g = new THREE.Group();
  const operative=makeOperative(team); operative.position.y=-1; g.add(operative);
  const body=new THREE.Mesh(botGeo,new THREE.MeshBasicMaterial({visible:false}));
  const head=new THREE.Mesh(botHeadGeo,new THREE.MeshBasicMaterial({visible:false}));
  head.position.y=.55; const gun=new THREE.Group();
  g.add(body,head,gun); g.userData.operative=operative;
  g.position.set(x,gy+1,z); botMeshes.add(g);
""")
replace("const gy = terrainHeight(x,z)+0.45;", "const gy = (data.y ?? terrainHeight(x,z))+.22;")
replace("mesh = new THREE.Mesh(lootGeoW, new THREE.MeshLambertMaterial({color:0xffb347, emissive:0x442200, emissiveIntensity:0.35}));", """mesh=new THREE.Group();
    const receiver=new THREE.Mesh(new THREE.BoxGeometry(.08,.1,.55),MATS.metal); mesh.add(receiver);
    const stock=new THREE.Mesh(new THREE.BoxGeometry(.09,.13,.2),MATS.wood); stock.position.z=.3;mesh.add(stock);
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.3,8),MATS.metal);barrel.rotation.x=Math.PI/2;barrel.position.z=-.4;mesh.add(barrel);
    const mag=new THREE.Mesh(new THREE.BoxGeometry(.06,.2,.09),MATS.metal);mag.position.set(0,-.12,-.02);mesh.add(mag);
    mesh.rotation.z=Math.PI/2;
""")
replace("  } else if(type==='ammo'){", "  } else if(type==='scope'){\n    mesh=makeOptic(data.id); mesh.scale.setScalar(3);\n  } else if(type==='backpack'){\n    mesh=new THREE.Mesh(new THREE.BoxGeometry(.38,.5,.25),MATS.wood);\n  } else if(type==='ammo'){")
replace("if(i===player.slot) return; if(!player.slots[i].id) return;", "if(!initialized || paused || i===player.slot) return; if(!player.slots[i]?.id) return;")
replace("scopeLatched = false; updateScopeUI(); refreshWeaponUI(); Audio_.reload();", "scopeLatched = false; updateScopeUI(); setViewModel(currentWeapon()?.model); refreshWeaponUI(); Audio_.reload();")
replace('  const now = performance.now();\n  const w = currentWeapon(); const s = currentSlot();', "  if(!initialized || paused || phase!=='ground' || !player.alive) return;\n  const now = performance.now();\n  const w = currentWeapon(); const s = currentSlot();")
replace('  const origin = new THREE.Vector3(); camera.getWorldPosition(origin);\n  const baseDir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);', """  const cameraOrigin=camera.getWorldPosition(new THREE.Vector3());
  const cameraDirection=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  const aimPoint=cameraOrigin.clone().addScaledVector(cameraDirection,castWorldDistance(cameraOrigin,cameraDirection,w.range));
  const origin=player.pos.clone().add(new THREE.Vector3(0,player.crouch?1.05:1.5,0));
  const baseDir=aimPoint.sub(origin).normalize();
  if(net.connected) sendNet({t:'shoot',d:{ox:origin.x,oy:origin.y,oz:origin.z,dx:baseDir.x,dy:baseDir.y,dz:baseDir.z,len:w.range,weapon:s.id}});
""")
replace("  elS1.classList.toggle('on', player.slot===1);", "  elS1.classList.toggle('on', player.slot===1);\n  $('backpack-count').textContent=inventoryState.weapons.length;\n  queueInventorySync();")
replace("if(msg.from !== net.id){\n        Audio_.shot('ar', 0.15);", """const shooter=net.remotePlayers.get(msg.from);
      if(msg.from !== net.id && shooter?.alive && msg.d && phase==='ground' && !paused){
        const sourcePosition=new THREE.Vector3(shooter.x,shooter.y,shooter.z);
        const suppliedOrigin=new THREE.Vector3(msg.d.ox,msg.d.oy,msg.d.oz);
        if(!Number.isFinite(suppliedOrigin.lengthSq()) || suppliedOrigin.distanceTo(sourcePosition)>4) break;
        Audio_.shot(WEAPONS[msg.d.weapon]?.snd || 'ar', .6, sourcePosition);""")
replace("const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints>0;", "const isTouch = matchMedia('(pointer:coarse)').matches && navigator.maxTouchPoints>0;")
replace("bFire:{left:'83%',top:'58%'}", "bFire:{left:'calc(100% - 104px)',top:'58%'}")
replace("  keys[e.code]=true;", """  if(['Tab','KeyB'].includes(e.code)){ e.preventDefault(); if(!e.repeat) openBackpack(); return; }
  if(e.code==='KeyV' && !e.repeat){ togglePerspective(); return; }
  if(e.code==='KeyQ' && !e.repeat){ switchSlot(player.slot===0?1:0); return; }
  if(paused || !initialized) return;
  keys[e.code]=true;""")
replace("  if(!isTouch && !locked && !layoutEditing) canvas.requestPointerLock();", "  Audio_.init(); Audio_.configure();\n  if(!isTouch && !locked && !layoutEditing) canvas.requestPointerLock()?.catch?.(()=>{});")
replace("  if(e.button===0) mouseDown=true;", "  if(e.target!==canvas || paused || !initialized) return;\n  Audio_.init(); Audio_.configure();\n  if(e.button===0){mouseDown=true;player._triggerHeld=true;fireOnce();}")
replace("  if(e.button===0) mouseDown=false;", "  if(e.button===0){mouseDown=false;player._triggerHeld=false;}")
replace("bindBtn('bFire', ()=>{ mouseDown=true; }, ()=>{ mouseDown=false; });", "bindBtn('bFire', ()=>{ Audio_.init();Audio_.configure();mouseDown=true;player._triggerHeld=true;fireOnce(); }, ()=>{mouseDown=false;player._triggerHeld=false;});")
replace('const s = player.ads?0.0011:0.0022;', 'const s = (player.ads?0.0011:0.0022)*(gameSettings.sensitivity/50);')
replace("  if(on){ if(locked) document.exitPointerLock(); mouseDown=false; player.ads=false; scopeLatched=false; updateScopeUI(); }", "  if(on){ if(locked) document.exitPointerLock(); mouseDown=false; player._triggerHeld=false; player.ads=false; scopeLatched=false; for(const key in keys) keys[key]=false; updateScopeUI(); Audio_.suspend(); } else Audio_.configure();")
replace("$('resumeBtn').addEventListener('click', ()=>{ setPaused(false); if(!isTouch && phase==='ground') canvas.requestPointerLock(); });", "$('resumeBtn').addEventListener('click', ()=>{ setPaused(false); if(!isTouch && phase==='ground') canvas.requestPointerLock()?.catch?.(()=>{}); });")
replace("function stopGame(){", "function stopGame(){\n  Audio_.suspend(); mouseDown=false; initialized=false; post('return-lobby',{inventory:exportInventory()});")
replace("player.heals = Math.min(8, player.heals+1);", 'player.heals++;')
section("  if(l.type==='weapon'){\n    const id = l.data.id;", '  l.taken=true;', """  if(l.type==='weapon'){
    const id=l.data.id;
    const item={uid:crypto.randomUUID(),id,mag:WEAPONS[id].mag,scope:null};
    inventoryState.weapons.push(item);
    const empty=player.slots.findIndex(s=>!s.id);
    if(empty>=0){player.slots[empty]=item;player.slot=empty;setViewModel(WEAPONS[id].model);}
    player.ammo[WEAPONS[id].ammo]+=WEAPONS[id].mag;
    showPickupToast('+ '+WEAPONS[id].label+' / BACKPACK','#e8b259');
  } else if(l.type==='scope'){
    inventoryState.scopes.push(l.data.id);
    showPickupToast('+ '+l.data.id.toUpperCase()+' SCOPE / BACKPACK','#bbd4a0');
  } else if(l.type==='ammo'){
    player.ammo[l.data.type]+=l.data.amount;
    showPickupToast('+ '+l.data.amount+' '+l.data.type.toUpperCase()+' AMMO','#b7c6ac');
  } else if(l.type==='backpack'){
    showPickupToast('EXPEDITION BACKPACK / UNLIMITED STORAGE','#e8b259');
  } else {
    player.heals++;
    showPickupToast('+ FIRST AID KIT','#bbd4a0');
  }
  Audio_.pick();
""")
replace("l.mesh.traverse(o=>{ if(o.geometry) o.geometry.dispose(); });", '')
replace("if(l.taken || l.type==='weapon') continue;", "if(l.taken || !['ammo','med'].includes(l.type)) continue;")
replace("if(d<bd && d<9){ bd=d; best=l; }", "if(d<bd && d<9 && Math.abs(player.pos.y-l.baseY)<2){ bd=d; best=l; }")
replace("if(dist2(player.pos.x,player.pos.z,l.x,l.z) < 2.6){ pickupLoot(l); }", "if(dist2(player.pos.x,player.pos.z,l.x,l.z) < 2.6 && Math.abs(player.pos.y-l.baseY)<2){ pickupLoot(l); }")
section('  // MORE loot', '  updateAliveCount();\n}', """  for(const b of buildingSpots){
    for(let floor=0;floor<b.levels;floor++) for(let i=0;i<3;i++){
      const x=b.x+rand(-b.w*.3,b.w*.2),z=b.z+rand(-b.d*.32,b.d*.3),y=b.gy+floor*b.H+.1;
      const roll=Math.random();
      if(roll<.3) spawnLoot(x,z,'weapon',{id:WEAPON_POOL[randi(0,WEAPON_POOL.length-1)],y});
      else if(roll<.53) spawnLoot(x,z,'scope',{id:SCOPE_IDS[randi(0,5)],y});
      else if(roll<.8) spawnLoot(x,z,'ammo',{type:['light','heavy','shell'][randi(0,2)],amount:randi(20,60),y});
      else spawnLoot(x,z,'med',{y});
    }
  }
  for(let i=0;i<240;i++){
    const x=rand(-HALF*.88,HALF*.88),z=rand(-HALF*.88,HALF*.88),roll=Math.random();
    if(roll<.3) spawnLoot(x,z,'weapon',{id:WEAPON_POOL[randi(0,WEAPON_POOL.length-1)]});
    else if(roll<.55) spawnLoot(x,z,'scope',{id:SCOPE_IDS[randi(0,5)]});
    else if(roll<.8) spawnLoot(x,z,'ammo',{type:['light','heavy','shell'][randi(0,2)],amount:40});
    else spawnLoot(x,z,'med',{});
  }
  spawnLoot(1,-2,'weapon',{id:'AWM'});
  spawnLoot(-1,-2,'scope',{id:'8x'});
  spawnLoot(2,-4,'weapon',{id:'SCAR'});
  spawnLoot(-2,-5,'backpack',{});
""")
section('function startGame(){', 'function playerLand(){', """function startGame(){
  $('start').style.display='none';
  player.team=settings.playerTeam; player.hp=100;player.alive=true;
  player.pos.set(0,terrainHeight(0,0)+.1,0);player.vel.set(0,0,0);player.yaw=0;player.pitch=-.1;player.onGround=true;
  phase='ground'; initialized=true;
  zoneState.waitTime=100;zoneState.shrinkTime=45;
  populateWorld(false);
  refreshTeamBadge();refreshHealthUI();refreshWeaponUI();setViewModel(currentWeapon()?.model);
  showMsg(training?'THE RANGE IS YOURS':'WELCOME TO ERANGEL','WASD MOVE / F PICK UP / B BACKPACK / V PERSPECTIVE',4200);
  updatePerspective();
}
""")
replace("  if(!player.alive || phase!=='ground') return;", "  if(training || !player.alive || phase!=='ground') return;")
replace("const gy = terrainHeight(player.pos.x, player.pos.z);\n  if(player.pos.y <= gy)", "const gy = walkableHeight(player.pos.x, player.pos.z, player.pos.y+.15);\n  if(player.pos.y <= gy)")
replace('resolveXZ(player.pos, player.radius, player.pos.y, player.pos.y+height);', 'resolveXZ(player.pos, player.radius, player.pos.y+.17, player.pos.y+height);')
replace("if(d<nd && d<9){ nd=d; nearLoot=l; }", "if(d<nd && d<9 && Math.abs(player.pos.y-l.baseY)<2){ nd=d; nearLoot=l; }")
replace("if(nearLoot && nearLoot.type==='weapon'){\n    elPrompt.classList.add('on'); elPrompt.textContent = `PICK UP ${WEAPONS[nearLoot.data.id].label}`;", """if(nearLoot){
    const label=nearLoot.type==='weapon'?WEAPONS[nearLoot.data.id].label:nearLoot.type==='scope'?nearLoot.data.id+' SCOPE':nearLoot.type==='backpack'?'EXPEDITION BACKPACK':nearLoot.type==='ammo'?'AMMUNITION':'FIRST AID';
    elPrompt.classList.add('on'); elPrompt.textContent = `[F] PICK UP ${label}`;""")
replace("Audio_.shot('ar', clamp(1-targetD/90, 0.05, 0.5));", "Audio_.shot('ar', .65, b.pos);")
replace("    b.obj.position.set(b.pos.x, gy+1.0, b.pos.z);", "    b.obj.position.set(b.pos.x, gy+1.0, b.pos.z);\n    b.obj.userData.operative.userData.walking=b.state!=='engage';")
replace("    b.obj.userData.operative.userData.walking=b.state!=='engage';", "    b.obj.userData.operative.userData.walking=b.state!=='engage';\n    b.obj.visible=dist2(player.pos.x,player.pos.z,b.pos.x,b.pos.z)<220*220;\n    b.obj.userData.operative.visible=b.obj.visible;")
replace("  if(phase!=='ground') return;\n  const z = zoneState;", "  if(training || phase!=='ground') return;\n  const z = zoneState;")
replace('l.mesh.rotation.y += dt*1.4;', "if(l.type==='scope') l.mesh.rotation.y += dt*.2;")
replace("    if(l.type==='scope') l.mesh.rotation.y += dt*.2;", "    l.mesh.visible=dist2(player.pos.x,player.pos.z,l.x,l.z)<50*50;\n    if(!l.mesh.visible) continue;\n    if(l.type==='scope') l.mesh.rotation.y += dt*.2;")
replace("mesh.traverse(o=>{ if(o.isMesh) o.castShadow = true; });", "mesh.traverse(o=>{ if(o.isMesh) o.castShadow = false; });")
replace('Math.sin(t*2 + l.x)*0.08', 'Math.sin(t*2 + l.x)*0.025')
section('function updateCamera(dt){', 'function updateTracers(dt){', """function updateCamera(dt){
  for(const chunk of renderChunks) chunk.visible=dist2(chunk.userData.center.x,chunk.userData.center.z,player.pos.x,player.pos.z)<240*240;
  const eyeH=player.crouch?1.12:player.eye;
  const pivot=player.pos.clone().add(new THREE.Vector3(0,eyeH,0));
  camera.rotation.set(clamp(player.pitch+player.recPitch,-1.5,1.5),player.yaw+player.recYaw,0,'YXZ');
  const third=gameSettings.perspective==='TPP'&&!player.ads&&phase==='ground';
  if(third){
    const offset=new THREE.Vector3(.65,.3,3.65).applyEuler(camera.rotation);
    const distance=castWorldDistance(pivot,offset.clone().normalize(),offset.length());
    const desired=pivot.clone().addScaledVector(offset.clone().normalize(),Math.max(.35,distance-.22));
    camera.position.lerp(desired,1-Math.exp(-dt*14));
  }else camera.position.copy(pivot);
  localOperative.visible=third;
  localOperative.position.copy(player.pos);localOperative.rotation.y=player.yaw;
  localOperative.userData.walking=Math.hypot(player.vel.x,player.vel.z)>.5;
  localOperative.userData.sprinting=player.sprint;localOperative.userData.crouching=player.crouch;
  const w=currentWeapon(), optic=currentSlot()?.scope, zoom=SCOPE_ZOOM[optic]||1;
  const scoped=!!(player.ads&&w&&optic&&phase==='ground');
  const magnified=scoped&&zoom>1;
  const desiredFov=player.ads&&w?(optic?2*Math.atan(Math.tan(75*Math.PI/360)/(zoom>1?zoom:1.35))*180/Math.PI:58):75;
  camera.fov=lerp(camera.fov,desiredFov,clamp(dt*13,0,1));camera.updateProjectionMatrix();
  elScope.classList.toggle('on',scoped);
  elScope.classList.toggle('magnified',magnified);
  elScope.classList.toggle('red-dot',scoped&&optic==='Red Dot');
  elScope.classList.toggle('holographic',scoped&&optic==='Holographic');
  $('optic-label').textContent=optic?optic.toUpperCase()+' / 100 M':'';
  elCross.style.opacity=scoped?'0':'.8';
  vmRoot.visible=!!vmModel&&!third&&!scoped;
  if(vmModel){
    vmKick=Math.max(0,vmKick-dt*7);
    const bob=Math.min(Math.hypot(player.vel.x,player.vel.z),8)*.003;
    vmRoot.position.set(Math.sin(performance.now()*.008)*bob,Math.abs(Math.cos(performance.now()*.008))*bob,0);
    vmModel.position.z=-.42+vmKick*.08;vmModel.rotation.x=vmKick*.16;
  }
  animateOperatives(dt);
  muzzle.intensity=Math.max(0,muzzle.intensity-dt*30);
  sun.position.set(player.pos.x+60,player.pos.y+110,player.pos.z+40);
  sun.target.position.copy(player.pos);sun.target.updateMatrixWorld();
}
""")
replace('  if(paused){ renderer.render(scene, camera); return; }', '  if(!initialized) return;\n  if(paused || document.hidden){ renderer.render(scene,camera); return; }')
replace('loop();\n', 'loop();\n')
engine += """

function exportInventory(){
  const weapons=new Map(inventoryState.weapons.map(item=>[item.uid,{...item}]));
  for(const item of player.slots) if(item.id&&item.uid) weapons.set(item.uid,{...item});
  return {...inventoryState,weapons:[...weapons.values()],main:player.slots.map(item=>item.uid||null),active:player.slot,ammo:{...player.ammo},heals:player.heals};
}

function importInventory(value){
  if(!value?.weapons || !value?.main) return;
  inventoryState=structuredClone(value);
  player.slots=value.main.map(uid=>inventoryState.weapons.find(item=>item.uid===uid)||{id:null,mag:0,uid:null,scope:null});
  player.slot=value.active===1?1:0;player.ammo={...value.ammo};player.heals=value.heals;
  player.reloading=false;player.ads=false;scopeLatched=false;
  setViewModel(currentWeapon()?.model);refreshWeaponUI();refreshHealthUI();
}

function queueInventorySync(){
  if(!initialized || syncTimer) return;
  syncTimer=setTimeout(()=>{syncTimer=null;post('inventory-sync',{inventory:exportInventory()});},100);
}

function openBackpack(){
  if(!initialized) return;
  setPaused(true);pauseScreen.classList.remove('on');
  post('inventory-open',{inventory:exportInventory()});
}

function updatePerspective(){ $('btnPerspective').textContent=gameSettings.perspective; }
function togglePerspective(){gameSettings.perspective=gameSettings.perspective==='TPP'?'FPP':'TPP';updatePerspective();post('settings-sync',{settings:gameSettings});}

$('btnBackpack').addEventListener('click',openBackpack);
$('btnPerspective').addEventListener('click',togglePerspective);
$('btnSwapDesktop').addEventListener('click',()=>switchSlot(player.slot===0?1:0));
$('btnSettings').addEventListener('click',()=>{setPaused(true);pauseScreen.classList.remove('on');post('settings-open');});
elS0.addEventListener('click',()=>switchSlot(0));elS1.addEventListener('click',()=>switchSlot(1));
addEventListener('blur',()=>{for(const key in keys)keys[key]=false;mouseDown=false;player.ads=false;});
document.addEventListener('visibilitychange',()=>{if(document.hidden){mouseDown=false;player.ads=false;Audio_.suspend();}else Audio_.configure();});
addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==parent||event.data?.source!=='erangel-lobby')return;
  const data=event.data;
  if(data.type==='initialize'&&!initialized){
    gameSettings={...DEFAULT_SETTINGS,...data.settings};training=data.dropzone==='TRAINING GROUNDS';
    settings.blueBots=training?0:data.mode==='SQUAD'?3:0;settings.redBots=training?0:data.mode==='SQUAD'?16:18;settings.playerTeam=0;
    net.name=data.name||'GHOST_01';renderer.shadowMap.enabled=gameSettings.shadows;
    importInventory(data.inventory||DEFAULT_INVENTORY);startGame();
    camera.position.copy(player.pos).add(new THREE.Vector3(0,2.1,3.5));
    if(training){zoneState.r=10000;$('zone').style.display='none';}
  }
  if(data.type==='inventory')importInventory(data.inventory);
  if(data.type==='settings'){
    gameSettings={...gameSettings,...data.settings};renderer.shadowMap.enabled=gameSettings.shadows;Audio_.configure();updatePerspective();
  }
  if(data.type==='pause'){setPaused(true);pauseScreen.classList.remove('on');}
  if(data.type==='resume'){setPaused(false);window.focus();}
  if(data.type==='stop'){Audio_.suspend();paused=true;initialized=false;}
});

window.erangel={getState:()=>({initialized,phase,paused,perspective:gameSettings.perspective,inventory:exportInventory(),position:player.pos.toArray(),buildings:buildingSpots.length,levels:buildingSpots.map(b=>b.levels),actorLoaded:!!localOperative.userData.model,actorSize:new THREE.Box3().setFromObject(localOperative).getSize(new THREE.Vector3()).toArray(),render:renderer.info.render,loot:lootItems.filter(l=>!l.taken).map(l=>({type:l.type,id:l.data.id,x:l.x,z:l.z,y:l.baseY})),shots:player.nextFire}),pickup:tryPickup,switchWeapon:()=>switchSlot(player.slot===0?1:0),heightAt:walkableHeight,optics:()=>({scope:currentSlot()?.scope,fov:camera.fov,ads:player.ads}),inspectWorld:()=>({buildings:buildingSpots,stairs:stairRamps})};
window.erangel.inspectControls=()=>({keys:{...keys},yaw:player.yaw,pitch:player.pitch,velocity:player.vel.toArray(),input:getMoveVec()});
soldierReady.then(()=>post('ready'));
"""

# Keep the legacy multiplayer entry points available, with the new React lobby as the default.
shell = shell.replace('<title>DROPZONE — battle royale</title>', '<title>Erangel Strike | Battleground</title>')
shell = shell.replace('</head>', '<link rel="stylesheet" href="/game/hud.css"></head>')
shell = shell.replace('<div id="vig"></div><div id="scope"></div>', '<div id="vig"></div><div id="scope"><div class="optic-ring"><div class="reticle-h"></div><div class="reticle-v"></div><div class="reticle-dot"></div><div class="reticle-marks"></div></div><span id="optic-label"></span></div>')
shell = shell.replace('<div id="hudTopLeft">', '<div id="hudTopLeft"><button class="utilBtn" id="btnPerspective" title="Change perspective (V)">TPP</button><button class="utilBtn" id="btnBackpack" title="Open backpack (B)">BAG <span id="backpack-count">4</span></button><button class="utilBtn" id="btnSwapDesktop" title="Switch main weapon (Q)">SWAP</button><button class="utilBtn" id="btnSettings" title="Settings">SET</button>')
shell = shell.replace('<h2>PAUSED</h2>', '<h2>STAND BY.</h2>')
shell = shell.replace('END MATCH', 'RETURN TO LOBBY')
shell = shell.replace('tap pause again to resume', 'YOUR NEXT MOVE IS UP TO YOU')
shell += '''<div id="desktopHints"><span><b>W A S D</b> MOVE</span><span><b>F</b> PICK UP</span><span><b>R</b> RELOAD</span><span><b>RMB</b> AIM</span><span><b>V</b> PERSPECTIVE</span><span><b>B</b> BACKPACK</span></div>
<script>window.addEventListener('error',event=>{parent.postMessage({source:'erangel-game',type:'error',message:event.message.includes('WebGL')?'WebGL is unavailable. Enable hardware acceleration and try again.':'The battleground could not initialize. Please reload and try again.'},location.origin);});</script>
<script type="module" src="/game/engine.js"></script></body></html>'''
(root / 'src/game/engine.js').write_text(engine)
(root / 'src/game/shell.html').write_text(shell)
print(f'Prepared enhanced game: {len(engine.splitlines())} source lines.')