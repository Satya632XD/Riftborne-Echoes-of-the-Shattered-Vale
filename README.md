# Riftborne: Echoes of the Shattered Vale

A browser-only 3D survival/defense game built with **Three.js via CDN** and **no npm install**.

## What this aims for

This project is designed as a feature-rich solo prototype:
- first-person movement with pointer lock
- procedural terrain
- day/night cycle
- resource harvesting
- build mode with walls and turrets
- enemy waves
- beacon-defense survival loop
- HUD + minimap
- fully modular file structure

Everything runs from static files, so it can be opened from a lightweight local server.

## File structure

```text
riftborne-rift-defender/
├── index.html
├── style.css
├── README.md
└── src/
    ├── config.js
    ├── noise.js
    ├── input.js
    ├── terrain.js
    ├── player.js
    ├── enemies.js
    ├── buildings.js
    ├── projectiles.js
    ├── ui.js
    └── main.js
```

## How to run

Because the project uses ES modules, open it through a local server instead of double-clicking the file.

### Python
```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## Controls

- **WASD** — move
- **Space** — jump
- **Shift** — sprint
- **Mouse** — look around
- **Left click** — shoot
- **E** — harvest essence
- **B** — toggle build mode
- **1 / 2** — select wall or turret

## Gameplay loop

1. Enter the Vale and lock the pointer.
2. Harvest essence from crystal nodes.
3. Build walls and turrets near the Rift Beacon.
4. Survive increasingly aggressive enemy waves.
5. Protect the beacon as long as you can.

## Notes

- There are no external art assets.
- The world is generated procedurally from code.
- The project is intentionally modular so it is easy to expand with crafting, quests, inventory, or multiplayer later.
