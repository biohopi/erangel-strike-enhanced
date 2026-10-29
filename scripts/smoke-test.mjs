import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const base = process.env.APP_URL || 'http://localhost:5173';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let checks = 0;
const check = (condition, description) => { assert(condition, description); checks++; console.log(`PASS ${description}`); };

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'ERANGEL STRIKE', exact: true })).toBeVisible();
  check(true, 'Branded lobby renders');

  await page.getByRole('button', { name: 'LOADOUT', exact: true }).click();
  await page.getByRole('button', { name: 'Equip AKM to slot 1', exact: true }).click();
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('erangel-inventory-v1')));
  check(saved.main[0] === 'starter-akm', 'Backpack weapon equips to the chosen main slot');
  check(saved.weapons.length === 4, 'Equipping preserves every owned weapon');
  await expect(page.getByRole('button', { name: 'Equip M416 to slot 1', exact: true })).toBeVisible();
  check(true, 'Displaced main weapon returns to the backpack');
  await page.getByLabel('Scope for AKM', { exact: true }).selectOption('6x');
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('erangel-inventory-v1')));
  check(saved.weapons.find(item => item.id === 'AKM').scope === '6x', 'An optic can be attached to a non-sniper weapon');
  check(!saved.scopes.includes('6x'), 'Equipped optic is removed from loose backpack inventory');
  await page.getByRole('button', { name: 'SWITCH ACTIVE', exact: true }).click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('erangel-inventory-v1')));
  check(saved.active === 1, 'Quick-switch selects the other main weapon');
  await page.getByRole('button', { name: 'Equip M416 to slot 1', exact: true }).click();
  await page.getByRole('button', { name: 'Close loadout', exact: true }).click();
  await page.waitForTimeout(250);
  await page.reload({ waitUntil: 'networkidle' });
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('erangel-inventory-v1')));
  check(saved.main[0] === 'starter-m416' && saved.active === 1, 'Loadout changes persist across reloads');

  await page.getByRole('button', { name: 'ARMORY', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search weapons', exact: true }).fill('AWM');
  await page.locator('.armory-list button').click();
  await page.getByRole('button', { name: 'ADD TO BACKPACK', exact: true }).click();
  await expect(page.getByRole('button', { name: 'IN YOUR LOADOUT', exact: true })).toBeDisabled();
  check(true, 'Armory search and adding a weapon work');
  await page.getByRole('button', { name: 'Close armory', exact: true }).click();
  await page.waitForTimeout(250);

  await page.getByRole('button', { name: 'Open settings', exact: true }).click();
  await page.getByLabel('Master volume', { exact: true }).evaluate(input => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '42');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.getByLabel('Mute all audio', { exact: true }).check();
  await page.getByLabel('Dynamic shadows').uncheck();
  await page.getByRole('button', { name: 'SAVE & CLOSE', exact: true }).click();
  const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('erangel-settings-v1')));
  check(settings.volume === 42 && settings.muted, 'Audio settings are saved');
  await page.waitForTimeout(250);

  await page.locator('.map-selection').click();
  await page.getByRole('button', { name: /TRAINING GROUNDS/ }).click();
  await page.getByRole('button', { name: 'CONFIRM DROPZONE', exact: true }).click();
  await expect(page.locator('.map-selection strong')).toHaveText('TRAINING GROUNDS');
  check(true, 'Dropzone selection is functional');
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: 'DEPLOY', exact: true }).click();
  await page.locator('.deployment-screen').waitFor({ state: 'detached', timeout: 60000 });
  const game = page.frames().find(frame => frame.url().includes('/game/'));
  await game.waitForFunction(() => window.erangel?.getState().initialized, { timeout: 60000 });
  let state = await game.evaluate(() => window.erangel.getState());
  check(state.phase === 'ground' && state.actorLoaded, 'Playable game starts with the loaded animated soldier');
  check(state.buildings >= 180 && state.levels.every(level => level === 2 || level === 3), 'World contains at least 180 two- and three-story buildings');
  check(state.perspective === 'TPP', 'Third-person perspective is the default');

  async function moveTo(axis, target, positiveKey, negativeKey) {
    const start = (await game.evaluate(() => window.erangel.getState())).position[axis];
    const direction = target > start ? 1 : -1;
    const code = direction === 1 ? positiveKey : negativeKey;
    await game.evaluate(code => dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true })), code);
    try {
      await game.waitForFunction(({ axis, target, direction }) => {
        const value = window.erangel.getState().position[axis];
        return direction === 1 ? value >= target : value <= target;
      }, { axis, target, direction }, { polling: 100, timeout: 60000 });
    } catch (error) {
      console.log('Movement diagnostic', await game.evaluate(() => ({ position: window.erangel.getState().position, controls: window.erangel.inspectControls() })));
      throw error;
    } finally {
      await game.evaluate(code => dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })), code);
      await page.waitForTimeout(250);
    }
  }

  await moveTo(0, 26.7, 'KeyD', 'KeyA');
  await moveTo(2, 5.1, 'KeyS', 'KeyW');
  check((await game.evaluate(() => window.erangel.getState())).position[2] > 3.5, 'Player can physically walk through a building doorway');
  await moveTo(0, 31.1, 'KeyD', 'KeyA');
  await moveTo(2, 19.6, 'KeyS', 'KeyW');
  state = await game.evaluate(() => window.erangel.getState());
  check(state.position[1] > 3, 'Player can physically climb interior stairs onto an upper floor');

  await moveTo(2, 5.1, 'KeyS', 'KeyW');
  await moveTo(0, 26.7, 'KeyD', 'KeyA');
  await moveTo(2, 0, 'KeyS', 'KeyW');
  await moveTo(0, 0, 'KeyD', 'KeyA');
  await game.locator('#btnPerspective').click();
  state = await game.evaluate(() => window.erangel.getState());
  check(state.perspective === 'FPP', 'Perspective button switches to first person');

  const canvas = game.locator('body > canvas');
  await canvas.hover({ position: { x: 720, y: 400 } });
  await page.mouse.down({ button: 'right' });
  await game.waitForFunction(() => window.erangel.optics().ads && window.erangel.optics().fov < 30, undefined, { timeout: 60000 });
  const optic = await game.evaluate(() => window.erangel.optics());
  check(optic.scope === '4x' && optic.ads && optic.fov < 30, 'Aiming through a 4x optic produces real magnification');
  await expect(game.locator('#scope.magnified.on')).toBeVisible();
  check(true, 'Magnified optic displays its circular lens and reticle');
  await page.mouse.up({ button: 'right' });
  const magazineBefore = state.inventory.weapons.find(item => item.uid === state.inventory.main[state.inventory.active]).mag;
  await page.mouse.down({ button: 'left' });
  await page.waitForTimeout(300);
  await page.mouse.up({ button: 'left' });
  await game.evaluate(() => document.exitPointerLock?.());
  state = await game.evaluate(() => window.erangel.getState());
  const magazineAfter = state.inventory.weapons.find(item => item.uid === state.inventory.main[state.inventory.active]).mag;
  check(magazineAfter < magazineBefore, 'Firing consumes ammunition from the active weapon');
  await game.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true })));
  await page.waitForTimeout(1600);
  state = await game.evaluate(() => window.erangel.getState());
  check(state.inventory.weapons.find(item => item.uid === state.inventory.main[state.inventory.active]).mag === magazineBefore, 'Reload restores the active magazine from reserve ammunition');

  const countBefore = state.inventory.weapons.length;
  const mainBefore = [...state.inventory.main];
  await game.locator('#prompt').click();
  await game.evaluate(() => window.erangel.pickup());
  await page.waitForTimeout(250);
  state = await game.evaluate(() => window.erangel.getState());
  check(state.inventory.weapons.length === countBefore + 1, 'Ground weapon is collected into the unlimited backpack');
  check(JSON.stringify(state.inventory.main) === JSON.stringify(mainBefore), 'Picking up a third weapon does not replace either main weapon');
  check(state.inventory.scopes.filter(scope => scope === '8x').length === 2, 'A ground scope can be looted as a separate attachment');

  const activeBefore = state.inventory.active;
  await game.locator('#btnSwapDesktop').click();
  state = await game.evaluate(() => window.erangel.getState());
  check(state.inventory.active !== activeBefore && state.inventory.main.length === 2, 'In-match swap cycles only the two main weapons');
  await game.locator('#btnSwapDesktop').click();
  state = await game.evaluate(() => window.erangel.getState());
  check(state.inventory.active === activeBefore, 'A second swap returns to the previous main weapon');

  await game.locator('#btnBackpack').click();
  await expect(page.getByRole('dialog', { name: 'Your loadout and backpack', exact: true })).toBeVisible();
  check(await game.evaluate(() => window.erangel.getState().paused), 'Opening the backpack pauses combat and clears firing input');
  await page.getByRole('button', { name: 'Close loadout', exact: true }).click();
  await page.waitForTimeout(350);
  check(!(await game.evaluate(() => window.erangel.getState().paused)), 'Closing the backpack resumes gameplay');

  const stairsWork = await game.evaluate(() => {
    const { stairs } = window.erangel.inspectWorld();
    return stairs.length > 180 && stairs.every(ramp => {
      const x = (ramp.x0 + ramp.x1) / 2, z = (ramp.z0 + ramp.z1) / 2;
      const y = (ramp.y0 + ramp.y1) / 2;
      return Math.abs(window.erangel.heightAt(x, z, y + .1) - y) < .1;
    });
  });
  check(stairsWork, 'Interior stair ramps provide walkable heights between floors');
  await page.getByRole('button', { name: 'RETURN TO LOBBY', exact: true }).click();
  await expect(page.getByRole('button', { name: 'DEPLOY', exact: true })).toBeVisible();
  check(true, 'Match can be ended and returns to the lobby');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  check(await page.evaluate(() => document.body.scrollWidth === innerWidth), 'Mobile lobby has no horizontal overflow');
  await page.getByRole('button', { name: 'LOADOUT', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close loadout', exact: true })).toBeVisible();
  check(await page.evaluate(() => document.querySelector('.dialog').scrollWidth <= innerWidth), 'Mobile backpack fits the viewport');
  check(errors.length === 0, `No browser runtime errors (${errors.join(', ')})`);
  const source = await readFile('src/game/engine.js', 'utf8');
  check(!source.includes("Math.random() < dt*0.6) Audio_.shot"), 'Unconditional ambient gunshot has been removed');
  check(source.includes("Audio_.shot('ar', .65, b.pos)") && source.includes('distance>130'), 'Bot gunfire uses real shooter positions with a hearing-distance cutoff');
  console.log(`\n${checks} browser and source checks passed.`);
} finally {
  await browser.close();
}