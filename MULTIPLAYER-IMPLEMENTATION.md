# Erangel Strike Enhanced — Online multiplayer

This project keeps offline AI matches and adds room-based online team matches using the original game's WebSocket relay pattern.

## Room flow

1. From the lobby, choose Blue/Red and set Blue and Red bot counts and player-slot counts independently.
2. Choose **Create Room**. The host sees the room code and a roster with player slots and AI bot slots for each team.
3. Share the code or invite link. Friends open the same deployed site (or the host's reachable local Vite network address), enter the code, and choose a team.
4. Only the host can change bot counts/player capacities. Team members can change teams while the room is waiting, if the destination team has an open player slot.
5. The host starts the match. New joins are refused after the match starts so late joiners cannot enter without the host's already-running bot simulation state.

## Run locally with Termux or desktop

Install dependencies once:

```sh
npm install
```

For development, use two terminal sessions in the project folder:

**Terminal A — WebSocket room server**

```sh
npm run server
```

**Terminal B — Vite site**

```sh
npm run dev -- --host 0.0.0.0
```

Open the Vite Local URL on the host device. For a second device on the same Wi-Fi, use the Vite Network URL if Android/desktop firewall and Wi-Fi isolation settings allow the connection. The Vite `/ws` proxy forwards multiplayer connections to port 3000 on the host device.

For a single local server process that serves the production build and WebSocket endpoint from port 3000:

```sh
npm run build
npm start
```

Then open `http://localhost:3000`. A second device can use `http://HOST-LAN-IP:3000` when reachable on the same network.

## Deploy

Use the included `render.yaml` as a Node web service, not static-site hosting. It runs `npm ci && npm run build` and starts `npm start`. The same origin serves the game and `/ws`, so HTTPS deployments use secure WebSockets automatically.

## Networking notes

- Rooms are stored in server memory and are cleared when the service restarts or redeploys.
- The server owns team assignment and validates room capacity. This is a lightweight relay, not a fully authoritative anti-cheat server.
- The host simulates the AI bots and shares bot state with guests; guests send bot-hit requests to the host.
