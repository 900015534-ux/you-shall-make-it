import './style.css'
import * as THREE from 'three'

const app = document.querySelector('#app')
app.innerHTML = `
  <div id="menu-overlay">
    <section class="menu-card">
      <h1>You Shall Make It</h1>
      <p>Choose a mode, then start building in a tiny Minecraft-like sandbox.</p>
      <div class="menu-field">
        <label for="room-name">Multiplayer room name</label>
        <input id="room-name" type="text" value="lobby" maxlength="24" spellcheck="false" />
      </div>
      <div class="menu-actions">
        <button id="single-player-button" class="menu-button primary" type="button">Single Player</button>
        <button id="multiplayer-button" class="menu-button secondary" type="button">Multiplayer</button>
      </div>
      <p class="menu-note">Multiplayer syncs block edits and player positions across tabs in the same browser profile and room.</p>
    </section>
  </div>
  <div id="ui" class="hidden">
    <div id="crosshair"></div>
    <section id="hud">
      <div id="mode-badge">Mode</div>
      <h2>You Shall Make It</h2>
      <p>Build, break, and explore the voxel sandbox.</p>
      <ul>
        <li><kbd>WASD</kbd> move, <kbd>Space</kbd> jump, <kbd>Esc</kbd> release the cursor</li>
        <li><kbd>Left Click</kbd> break, <kbd>Right Click</kbd> place</li>
        <li><kbd>1-5</kbd> switch blocks, <kbd>R</kbd> reset the world</li>
      </ul>
      <p id="network-note"></p>
      <div id="status"></div>
    </section>
    <div id="hotbar"></div>
    <div id="focus-overlay">
      <div id="focus-card">
        <strong>Click to enter the world</strong>
        <p>Lock the cursor to move and build.</p>
      </div>
    </div>
  </div>
`

const SINGLE_PLAYER_KEY = 'ysmi-world-single-player'
const MULTIPLAYER_PREFIX = 'ysmi-world-room-'
const MULTIPLAYER_CHANNEL_PREFIX = 'ysmi-room-'
const MULTIPLAYER_HEARTBEAT_MS = 150
const MULTIPLAYER_STALE_MS = 3000
const WORLD_SEED = 1337
const CHUNK_SIZE = 16
const WORLD_HEIGHT = 32
const WORLD_CHUNKS_X = 4
const WORLD_CHUNKS_Z = 4
const PLAYER_HEIGHT = 1.8
const PLAYER_EYE_HEIGHT = 1.62
const PLAYER_RADIUS = 0.35
const REACH = 6
const GRAVITY = 28
const MOVE_SPEED = 5.4
const JUMP_SPEED = 9.5

const BLOCKS = {
  air: 0,
  grass: 1,
  dirt: 2,
  stone: 3,
  wood: 4,
  sand: 5,
}

const HOTBAR = [
  { id: BLOCKS.grass, label: 'Grass', color: '#63b84e' },
  { id: BLOCKS.dirt, label: 'Dirt', color: '#8b5a2b' },
  { id: BLOCKS.stone, label: 'Stone', color: '#8d94a1' },
  { id: BLOCKS.wood, label: 'Wood', color: '#9c6a3d' },
  { id: BLOCKS.sand, label: 'Sand', color: '#d9c37a' },
]

const FACE_DEFS = [
  { dir: [1, 0, 0], light: 0.8, corners: [[1, 1, 0], [1, 0, 0], [1, 0, 1], [1, 1, 1]] },
  { dir: [-1, 0, 0], light: 0.62, corners: [[0, 1, 1], [0, 0, 1], [0, 0, 0], [0, 1, 0]] },
  { dir: [0, 1, 0], light: 1, corners: [[0, 1, 1], [0, 1, 0], [1, 1, 0], [1, 1, 1]] },
  { dir: [0, -1, 0], light: 0.48, corners: [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0]] },
  { dir: [0, 0, 1], light: 0.72, corners: [[1, 1, 1], [1, 0, 1], [0, 0, 1], [0, 1, 1]] },
  { dir: [0, 0, -1], light: 0.56, corners: [[0, 1, 0], [0, 0, 0], [1, 0, 0], [1, 1, 0]] },
]

const BLOCK_COLORS = {
  [BLOCKS.grass]: new THREE.Color('#63b84e'),
  [BLOCKS.dirt]: new THREE.Color('#8b5a2b'),
  [BLOCKS.stone]: new THREE.Color('#8d94a1'),
  [BLOCKS.wood]: new THREE.Color('#9c6a3d'),
  [BLOCKS.sand]: new THREE.Color('#d9c37a'),
}

const PLAYER_BODY_GEOMETRY = new THREE.BoxGeometry(0.55, 0.85, 0.35)
const PLAYER_HEAD_GEOMETRY = new THREE.BoxGeometry(0.42, 0.42, 0.42)
const PLAYER_NOSE_GEOMETRY = new THREE.BoxGeometry(0.1, 0.1, 0.22)

const menuOverlay = document.querySelector('#menu-overlay')
const singlePlayerButton = document.querySelector('#single-player-button')
const multiplayerButton = document.querySelector('#multiplayer-button')
const roomNameInput = document.querySelector('#room-name')
const ui = document.querySelector('#ui')
const modeBadge = document.querySelector('#mode-badge')
const networkNote = document.querySelector('#network-note')
const statusEl = document.querySelector('#status')
const hotbarEl = document.querySelector('#hotbar')
const focusOverlay = document.querySelector('#focus-overlay')
const focusCard = document.querySelector('#focus-card')

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
app.append(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color('#87ceeb')
scene.fog = new THREE.Fog('#87ceeb', 20, 70)

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200)
const pitchObject = new THREE.Object3D()
pitchObject.add(camera)
const yawObject = new THREE.Object3D()
yawObject.add(pitchObject)
scene.add(yawObject)

scene.add(new THREE.HemisphereLight('#dff4ff', '#526a36', 1.15))
const sun = new THREE.DirectionalLight('#fff4d6', 1.1)
sun.position.set(8, 20, 12)
scene.add(sun)

const skyPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(240, 240),
  new THREE.MeshBasicMaterial({ color: '#b8ecff' }),
)
skyPlane.position.set(0, 90, -110)
scene.add(skyPlane)

const worldGroup = new THREE.Group()
scene.add(worldGroup)

const remotePlayersGroup = new THREE.Group()
scene.add(remotePlayersGroup)

const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01)),
  new THREE.LineBasicMaterial({ color: '#ffffff' }),
)
highlight.visible = false
scene.add(highlight)

const groundShadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.4, 24),
  new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.08 }),
)
groundShadow.rotation.x = -Math.PI / 2
groundShadow.visible = false
scene.add(groundShadow)

const sessionId = getSessionId()
const keys = new Set()
const velocity = new THREE.Vector3()
const movement = new THREE.Vector3()
const inputDirection = new THREE.Vector3()
const raycaster = new THREE.Raycaster()
const reusableColor = new THREE.Color()
const tempYawAxis = new THREE.Vector3(0, 1, 0)
const player = {
  position: new THREE.Vector3(8, 16, 8),
  onGround: false,
}
const clock = new THREE.Clock()
const remotePlayers = new Map()

let activeMode = null
let activeRoom = null
let pointerLocked = false
let selectedSlot = 0
let world = null
let multiplayerSession = null

class VoxelWorld {
  constructor({ storageKey, persistPlayerState }) {
    this.storageKey = storageKey
    this.persistPlayerState = persistPlayerState
    this.chunks = new Map()
    this.meshes = new Map()
    this.dirtyChunks = new Set()
    this.modifiedBlocks = new Map()
    this.loadState()
    this.generate()
    this.rebuildAllMeshes()
  }

  loadState() {
    try {
      const raw = localStorage.getItem(this.storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed?.modifiedBlocks) {
        Object.entries(parsed.modifiedBlocks).forEach(([key, value]) => {
          this.modifiedBlocks.set(key, value)
        })
      }
      if (this.persistPlayerState && parsed?.player) {
        player.position.fromArray(parsed.player.position)
        yawObject.rotation.y = parsed.player.rotation?.y ?? 0
        pitchObject.rotation.x = parsed.player.rotation?.x ?? 0
        selectedSlot = Math.max(0, Math.min(HOTBAR.length - 1, parsed.player.selectedSlot ?? 0))
      }
    } catch {
      localStorage.removeItem(this.storageKey)
    }
  }

  saveState() {
    const payload = {
      modifiedBlocks: Object.fromEntries(this.modifiedBlocks.entries()),
    }

    if (this.persistPlayerState) {
      payload.player = {
        position: player.position.toArray(),
        rotation: { x: pitchObject.rotation.x, y: yawObject.rotation.y },
        selectedSlot,
      }
    }

    localStorage.setItem(this.storageKey, JSON.stringify(payload))
  }

  dispose() {
    for (const mesh of this.meshes.values()) {
      mesh.geometry.dispose()
      mesh.material.dispose()
      worldGroup.remove(mesh)
    }
    this.meshes.clear()
    this.chunks.clear()
    this.dirtyChunks.clear()
  }

  reset({ broadcast = true } = {}) {
    localStorage.removeItem(this.storageKey)
    this.modifiedBlocks.clear()
    this.dispose()
    player.position.set(8, 16, 8)
    player.onGround = false
    velocity.set(0, 0, 0)
    yawObject.rotation.set(0, 0, 0)
    pitchObject.rotation.set(0, 0, 0)
    if (!this.persistPlayerState) selectedSlot = 0
    this.generate()
    this.rebuildAllMeshes()
    this.saveState()
    buildHotbar()
    updateModeUi()
    if (broadcast && multiplayerSession) multiplayerSession.broadcastReset()
  }

  generate() {
    for (let chunkX = 0; chunkX < WORLD_CHUNKS_X; chunkX += 1) {
      for (let chunkZ = 0; chunkZ < WORLD_CHUNKS_Z; chunkZ += 1) {
        const key = this.chunkKey(chunkX, chunkZ)
        const data = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE)
        for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
          for (let localZ = 0; localZ < CHUNK_SIZE; localZ += 1) {
            const worldX = chunkX * CHUNK_SIZE + localX
            const worldZ = chunkZ * CHUNK_SIZE + localZ
            const height = this.getTerrainHeight(worldX, worldZ)
            const isBeach = height <= 8
            for (let y = 0; y <= height; y += 1) {
              let block = BLOCKS.stone
              if (y === height) block = isBeach ? BLOCKS.sand : BLOCKS.grass
              else if (y >= height - 2) block = isBeach ? BLOCKS.sand : BLOCKS.dirt
              data[this.index(localX, y, localZ)] = block
            }
          }
        }
        this.chunks.set(key, data)
      }
    }

    for (const [key, value] of this.modifiedBlocks.entries()) {
      const [x, y, z] = key.split(',').map(Number)
      if (this.inBounds(x, y, z)) {
        this.setBlock(x, y, z, value, { persist: false, broadcast: false })
      }
    }
  }

  getTerrainHeight(x, z) {
    const ridge = Math.sin((x + WORLD_SEED) * 0.17) * 1.8 + Math.cos((z - WORLD_SEED) * 0.15) * 1.4
    const bump = Math.sin((x + z + WORLD_SEED) * 0.08) * 1.6
    return Math.max(4, Math.min(14, Math.floor(9 + ridge + bump)))
  }

  chunkKey(chunkX, chunkZ) {
    return `${chunkX},${chunkZ}`
  }

  worldKey(x, y, z) {
    return `${x},${y},${z}`
  }

  index(x, y, z) {
    return x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE
  }

  inBounds(x, y, z) {
    return x >= 0 && z >= 0 && y >= 0 && x < WORLD_CHUNKS_X * CHUNK_SIZE && z < WORLD_CHUNKS_Z * CHUNK_SIZE && y < WORLD_HEIGHT
  }

  getChunk(x, z) {
    const chunkX = Math.floor(x / CHUNK_SIZE)
    const chunkZ = Math.floor(z / CHUNK_SIZE)
    return this.chunks.get(this.chunkKey(chunkX, chunkZ))
  }

  getBlock(x, y, z) {
    if (!this.inBounds(x, y, z)) return BLOCKS.air
    const chunk = this.getChunk(x, z)
    if (!chunk) return BLOCKS.air
    const localX = THREE.MathUtils.euclideanModulo(x, CHUNK_SIZE)
    const localZ = THREE.MathUtils.euclideanModulo(z, CHUNK_SIZE)
    return chunk[this.index(localX, y, localZ)]
  }

  setBlock(x, y, z, block, { persist = true, broadcast = true } = {}) {
    if (!this.inBounds(x, y, z)) return false
    const chunk = this.getChunk(x, z)
    if (!chunk) return false
    const localX = THREE.MathUtils.euclideanModulo(x, CHUNK_SIZE)
    const localZ = THREE.MathUtils.euclideanModulo(z, CHUNK_SIZE)
    chunk[this.index(localX, y, localZ)] = block
    const chunkX = Math.floor(x / CHUNK_SIZE)
    const chunkZ = Math.floor(z / CHUNK_SIZE)
    this.markChunkDirty(chunkX, chunkZ)
    if (localX === 0) this.markChunkDirty(chunkX - 1, chunkZ)
    if (localX === CHUNK_SIZE - 1) this.markChunkDirty(chunkX + 1, chunkZ)
    if (localZ === 0) this.markChunkDirty(chunkX, chunkZ - 1)
    if (localZ === CHUNK_SIZE - 1) this.markChunkDirty(chunkX, chunkZ + 1)
    if (persist) {
      this.modifiedBlocks.set(this.worldKey(x, y, z), block)
      this.saveState()
      if (broadcast && multiplayerSession) {
        multiplayerSession.broadcastBlockChange(x, y, z, block)
      }
    }
    return true
  }

  markChunkDirty(chunkX, chunkZ) {
    if (chunkX < 0 || chunkZ < 0 || chunkX >= WORLD_CHUNKS_X || chunkZ >= WORLD_CHUNKS_Z) return
    this.dirtyChunks.add(this.chunkKey(chunkX, chunkZ))
  }

  rebuildAllMeshes() {
    for (let chunkX = 0; chunkX < WORLD_CHUNKS_X; chunkX += 1) {
      for (let chunkZ = 0; chunkZ < WORLD_CHUNKS_Z; chunkZ += 1) {
        this.buildChunkMesh(chunkX, chunkZ)
      }
    }
    this.dirtyChunks.clear()
  }

  rebuildDirtyMeshes() {
    for (const key of this.dirtyChunks) {
      const [chunkX, chunkZ] = key.split(',').map(Number)
      this.buildChunkMesh(chunkX, chunkZ)
    }
    this.dirtyChunks.clear()
  }

  buildChunkMesh(chunkX, chunkZ) {
    const key = this.chunkKey(chunkX, chunkZ)
    const chunk = this.chunks.get(key)
    if (!chunk) return

    const oldMesh = this.meshes.get(key)
    if (oldMesh) {
      oldMesh.geometry.dispose()
      oldMesh.material.dispose()
      worldGroup.remove(oldMesh)
      this.meshes.delete(key)
    }

    const positions = []
    const normals = []
    const colors = []
    const indices = []
    let vertexCount = 0

    for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
      for (let localZ = 0; localZ < CHUNK_SIZE; localZ += 1) {
        for (let y = 0; y < WORLD_HEIGHT; y += 1) {
          const block = chunk[this.index(localX, y, localZ)]
          if (block === BLOCKS.air) continue
          const worldX = chunkX * CHUNK_SIZE + localX
          const worldZ = chunkZ * CHUNK_SIZE + localZ
          for (const face of FACE_DEFS) {
            const neighbor = this.getBlock(worldX + face.dir[0], y + face.dir[1], worldZ + face.dir[2])
            if (neighbor !== BLOCKS.air) continue
            const blockColor = BLOCK_COLORS[block] ?? reusableColor.set('#ffffff')
            face.corners.forEach(([cx, cy, cz]) => {
              positions.push(worldX + cx, y + cy, worldZ + cz)
              normals.push(...face.dir)
              colors.push(blockColor.r * face.light, blockColor.g * face.light, blockColor.b * face.light)
            })
            indices.push(vertexCount, vertexCount + 1, vertexCount + 2, vertexCount, vertexCount + 2, vertexCount + 3)
            vertexCount += 4
          }
        }
      }
    }

    if (!positions.length) return

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.setIndex(indices)
    geometry.computeBoundingSphere()

    const material = new THREE.MeshLambertMaterial({ vertexColors: true })
    const mesh = new THREE.Mesh(geometry, material)
    worldGroup.add(mesh)
    this.meshes.set(key, mesh)
  }

  isSolid(x, y, z) {
    return this.getBlock(x, y, z) !== BLOCKS.air
  }
}

class MultiplayerSession {
  constructor(room) {
    this.room = room
    this.channel = new BroadcastChannel(`${MULTIPLAYER_CHANNEL_PREFIX}${room}`)
    this.channel.addEventListener('message', (event) => this.handleMessage(event.data))
    this.heartbeat = window.setInterval(() => {
      this.broadcastPlayerState()
      this.pruneRemotePlayers()
    }, MULTIPLAYER_HEARTBEAT_MS)
    this.broadcastPlayerState()
  }

  broadcast(type, payload = {}) {
    this.channel.postMessage({ type, sessionId, room: this.room, ...payload })
  }

  broadcastPlayerState() {
    if (!world || activeMode !== 'multiplayer') return
    this.broadcast('player-state', {
      position: player.position.toArray(),
      rotation: { y: yawObject.rotation.y },
      selectedSlot,
    })
  }

  broadcastBlockChange(x, y, z, block) {
    this.broadcast('block-change', { x, y, z, block })
  }

  broadcastReset() {
    this.broadcast('world-reset')
  }

  handleMessage(message) {
    if (!message || message.sessionId === sessionId || message.room !== this.room) return

    if (message.type === 'player-state') {
      this.upsertRemotePlayer(message)
      return
    }

    if (!world) return

    if (message.type === 'block-change') {
      world.setBlock(message.x, message.y, message.z, message.block, { persist: true, broadcast: false })
      return
    }

    if (message.type === 'world-reset') {
      world.reset({ broadcast: false })
      return
    }

    if (message.type === 'player-leave') {
      removeRemotePlayer(message.sessionId)
    }
  }

  upsertRemotePlayer(message) {
    const entry = remotePlayers.get(message.sessionId) ?? createRemotePlayerMesh(message.sessionId)
    entry.lastSeen = performance.now()
    entry.mesh.position.fromArray(message.position)
    entry.mesh.rotation.y = message.rotation?.y ?? 0
    entry.selectedSlot = message.selectedSlot ?? 0
    remotePlayers.set(message.sessionId, entry)
  }

  pruneRemotePlayers() {
    const now = performance.now()
    for (const [id, entry] of remotePlayers.entries()) {
      if (now - entry.lastSeen > MULTIPLAYER_STALE_MS) {
        removeRemotePlayer(id)
      }
    }
  }

  destroy() {
    this.broadcast('player-leave')
    window.clearInterval(this.heartbeat)
    this.channel.close()
    clearRemotePlayers()
  }
}

function getSessionId() {
  const key = 'ysmi-session-id'
  const existing = sessionStorage.getItem(key)
  if (existing) return existing
  const next = crypto.randomUUID()
  sessionStorage.setItem(key, next)
  return next
}

function sanitizeRoomName(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'lobby'
}

function colorFromId(id) {
  let hash = 0
  for (const char of id) hash = ((hash << 5) - hash) + char.charCodeAt(0)
  const hue = Math.abs(hash) % 360
  return new THREE.Color(`hsl(${hue} 68% 58%)`)
}

function createRemotePlayerMesh(id) {
  const color = colorFromId(id)
  const headColor = color.clone().offsetHSL(0, -0.06, 0.1)
  const group = new THREE.Group()
  const body = new THREE.Mesh(PLAYER_BODY_GEOMETRY, new THREE.MeshLambertMaterial({ color }))
  body.position.y = 0.9
  const head = new THREE.Mesh(PLAYER_HEAD_GEOMETRY, new THREE.MeshLambertMaterial({ color: headColor }))
  head.position.y = 1.57
  const nose = new THREE.Mesh(PLAYER_NOSE_GEOMETRY, new THREE.MeshLambertMaterial({ color: '#fff7d4' }))
  nose.position.set(0, 1.57, 0.24)
  group.add(body, head, nose)
  remotePlayersGroup.add(group)
  return { mesh: group, lastSeen: performance.now() }
}

function removeRemotePlayer(id) {
  const entry = remotePlayers.get(id)
  if (!entry) return
  entry.mesh.traverse((child) => {
    if (child.isMesh) child.material.dispose()
  })
  remotePlayersGroup.remove(entry.mesh)
  remotePlayers.delete(id)
}

function clearRemotePlayers() {
  for (const id of [...remotePlayers.keys()]) removeRemotePlayer(id)
}

function storageKeyForMode(mode, room) {
  if (mode === 'singleplayer') return SINGLE_PLAYER_KEY
  return `${MULTIPLAYER_PREFIX}${room}`
}

function buildHotbar() {
  hotbarEl.innerHTML = HOTBAR.map((item, index) => `
    <div class="slot ${index === selectedSlot ? 'active' : ''}" aria-label="${item.label}">
      <span>${index + 1}</span>
      <div class="swatch" style="background:${item.color}"></div>
    </div>
  `).join('')
}

function updateModeUi() {
  if (activeMode === 'multiplayer') {
    modeBadge.textContent = `Multiplayer · ${activeRoom}`
    networkNote.textContent = 'Open another tab with the same room name to join this shared world.'
    focusCard.innerHTML = '<strong>Click to enter multiplayer</strong><p>This room syncs players and blocks across tabs with the same room name.</p>'
  } else {
    modeBadge.textContent = 'Single Player'
    networkNote.textContent = 'Your solo world saves locally in this browser.'
    focusCard.innerHTML = '<strong>Click to enter single player</strong><p>Lock the cursor to move and build in your saved world.</p>'
  }
}

function updateStatus(targetedBlock) {
  const coords = player.position
  const selected = HOTBAR[selectedSlot]
  const peers = activeMode === 'multiplayer' ? ` · Players: ${remotePlayers.size + 1}` : ''
  const targetText = targetedBlock ? `Target: (${targetedBlock.x}, ${targetedBlock.y}, ${targetedBlock.z})` : 'Target: none'
  statusEl.textContent = `Position: ${coords.x.toFixed(1)}, ${coords.y.toFixed(1)}, ${coords.z.toFixed(1)} · Block: ${selected.label}${peers} · ${targetText}`
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

function updateCamera() {
  yawObject.position.set(player.position.x, player.position.y + PLAYER_EYE_HEIGHT, player.position.z)
}

function requestGameFocus() {
  if (!activeMode) return
  renderer.domElement.requestPointerLock()
}

function blockAabbIntersectsPlayer(x, y, z) {
  const playerMinX = player.position.x - PLAYER_RADIUS
  const playerMaxX = player.position.x + PLAYER_RADIUS
  const playerMinY = player.position.y
  const playerMaxY = player.position.y + PLAYER_HEIGHT
  const playerMinZ = player.position.z - PLAYER_RADIUS
  const playerMaxZ = player.position.z + PLAYER_RADIUS

  return (
    x < playerMaxX && x + 1 > playerMinX &&
    y < playerMaxY && y + 1 > playerMinY &&
    z < playerMaxZ && z + 1 > playerMinZ
  )
}

function getTargetedBlock() {
  if (!world) return null
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)
  raycaster.far = REACH
  const hits = raycaster.intersectObjects([...world.meshes.values()], false)
  if (!hits.length) return null

  const hit = hits[0]
  const normal = hit.face.normal.clone().round()
  const breakPoint = hit.point.clone().addScaledVector(normal, -0.01)
  const placePoint = hit.point.clone().addScaledVector(normal, 0.01)

  return {
    breakBlock: {
      x: Math.floor(breakPoint.x),
      y: Math.floor(breakPoint.y),
      z: Math.floor(breakPoint.z),
    },
    placeBlock: {
      x: Math.floor(placePoint.x),
      y: Math.floor(placePoint.y),
      z: Math.floor(placePoint.z),
    },
    x: Math.floor(breakPoint.x),
    y: Math.floor(breakPoint.y),
    z: Math.floor(breakPoint.z),
  }
}

function attemptBreakBlock() {
  const target = getTargetedBlock()
  if (!target || !world) return
  const { x, y, z } = target.breakBlock
  if (world.getBlock(x, y, z) === BLOCKS.air) return
  world.setBlock(x, y, z, BLOCKS.air)
}

function attemptPlaceBlock() {
  const target = getTargetedBlock()
  if (!target || !world) return
  const { x, y, z } = target.placeBlock
  if (!world.inBounds(x, y, z) || world.getBlock(x, y, z) !== BLOCKS.air) return
  if (blockAabbIntersectsPlayer(x, y, z)) return
  world.setBlock(x, y, z, HOTBAR[selectedSlot].id)
}

function overlapsSolid(x, y, z) {
  if (!world) return false
  const minX = x - PLAYER_RADIUS
  const maxX = x + PLAYER_RADIUS
  const minY = y
  const maxY = y + PLAYER_HEIGHT
  const minZ = z - PLAYER_RADIUS
  const maxZ = z + PLAYER_RADIUS

  for (let bx = Math.floor(minX); bx <= Math.floor(maxX); bx += 1) {
    for (let by = Math.floor(minY); by <= Math.floor(maxY); by += 1) {
      for (let bz = Math.floor(minZ); bz <= Math.floor(maxZ); bz += 1) {
        if (world.isSolid(bx, by, bz)) return true
      }
    }
  }
  return false
}

function moveAlongAxis(axis, amount) {
  if (!amount) return
  const next = player.position.clone()
  next[axis] += amount
  if (!overlapsSolid(next.x, next.y, next.z)) {
    player.position.copy(next)
    if (axis === 'y') player.onGround = false
    return
  }

  const step = Math.sign(amount) * 0.05
  while (Math.abs(next[axis] - player.position[axis]) > 0.001) {
    const candidate = player.position.clone()
    const remaining = next[axis] - candidate[axis]
    candidate[axis] += Math.abs(remaining) < Math.abs(step) ? remaining : step
    if (overlapsSolid(candidate.x, candidate.y, candidate.z)) break
    player.position.copy(candidate)
  }

  if (axis === 'y') {
    if (amount < 0) player.onGround = true
    velocity.y = 0
  }
}

function updateMovement(delta) {
  if (!world || !pointerLocked) return

  inputDirection.set(0, 0, 0)
  if (keys.has('KeyW')) inputDirection.z -= 1
  if (keys.has('KeyS')) inputDirection.z += 1
  if (keys.has('KeyA')) inputDirection.x -= 1
  if (keys.has('KeyD')) inputDirection.x += 1

  if (inputDirection.lengthSq() > 0) {
    inputDirection.normalize()
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(tempYawAxis, yawObject.rotation.y)
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(tempYawAxis, yawObject.rotation.y)
    movement.copy(forward.multiplyScalar(-inputDirection.z)).add(right.multiplyScalar(inputDirection.x)).normalize()
    velocity.x = movement.x * MOVE_SPEED
    velocity.z = movement.z * MOVE_SPEED
  } else {
    velocity.x = 0
    velocity.z = 0
  }

  velocity.y -= GRAVITY * delta
  if (player.onGround && keys.has('Space')) {
    velocity.y = JUMP_SPEED
    player.onGround = false
  }

  moveAlongAxis('x', velocity.x * delta)
  moveAlongAxis('z', velocity.z * delta)
  moveAlongAxis('y', velocity.y * delta)

  if (player.position.y < -10) {
    player.position.set(8, 16, 8)
    velocity.set(0, 0, 0)
  }
}

function stopCurrentSession() {
  if (multiplayerSession) {
    multiplayerSession.destroy()
    multiplayerSession = null
  }
  if (world) {
    world.dispose()
    world = null
  }
  clearRemotePlayers()
  highlight.visible = false
  groundShadow.visible = false
  keys.clear()
  velocity.set(0, 0, 0)
}

function startMode(mode) {
  stopCurrentSession()
  activeMode = mode
  activeRoom = mode === 'multiplayer' ? sanitizeRoomName(roomNameInput.value) : null
  if (mode === 'multiplayer' && typeof BroadcastChannel === 'undefined') {
    networkNote.textContent = 'This browser does not support BroadcastChannel multiplayer.'
    return
  }

  roomNameInput.value = activeRoom ?? roomNameInput.value
  selectedSlot = 0
  player.position.set(8, 16, 8)
  player.onGround = false
  yawObject.rotation.set(0, 0, 0)
  pitchObject.rotation.set(0, 0, 0)

  world = new VoxelWorld({
    storageKey: storageKeyForMode(mode, activeRoom),
    persistPlayerState: mode === 'singleplayer',
  })

  if (mode === 'multiplayer') {
    multiplayerSession = new MultiplayerSession(activeRoom)
  }

  buildHotbar()
  updateModeUi()
  updateCamera()
  menuOverlay.classList.add('hidden')
  ui.classList.remove('hidden')
  focusOverlay.classList.remove('hidden')
}

function animate() {
  requestAnimationFrame(animate)
  const delta = Math.min(clock.getDelta(), 0.05)
  updateMovement(delta)
  updateCamera()
  if (world) world.rebuildDirtyMeshes()

  const target = pointerLocked ? getTargetedBlock() : null
  if (target) {
    highlight.visible = true
    highlight.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5)
  } else {
    highlight.visible = false
  }

  if (world) {
    groundShadow.visible = true
    groundShadow.position.set(player.position.x, 0.05 + Math.max(0, Math.floor(player.position.y) - 0.95), player.position.z)
    updateStatus(target)
  } else {
    groundShadow.visible = false
    statusEl.textContent = ''
  }

  renderer.render(scene, camera)
}

buildHotbar()
resize()
animate()

singlePlayerButton.addEventListener('click', () => startMode('singleplayer'))
multiplayerButton.addEventListener('click', () => startMode('multiplayer'))
focusOverlay.addEventListener('click', requestGameFocus)
window.addEventListener('resize', resize)
window.addEventListener('beforeunload', () => {
  if (world) world.saveState()
  if (multiplayerSession) multiplayerSession.destroy()
})
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && world) world.saveState()
})
window.setInterval(() => {
  if (world) world.saveState()
}, 2000)
window.addEventListener('contextmenu', (event) => event.preventDefault())
window.addEventListener('keydown', (event) => {
  if (!world) return
  keys.add(event.code)
  if (event.code === 'Space') event.preventDefault()
  if (event.code.startsWith('Digit')) {
    const slot = Number(event.code.at(-1)) - 1
    if (slot >= 0 && slot < HOTBAR.length) {
      selectedSlot = slot
      buildHotbar()
      world.saveState()
    }
  }
  if (event.code === 'KeyR') {
    world.reset()
  }
})
window.addEventListener('keyup', (event) => {
  keys.delete(event.code)
})
window.addEventListener('mousedown', (event) => {
  if (!world) return
  if (!pointerLocked) {
    requestGameFocus()
    return
  }
  if (event.button === 0) attemptBreakBlock()
  if (event.button === 2) attemptPlaceBlock()
})
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === renderer.domElement
  focusOverlay.classList.toggle('hidden', pointerLocked || !world)
})
document.addEventListener('mousemove', (event) => {
  if (!pointerLocked || !world) return
  yawObject.rotation.y -= event.movementX * 0.0025
  pitchObject.rotation.x -= event.movementY * 0.0025
  pitchObject.rotation.x = THREE.MathUtils.clamp(pitchObject.rotation.x, -Math.PI / 2, Math.PI / 2)
})
