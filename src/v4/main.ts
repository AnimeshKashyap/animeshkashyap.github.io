// v4 entry point. Full-screen SVG canvas stage with a single modular,
// layered character (head/hair/eye/eyebrow/ear/beard/glasses/torso/arms/
// legs/shoes, see ./character) walking in place, anchored 25% in from the
// left edge, over a looping parallax background scene (see ./scene) that
// scrolls left-to-right underneath it to sell the illusion of movement.
import { mountCustomizer } from './customizer/panel'
import { loadConfig } from './customizer/config'
import { buildCharacter } from './character'
import { groundY } from './character/metrics'
import { normalizeAllParts } from './character/partSizing'
import { createWalkCycle } from './character/walkCycle'
import { createStage } from './stage'
import { createSceneRenderer } from './scene/sceneEngine'
import { mountSceneSelector } from './scene/sceneSelector'
import { mountSceneCustomizer } from './scene/sceneCustomizer'
import type { SceneConfig } from './scene/sceneConfig'
import { groundScreenY } from './scene/layout'
import './styles.css'

const container = document.querySelector<HTMLElement>('#app')
if (!container) throw new Error('Missing #app')

const stage = createStage(container)

// Scene is picked once at load via ?scene=<id> (falls back to the first
// scene found under scene/scenes/*/ if missing/unknown -- see
// sceneAssets.ts#getScene). Switching afterward goes through the top-middle
// selector (sceneSelector.ts), which re-runs initScene() below.
const requestedSceneId = new URLSearchParams(window.location.search).get('scene')
const sceneRenderer = createSceneRenderer()
stage.svg.append(sceneRenderer.group)

const sceneCustomizer = mountSceneCustomizer(container)

// Live reference to the current scene's config so positionCharacter() can
// read its `character` offset -- reassigned on every scene switch.
let currentSceneConfig: SceneConfig | null = null

// mount() is async (probes every asset's natural pixel size before layer
// geometry can be computed) -- the rest of page init (character, its own
// customizer, the frame loop) does not depend on it and proceeds
// immediately below; the scene layers simply pop in once this resolves.
async function initScene(sceneId: string | null): Promise<void> {
  const config = await sceneRenderer.mount(sceneId, stage.width, stage.height)
  currentSceneConfig = config
  const resolvedId = sceneRenderer.currentSceneId()
  if (resolvedId) {
    sceneCustomizer.bind(resolvedId, config, () => {
      sceneRenderer.rebuild()
      positionCharacter()
    })
  }
  positionCharacter()
}

void initScene(requestedSceneId).then(() => {
  const resolvedId = sceneRenderer.currentSceneId()
  if (!resolvedId) return
  mountSceneSelector(container, resolvedId, (nextId) => {
    void initScene(nextId)
  })
})

// Approximate apparent walking speed in px/sec, used to drive the
// foreground (speedFactor 1) scene layer -- not derived from the
// procedural walk cycle (which only animates joint angles in place, with
// no inherent translation speed of its own). Phase 4.1 revisits this to
// sync it precisely with CYCLE_SPEED (character/walkCycle.ts).
const GROUND_SPEED_PX_PER_SEC = 120

const { root, joints, whenReady, zGroups } = buildCharacter()
stage.svg.append(root)
// Single shared config instance -- read live by walkCycle.ts every frame
// (for jointOffsetX/Y) and mutated in place by the customizer, so a slider
// drag is reflected on the very next frame with no extra wiring.
const sharedConfig = loadConfig()
// Needs the character connected to the live document AND every part's real
// dimensions known (immediate for SVG, after image decode for PNG) before
// any getBBox()-based fitting runs. One generic pass fits every part --
// see character/partSizing.ts for per-part target sizes.
whenReady.then(() => {
  normalizeAllParts(sharedConfig)
})
const updateWalkCycle = createWalkCycle(joints, sharedConfig)

const CHARACTER_X_FRACTION = 0.25 // 25% in from the left edge, fixed -- walks in place

function positionCharacter() {
  const offset = currentSceneConfig?.character ?? { x: 0, y: 0, enabled: true }
  const x = stage.width * CHARACTER_X_FRACTION + offset.x
  root.setAttribute('transform', `translate(${x}, ${groundScreenY(stage.height) - groundY + offset.y})`)
  root.style.display = offset.enabled ? '' : 'none'
}

function syncLayout() {
  sceneRenderer.resize(stage.width, stage.height)
  positionCharacter()
}

syncLayout()
window.addEventListener('resize', syncLayout)

mountCustomizer(container, zGroups, sharedConfig)

// Click anywhere on the stage to pause/resume the walk cycle. Time is
// tracked as accumulated `elapsed` seconds (not wall-clock), so pausing
// freezes the pose in place and resuming continues from there instead of
// jumping -- and the rAF loop itself stops while paused.
let elapsed = 0
let lastFrameTime: number | null = null
let isPaused = false
let rafId: number | null = null

function frame(now: number) {
  if (lastFrameTime === null) lastFrameTime = now
  elapsed += (now - lastFrameTime) / 1000
  lastFrameTime = now
  updateWalkCycle(elapsed)
  sceneRenderer.update(elapsed, GROUND_SPEED_PX_PER_SEC)
  rafId = requestAnimationFrame(frame)
}

function togglePause() {
  isPaused = !isPaused
  if (isPaused) {
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = null
  } else {
    lastFrameTime = null
    rafId = requestAnimationFrame(frame)
  }
}

stage.svg.style.cursor = 'pointer'
stage.svg.addEventListener('click', togglePause)

rafId = requestAnimationFrame(frame)
