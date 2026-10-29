import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

let soldierAsset;
const waitingActors = new Set();
const animatedActors = new Set();

export const soldierReady = new Promise(resolve => {
  new GLTFLoader().load('/images/soldier.glb', asset => {
    soldierAsset = asset;
    for (const actor of waitingActors) installModel(actor);
    waitingActors.clear();
    resolve(true);
  }, undefined, error => { console.warn('Using fallback operative:', error); resolve(false); });
});

export function surfaceTexture(type) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const palettes = { plaster: ['#c2bca8', '#9c9784'], brick: ['#976b50', '#6c4e3b'], roof: ['#86513b', '#66432f'], ground: ['#7c8055', '#555c3b'], wood: ['#66513a', '#453b2b'], road: ['#60605a', '#494d44'] };
  const [base, dark] = palettes[type] || palettes.plaster;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 10000; i++) {
    ctx.fillStyle = Math.random() > .5 ? '#ffffff0b' : '#00000014';
    const s = Math.random() * 3 + 1;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, s, s);
  }
  ctx.strokeStyle = dark;
  ctx.globalAlpha = .5;
  if (type === 'roof' || type === 'brick') {
    for (let y = 0; y < 256; y += 24) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
      for (let x = (y % 48 ? -25 : 0); x < 256; x += 50) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 24); ctx.stroke(); }
    }
  } else if (type === 'wood') {
    for (let y = 0; y < 256; y += 5) { ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(70, y + 7, 170, y - 7, 256, y); ctx.stroke(); }
  } else if (type === 'plaster') {
    for (let i = 0; i < 35; i++) { const x = Math.random() * 256, y = Math.random() * 256; ctx.fillStyle = '#6a705416'; ctx.fillRect(x, y, Math.random() * 35, Math.random() * 40); }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(type === 'ground' ? 110 : 1, type === 'ground' ? 110 : 1);
  texture.anisotropy = 4;
  return texture;
}

const metal = new THREE.MeshStandardMaterial({ color: 0x333a38, metalness: .78, roughness: .38 });
const black = new THREE.MeshStandardMaterial({ color: 0x171d1b, roughness: .74, metalness: .22 });
const tan = new THREE.MeshStandardMaterial({ color: 0x8c8060, roughness: .61, metalness: .32 });
const walnut = new THREE.MeshStandardMaterial({ color: 0x76513b, roughness: .63, map: surfaceTexture('wood') });
const glass = new THREE.MeshStandardMaterial({ color: 0x315f68, roughness: .1, metalness: .65 });

function box(parent, dimensions, position, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, radius, length, position, material) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 16), material);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(...position);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

export function makeOptic(scope) {
  const optic = new THREE.Group();
  if (!scope) return optic;
  box(optic, [.055, .025, .16], [0, 0, 0], black);
  if (scope === 'Red Dot' || scope === 'Holographic') {
    box(optic, [.07, .07, .045], [0, .045, -.01], metal);
    box(optic, [.05, .045, .048], [0, .045, -.012], glass);
  } else {
    cylinder(optic, .029, .25, [0, .045, -.04], black);
    cylinder(optic, .045, .07, [0, .045, -.16], metal);
    cylinder(optic, .038, .045, [0, .045, .1], black);
    cylinder(optic, .037, .003, [0, .045, -.197], glass);
    box(optic, [.04, .04, .04], [0, .085, -.02], black);
    box(optic, [.035, .035, .04], [.035, .05, -.02], black);
  }
  return optic;
}

export function makeWeapon(kind, scope = null, id = '') {
  const gun = new THREE.Group();
  const sniper = kind === 'sniper', pistol = kind === 'pistol', shotgun = kind === 'shotgun';
  const wood = id === 'AKM' || id === 'KAR98K' || shotgun;
  const finish = wood ? walnut : (id === 'M416' || id === 'SCAR' ? tan : metal);
  if (pistol) {
    box(gun, [.055, .08, .23], [0, 0, -.12], metal);
    const grip = box(gun, [.052, .13, .07], [0, -.09, -.04], black); grip.rotation.x = -.2;
    cylinder(gun, .018, .25, [0, .015, -.13], black);
    box(gun, [.014, .015, .02], [0, .05, -.21], metal);
  } else {
    box(gun, [.065, .095, .28], [0, 0, -.16], finish);
    box(gun, [.06, .075, sniper ? .3 : .25], [0, 0, -.4], finish);
    cylinder(gun, .014, sniper ? .42 : .24, [0, .02, sniper ? -.7 : -.6], metal);
    cylinder(gun, .021, .07, [0, .02, sniper ? -.91 : -.74], black);
    box(gun, [.06, .1, .19], [0, -.005, .07], wood ? walnut : black);
    box(gun, [.07, .14, .026], [0, -.015, .17], black);
    const grip = box(gun, [.05, .13, .065], [0, -.1, -.055], black); grip.rotation.x = -.22;
    const mag = box(gun, [.048, sniper ? .085 : .19, .08], [0, sniper ? -.085 : -.125, -.2], black); mag.rotation.x = -.12;
    const trigger = new THREE.Mesh(new THREE.TorusGeometry(.035, .006, 4, 12), metal); trigger.rotation.y = Math.PI / 2; trigger.position.set(0, -.07, -.105); gun.add(trigger);
    box(gun, [.045, .015, .48], [0, .057, -.27], black);
    for (let z = -.05; z > -.51; z -= .023) box(gun, [.065, .009, .009], [0, .071, z], metal);
    for (let z = -.31; z > -.5; z -= .034) for (const side of [-1, 1]) box(gun, [.005, .013, .023], [side * .033, 0, z], black);
    cylinder(gun, .009, .045, [.04, .025, -.1], metal);
    box(gun, [.015, .035, .02], [0, .08, -.53], black);
    if (shotgun) cylinder(gun, .018, .5, [.019, .035, -.48], metal);
  }
  if (scope) { const optic = makeOptic(scope); optic.position.set(0, .085, -.16); gun.add(optic); }
  gun.userData.kind = kind;
  return gun;
}

function installModel(actor) {
  if (!soldierAsset) return;
  const model = clone(soldierAsset.scene);
  model.updateMatrixWorld(true);
  model.traverse(object => { if (object.isSkinnedMesh) object.skeleton.update(); });
  const bounds = new THREE.Box3().setFromObject(model);
  const scale = 1.82 / (bounds.max.y - bounds.min.y);
  // Keep the asset's original unit conversion when normalizing its height.
  model.scale.multiplyScalar(scale);
  model.position.y = -bounds.min.y * scale;
  model.rotation.y = 0;
  model.traverse(object => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      object.material = object.material.clone();
      object.material.roughness = .9;
      object.material.metalness = .08;
      object.material.color?.multiply(new THREE.Color(0xb3b7a0));
    }
  });
  actor.userData.fallback.visible = false;
  actor.add(model);
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const animation of soldierAsset.animations) actions[animation.name.toLowerCase()] = mixer.clipAction(animation);
  const idle = actions.idle || Object.values(actions)[0];
  idle?.play();
  Object.assign(actor.userData, { mixer, actions, current: idle, model });
  animatedActors.add(actor);
}

export function makeOperative(team = 0) {
  const actor = new THREE.Group();
  const fallback = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: team === 0 ? 0x555e46 : 0x65584b, roughness: .95 });
  const vest = new THREE.MeshStandardMaterial({ color: 0x424a36, roughness: .98 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb39778, roughness: .95 });
  box(fallback, [.46, .53, .25], [0, 1.2, 0], cloth);
  box(fallback, [.42, .43, .08], [0, 1.24, -.15], vest);
  for (const side of [-1, 1]) {
    box(fallback, [.18, .4, .19], [side * .13, .64, 0], cloth);
    box(fallback, [.15, .38, .16], [side * .13, .24, .01], cloth);
    box(fallback, [.18, .13, .29], [side * .13, .065, -.055], black);
    const arm = box(fallback, [.15, .4, .15], [side * .3, 1.16, -.055], cloth); arm.rotation.x = -.55;
    box(fallback, [.14, .12, .15], [side * .3, .98, -.17], black);
    box(fallback, [.12, .16, .075], [side * .1, 1.15, -.215], vest);
    box(fallback, [.15, .15, .07], [side * .13, .48, -.1], black);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(.16, 16, 14), skin); head.position.y = 1.65; fallback.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(.18, 18, 12, 0, Math.PI * 2, 0, Math.PI * .65), vest); helmet.position.set(0, 1.7, 0); fallback.add(helmet);
  box(fallback, [.26, .11, .07], [0, 1.58, -.13], black);
  actor.add(fallback);
  const pack = new THREE.Group();
  const bag = new THREE.Mesh(new THREE.CapsuleGeometry(.19, .2, 5, 10), vest);
  bag.scale.set(1, 1, .66); bag.position.set(0, 1.2, .22); bag.castShadow = true; pack.add(bag);
  box(pack, [.27, .22, .08], [0, 1.12, .365], cloth);
  for (const side of [-1, 1]) box(pack, [.045, .44, .025], [side * .11, 1.21, .34], black);
  for (let y = 1.05; y < 1.4; y += .08) box(pack, [.3, .014, .02], [0, y, .392], vest);
  actor.add(pack);
  actor.userData.fallback = fallback;
  actor.userData.pack = pack;
  actor.userData.walking = false;
  setOperativeWeapon(actor, 'M416', 'rifle', 'Red Dot');
  if (soldierAsset) installModel(actor); else waitingActors.add(actor);
  return actor;
}

export function setOperativeWeapon(actor, id, kind, scope) {
  const previous = actor.userData.weapon;
  if (previous) { actor.remove(previous); previous.traverse(object => object.geometry?.dispose()); }
  if (!id) { actor.userData.weapon = null; return; }
  const weapon = makeWeapon(kind, scope, id);
  weapon.position.set(.28, 1.05, -.13);
  weapon.rotation.set(-.42, 0, -.08);
  actor.add(weapon);
  actor.userData.weapon = weapon;
}

export function animateOperatives(dt) {
  for (const actor of animatedActors) {
    if (!actor.parent || !actor.visible) continue;
    const data = actor.userData;
    const wanted = data.walking ? (data.sprinting ? data.actions.run : data.actions.walk) : data.actions.idle;
    if (wanted && wanted !== data.current) { data.current?.fadeOut(.2); wanted.reset().fadeIn(.2).play(); data.current = wanted; }
    data.mixer.update(dt);
    actor.scale.y = data.crouching ? .73 : 1;
  }
}