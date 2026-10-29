# Erangel Strike

A playable React and Three.js tactical browser game, adapted from the game at https://github.com/biohopi/erangel-strike.

## Run

1. `npm install`
2. `npm run dev`
3. Open the local Vite address and select **Deploy**.

The default lobby runs local matches against AI. Training Grounds has no opponents or closing zone. No account or external game service is required.

## Requested Changes

- First- and third-person cameras, with an over-the-shoulder offset and camera collision protection.
- Removed the original unconditional random gunshot in the rendering loop. Bot and remote-player shots must originate from active in-match shooters, with distance attenuation and stereo positioning. Pausing, leaving the match, or hiding the browser silences combat audio.
- Six separately lootable optics: Red Dot, Holographic, 2x, 4x, 6x, and 8x. Attachments have distinct reticles and real camera magnification and can be attached to every weapon.
- An unlimited backpack preserves every collected weapon, including duplicates. Assign any two weapons to the main slots; replacing a main weapon safely stores the previous one. Quick-switch still cycles only those two main slots.
- Animated, textured soldier models, a visible backpack, more detailed weapon meshes, and physical scope attachments.
- 186 buildings with two or three floors, door and window openings, interior stair ramps, floor collision, balconies, pitched roofs, and loot on upper floors.
- Responsive lobby, loadout editor, searchable armory, field guide, callsign editor, and persistent audio/control/graphics settings.

## Controls

| Action                          | Input                        |
| ------------------------------- | ---------------------------- |
| Move / look                     | WASD / mouse                 |
| Sprint / jump / crouch          | Shift / Space / C            |
| Shoot / aim / reload            | Left mouse / right mouse / R |
| Pick up loot                    | F                            |
| Backpack                        | B or Tab                     |
| Select main slot / quick-switch | 1 or 2 / Q                   |
| First- or third-person camera   | V                            |
| Use first aid                   | H                            |
| Release mouse capture           | Escape                       |

Touch controls appear on devices with a coarse pointer.

## Development

- `src/App.tsx`: lobby, match lifecycle, settings, and game messaging.
- `src/components/Loadout.tsx`: two main slots, unlimited backpack, and scope assignment.
- `src/game/data.ts`: inventory schema, weapon catalog, and loadout operations.
- `src/game/engine.js`: playable game source.
- `src/game/visuals.js`: soldier animations, weapon meshes, and material textures.
- `public/game/hud.css`: in-match controls and optical reticles.
- `reference/original-game.html`: original upstream game, retained for traceability.

After changing game-engine source, run `node scripts/build-game.mjs` to refresh the standalone game bundle in `public/game/`. The browser application and game are isolated in a same-origin iframe so mouse capture, touch input, and game audio do not interfere with React dialogs.

`scripts/prepare-game.py` documents and reproduces the upstream migration. Running it overwrites `src/game/engine.js` and `src/game/shell.html` from the reference source.

## Verification

- `npx tsc --noEmit`
- `node scripts/build-game.mjs`
- `npm run build`
- With the dev server running: `node scripts/smoke-test.mjs`

The smoke test covers lobby rendering, persistent loadouts, weapon preservation, scope accounting, armory search, audio settings, map selection, real game startup, perspective changes, loot pickup, two-slot switching, backpack pause/resume, stair-ramp heights, mobile overflow, runtime errors, and the removed phantom gunshot.

## Assets

Lobby and weapon catalog artwork were generated for this project. The animated `Soldier.glb` model is the Mixamo model distributed in the Three.js skeletal-animation examples; see https://threejs.org/examples/webgl_animation_skinning_blending.html and Mixamo's applicable asset terms. It is used as an embedded game asset, not offered as a standalone asset download. Barlow and Barlow Condensed are by Jeremy Tribby and distributed under the SIL Open Font License. Three.js is MIT licensed.

The implementation is local to this project. It does not automatically push changes to the upstream GitHub repository.

## Online multiplayer (local and deployed)

The project now runs the web client and its WebSocket room server from the same Node.js service. The host creates a room, shares the six-character room code/invite, and controls Blue/Red player slots and bot counts before starting. Players choose a team and wait in the room roster until the host starts.

### Run locally on Android / Termux or desktop

Use two terminal sessions in the project directory:

1. `npm install`
2. Terminal A: `npm run server` (starts the WebSocket server on port 3000)
3. Terminal B: `npm run dev -- --host 0.0.0.0` (starts Vite; `/ws` is proxied to port 3000)
4. Open the Vite **Local** address on the same device. For friends on your Wi-Fi, use the Vite **Network** address if the network/firewall permits it; both devices must be able to reach the host device's server port 3000 as well, so if the proxy cannot be reached from another device, use the host computer's `http://HOST-LAN-IP:3000` address after running `npm run build`.

### Deploy on Render

The included `render.yaml` configures a Node web service. Render runs `npm ci && npm run build`, then `npm start`; the same HTTPS origin serves the site and secure WebSocket endpoint `/ws` (`wss://your-site.example/ws`). Do not deploy this multiplayer version as a static site because static hosting cannot run the WebSocket room server.

Rooms are ephemeral and live in server memory; restarting/redeploying the service closes active rooms. This is a lightweight relay architecture, not authoritative anti-cheat networking.
