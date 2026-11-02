// Mounts the currently-selected scene into the stage: a stack of live
// parallax layers (parallaxLayer.ts) built generically from whatever
// assets a scene folder provides (sceneAssets.ts + genericScene.ts) --
// there is no per-scene code, only per-scene PNG/SVG files + an optional
// scene-config.json. mount() is async because it has to probe every
// image's natural pixel size (sceneAssets.loadImageSize) before layer
// geometry can be computed.
//
// Switching scenes (every mount() after the first) plays a right-to-left
// wipe. The wipe is a pure VISIBILITY mask (an SVG <clipPath> rect growing
// from the right edge leftward), not a transform that physically slides
// the scene. That matters: the incoming scene sits at its final position
// (x=0) from the very start and plays its OWN parallax scroll completely
// normally the whole time -- background/buildings/platform each keep
// moving at exactly their usual speedFactor * groundSpeed, uninterrupted,
// before, during and after the switch. The clip just controls how much of
// that already-playing scene is visible. (An earlier version translated
// the whole scene in from the right instead, which ADDED that slide's own
// speed on top of the layers' scroll -- doubling the foreground's apparent
// speed mid-wipe, then dropping back down the instant it finished. A pure
// clip mask has no such interaction with content motion.)
//
// SCENE_TRANSITION_HIGHLIGHT_ENABLED adds a "portal" touch on top of that
// plain wipe: a soft glowing gradient band plus a bright core line riding
// the moving seam. This used to be a feGaussianBlur'd <use> copy of each
// scene masked by a gradient, which looked nice but re-rasterizing/
// re-blurring the full scene content every frame was expensive. The
// highlight here is just 2 solid-color <rect>s with gradient fills, moved
// by updating their `x` attribute -- no filters, negligible cost -- while
// still reading as a glowing "crossing into another place" seam.
//
// Each SceneInstance keeps its own local clock (starting at 0, never
// paused/reset) so a freshly-mounted scene always STARTS fully
// tile-aligned across all its layers, no matter how long the app had
// already been running.
import { createSvgElement } from '../stage'
import { createParallaxLayer } from './parallaxLayer'
import type { LiveLayer } from './parallaxLayer'
import { buildSceneLayers } from './genericScene'
import type { LoadedSceneAssets } from './genericScene'
import { discoverScenes, getScene, loadImageSize } from './sceneAssets'
import type { SceneAssets } from './sceneAssets'
import { loadSceneConfig } from './sceneConfig'
import type { SceneConfig } from './sceneConfig'

// How fast the wipe's reveal boundary sweeps across the screen, relative to
// the ground-scroll speed main.ts last reported via update(). This is
// purely a visual pacing choice (it doesn't affect any layer's actual
// scroll speed) -- 1 keeps the reveal moving at a pace that visually
// matches the walk.
export const SCENE_TRANSITION_SPEED_MULTIPLIER = 1

// Floor so a scene switch right at page load (before any real speed has
// been reported to update() yet) still animates instead of stalling.
const MIN_WIPE_SPEED_PX_PER_SEC = 60

// Toggle the glowing "portal" seam on/off. Everything else about the wipe
// (speed, alignment, per-layer motion) is unaffected either way, and this
// toggle has no filter/perf cost regardless of value.
export const SCENE_TRANSITION_HIGHLIGHT_ENABLED = false
const HIGHLIGHT_GLOW_WIDTH_PX = 140 // soft halo, centered on the seam
const HIGHLIGHT_CORE_WIDTH_PX = 5 // bright center line, centered on the seam
const HIGHLIGHT_COLOR = '#bfe9ff'

export interface SceneRenderer {
  /** Append this once to the stage, behind the character. */
  group: SVGGElement
  /** Switches to (or re-mounts) a scene by id, probing asset sizes + loading its config. Resolves once any wipe transition finishes; returns the live, mutable config object. */
  mount: (sceneId: string | null, stageWidth: number, stageHeight: number) => Promise<SceneConfig>
  /** Re-lays-out the active scene's (and an in-flight incoming scene's, if any) layers for a new viewport size. No-op until a scene has been mounted. */
  resize: (stageWidth: number, stageHeight: number) => void
  /** Rebuilds the active scene's layers from its (externally-mutated) config -- call after a customizer edit changes scale/position/spacing. */
  rebuild: () => void
  update: (elapsedSeconds: number, groundSpeedPxPerSec: number) => void
  currentSceneId: () => string | null
}

interface SceneInstance {
  wrapper: SVGGElement
  layersGroup: SVGGElement
  liveLayers: LiveLayer[]
  assets: SceneAssets
  sizes: LoadedSceneAssets
  config: SceneConfig
  /** This instance's own parallax clock -- starts at 0, ticks forward every frame it exists, never paused or rebased. */
  localElapsed: number
}

function buildLiveLayers(assets: SceneAssets, sizes: LoadedSceneAssets, config: SceneConfig, stageWidth: number, stageHeight: number): { layersGroup: SVGGElement; liveLayers: LiveLayer[] } {
  const layersGroup = createSvgElement('g', { class: 'scene-layers' })
  const liveLayers: LiveLayer[] = []
  for (const layerDef of buildSceneLayers(assets, sizes, config, stageHeight)) {
    const live = createParallaxLayer(layerDef, stageWidth)
    layersGroup.appendChild(live.group)
    liveLayers.push(live)
  }
  return { layersGroup, liveLayers }
}

function buildInstance(assets: SceneAssets, sizes: LoadedSceneAssets, config: SceneConfig, stageWidth: number, stageHeight: number): SceneInstance {
  const backdrop = createSvgElement('rect', { x: 0, y: 0, width: '100%', height: '100%', fill: '#0b1026' })
  const { layersGroup, liveLayers } = buildLiveLayers(assets, sizes, config, stageWidth, stageHeight)
  const wrapper = createSvgElement('g', { class: 'scene-instance' })
  wrapper.append(backdrop, layersGroup)

  return { wrapper, layersGroup, liveLayers, assets, sizes, config, localElapsed: 0 }
}

// Rebuilds the layer DOM (e.g. after a resize or a customizer edit) without
// touching localElapsed, so the scene keeps scrolling from where it already
// was instead of resetting to its built/unscrolled state.
function rebuildInstance(instance: SceneInstance, stageWidth: number, stageHeight: number): void {
  const { layersGroup, liveLayers } = buildLiveLayers(instance.assets, instance.sizes, instance.config, stageWidth, stageHeight)
  instance.layersGroup.replaceWith(layersGroup)
  instance.layersGroup = layersGroup
  instance.liveLayers = liveLayers
}

let rendererIdCounter = 0

export function createSceneRenderer(): SceneRenderer {
  const rendererId = (rendererIdCounter += 1)
  const group = createSvgElement('g', { class: 'scene-root' })
  const defs = createSvgElement('defs')
  group.appendChild(defs)

  // --- Reveal clip (always used) ---------------------------------------
  const revealClipId = `scene-wipe-reveal-${rendererId}`
  const revealClipRect = createSvgElement('rect', { x: 0, y: -10000, width: 0, height: 20000 })
  const revealClipPath = createSvgElement('clipPath', { id: revealClipId })
  revealClipPath.appendChild(revealClipRect)
  defs.appendChild(revealClipPath)

  // --- Glowing "portal" seam (only built/used if the toggle is on) -----
  // Two plain gradient-filled rects, centered on the moving edge and moved
  // by updating their `x` each frame -- gradientUnits default to
  // objectBoundingBox, so the gradient tracks the rect automatically with
  // no per-frame gradient updates needed. No filters, no re-rasterizing
  // scene content -- this is as cheap as any other parallax layer.
  const glowGradientId = `scene-wipe-glow-${rendererId}`
  let glowRect: SVGRectElement | null = null
  let coreRect: SVGRectElement | null = null

  if (SCENE_TRANSITION_HIGHLIGHT_ENABLED) {
    const glowGradient = createSvgElement('linearGradient', { id: glowGradientId, x1: '0%', y1: '0%', x2: '100%', y2: '0%' })
    glowGradient.append(
      createSvgElement('stop', { offset: '0%', 'stop-color': HIGHLIGHT_COLOR, 'stop-opacity': 0 }),
      createSvgElement('stop', { offset: '50%', 'stop-color': HIGHLIGHT_COLOR, 'stop-opacity': 0.45 }),
      createSvgElement('stop', { offset: '100%', 'stop-color': HIGHLIGHT_COLOR, 'stop-opacity': 0 }),
    )
    defs.appendChild(glowGradient)

    glowRect = createSvgElement('rect', { x: -HIGHLIGHT_GLOW_WIDTH_PX, y: -10000, width: HIGHLIGHT_GLOW_WIDTH_PX, height: 20000, fill: `url(#${glowGradientId})` })
    coreRect = createSvgElement('rect', { x: -HIGHLIGHT_CORE_WIDTH_PX / 2, y: -10000, width: HIGHLIGHT_CORE_WIDTH_PX, height: 20000, fill: HIGHLIGHT_COLOR, opacity: 0.85 })
  }

  let current: SceneInstance | null = null
  let incoming: SceneInstance | null = null
  let transitionRaf: number | null = null
  let lastWidth = 0
  let lastHeight = 0
  let lastRawElapsed: number | null = null
  let lastSpeed = 0

  // Renders `instance` once at its OWN current localElapsed -- called right
  // after building/rebuilding so it never sits one frame behind (blank or
  // at a stale position) before the next real update() tick.
  function primeInstance(instance: SceneInstance): void {
    for (const layer of instance.liveLayers) layer.update(instance.localElapsed, lastSpeed)
  }

  function spawnHighlight(): void {
    if (!glowRect || !coreRect) return
    group.append(glowRect, coreRect)
  }

  function updateHighlight(edgeX: number): void {
    if (!glowRect || !coreRect) return
    glowRect.setAttribute('x', String(edgeX - HIGHLIGHT_GLOW_WIDTH_PX / 2))
    coreRect.setAttribute('x', String(edgeX - HIGHLIGHT_CORE_WIDTH_PX / 2))
  }

  function despawnHighlight(): void {
    glowRect?.remove()
    coreRect?.remove()
  }

  // If a new mount() lands while a wipe is still in flight, snap it to
  // completion immediately so instances never pile up / animate at once.
  function finishTransition(): void {
    if (transitionRaf !== null) cancelAnimationFrame(transitionRaf)
    transitionRaf = null
    despawnHighlight()
    if (incoming) {
      incoming.wrapper.removeAttribute('clip-path')
      current?.wrapper.remove()
      current = incoming
      incoming = null
    }
  }

  // Linear (constant-speed) reveal, not eased -- purely a visibility mask,
  // see the file header for why this never touches any layer's own speed.
  function animateReveal(stageWidth: number): Promise<void> {
    return new Promise((resolve) => {
      spawnHighlight()
      const start = performance.now()
      const speed = Math.max(lastSpeed * SCENE_TRANSITION_SPEED_MULTIPLIER, MIN_WIPE_SPEED_PX_PER_SEC)
      function step(now: number) {
        const revealed = Math.min(stageWidth, speed * ((now - start) / 1000))
        const edgeX = stageWidth - revealed
        revealClipRect.setAttribute('x', String(edgeX))
        revealClipRect.setAttribute('width', String(revealed))
        updateHighlight(edgeX)
        if (revealed < stageWidth) {
          transitionRaf = requestAnimationFrame(step)
          return
        }
        transitionRaf = null
        despawnHighlight()
        incoming?.wrapper.removeAttribute('clip-path')
        current?.wrapper.remove()
        current = incoming
        incoming = null
        resolve()
      }
      transitionRaf = requestAnimationFrame(step)
    })
  }

  async function mount(sceneId: string | null, stageWidth: number, stageHeight: number): Promise<SceneConfig> {
    const assets = getScene(sceneId)
    const background = await Promise.all(assets.backgroundUrls.map(loadImageSize))
    const platform = await Promise.all(assets.platformUrls.map(loadImageSize))
    const buildings = await Promise.all(assets.buildingUrls.map(loadImageSize))
    const sizes: LoadedSceneAssets = { background, platform, buildings }
    const config = loadSceneConfig(assets.id)

    lastWidth = stageWidth
    lastHeight = stageHeight

    const instance = buildInstance(assets, sizes, config, stageWidth, stageHeight)
    primeInstance(instance)

    if (!current) {
      // First mount ever -- no transition, just place it.
      group.appendChild(instance.wrapper)
      current = instance
      return config
    }

    finishTransition() // settle any transition already in flight before starting a new one
    revealClipRect.setAttribute('x', String(stageWidth))
    revealClipRect.setAttribute('width', '0')
    instance.wrapper.setAttribute('clip-path', `url(#${revealClipId})`)
    group.appendChild(instance.wrapper)
    incoming = instance
    await animateReveal(stageWidth)
    return config
  }

  function resize(stageWidth: number, stageHeight: number): void {
    lastWidth = stageWidth
    lastHeight = stageHeight
    if (current) {
      rebuildInstance(current, stageWidth, stageHeight)
      primeInstance(current)
    }
    if (incoming) {
      rebuildInstance(incoming, stageWidth, stageHeight)
      primeInstance(incoming)
    }
  }

  function rebuild(): void {
    if (current) {
      rebuildInstance(current, lastWidth, lastHeight)
      primeInstance(current)
    }
    if (incoming) {
      rebuildInstance(incoming, lastWidth, lastHeight)
      primeInstance(incoming)
    }
  }

  // Both scenes (current, and incoming if a wipe is in flight) keep
  // scrolling every frame at their own normal per-layer parallax speed --
  // the wipe is purely a visibility mask (see mount()/animateReveal()), so
  // there's nothing here that needs to pause for it.
  function update(elapsedSeconds: number, groundSpeedPxPerSec: number): void {
    if (lastRawElapsed === null) lastRawElapsed = elapsedSeconds
    const delta = elapsedSeconds - lastRawElapsed
    lastRawElapsed = elapsedSeconds
    lastSpeed = groundSpeedPxPerSec

    if (current) {
      current.localElapsed += delta
      for (const layer of current.liveLayers) layer.update(current.localElapsed, groundSpeedPxPerSec)
    }
    if (incoming) {
      incoming.localElapsed += delta
      for (const layer of incoming.liveLayers) layer.update(incoming.localElapsed, groundSpeedPxPerSec)
    }
  }

  return { group, mount, resize, rebuild, update, currentSceneId: () => current?.assets.id ?? null }
}

export { discoverScenes }
