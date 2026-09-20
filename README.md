# you-shall-make-it

A tiny Minecraft-like voxel sandbox built with Vite and Three.js.

## Features

- Start menu with dedicated Single Player and Multiplayer buttons
- First-person movement with gravity, jumping, and block collision
- Chunked voxel world with simple seeded terrain generation
- Visible-face mesh generation for chunk rendering
- Break and place blocks with a five-slot hotbar
- Single-player save/load for world edits and player position
- Local multiplayer rooms that sync players, resets, and block edits across browser tabs in the same browser profile

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL in your browser.

## Game modes

- **Single Player**: your solo world and position save locally in this browser.
- **Multiplayer**: enter the same room name in multiple tabs in the same browser profile to share a world and see other players.

## Controls

- Choose a mode from the start menu
- Click to lock the cursor
- `WASD` to move
- `Space` to jump
- Left click to break a block
- Right click to place the selected block
- `1-5` to switch hotbar slots
- `R` to reset the current world
- `Esc` to release the cursor

## Build

```bash
npm run build
```
