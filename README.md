# you-shall-make-it

A tiny Minecraft-like voxel sandbox built with Vite and Three.js.

## Features

- First-person movement with gravity, jumping, and block collision
- Chunked voxel world with simple seeded terrain generation
- Visible-face mesh generation for chunk rendering
- Break and place blocks with a five-slot hotbar
- Local save/load for edited blocks, selected block, and player position

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL in your browser.

## Controls

- Click to lock the cursor
- `WASD` to move
- `Space` to jump
- Left click to break a block
- Right click to place the selected block
- `1-5` to switch hotbar slots
- `R` to reset the local save
- `Esc` to release the cursor

## Build

```bash
npm run build
```
