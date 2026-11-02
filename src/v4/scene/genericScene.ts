// Builds the 3 SceneLayers (background / buildings / platform) for ANY
// scene purely from its discovered assets + its SceneConfig -- no per-scene
// code needed. This is what makes adding a new scene just "add a folder".
import { createSvgElement } from '../stage'
import { CHAR_HEIGHT } from '../character/metrics'
import { groundScreenY } from './layout'
import type { SceneLayer } from './types'
import type { SceneAssets, ImageSize } from './sceneAssets'
import type { SceneConfig } from './sceneConfig'

export interface LoadedSceneAssets {
  background: ImageSize[] // same order as assets.backgroundUrls
  platform: ImageSize[] // same order as assets.platformUrls
  buildings: ImageSize[] // same order as assets.buildingUrls
}

function buildImageTile(url: string, w: number, h: number): SVGImageElement {
  const image = createSvgElement('image', { width: w, height: h, preserveAspectRatio: 'none' })
  image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', url)
  image.setAttribute('href', url)
  return image
}

// Stitches 1+ frames end-to-end (no gap -- they're meant to be designed as
// one continuous strip, e.g. background01.png/02.png/03.png, or a single
// background.png that just repeats on its own) into one tile. Every frame
// is scaled to the SAME target height (computed from ITS OWN native size by
// `targetHeight`, but since that function ignores per-frame size for
// background/platform today, every frame ends up equal height) so adjacent
// stitched frames line up vertically with no jump.
function buildStitchedLayer(
  urls: string[],
  sizes: ImageSize[],
  targetHeight: (size: ImageSize) => number,
  yFor: (frameHeight: number) => number,
  xOffset: number,
  speedFactor: number,
  className: string,
): SceneLayer {
  const frames = urls.map((url, i) => {
    const size = sizes[i]
    const scale = targetHeight(size) / size.height
    return { url, w: size.width * scale, h: size.height * scale }
  })
  const tileWidth = frames.reduce((sum, frame) => sum + frame.w, 0)

  return {
    tileWidth,
    speedFactor,
    buildTile() {
      const g = createSvgElement('g', { class: className })
      let x = xOffset
      for (const frame of frames) {
        const img = buildImageTile(frame.url, frame.w, frame.h)
        img.setAttribute('x', String(x))
        img.setAttribute('y', String(yFor(frame.h)))
        g.appendChild(img)
        x += frame.w
      }
      return g
    },
  }
}

// Far backdrop: every frame scaled to fill the stage's height by default
// (config.scale is a multiplier on top of that), anchored top-left + the
// x/y offset controls. Slowest parallax layer.
function buildBackgroundLayer(assets: SceneAssets, sizes: LoadedSceneAssets, config: SceneConfig, stageHeight: number): SceneLayer {
  return buildStitchedLayer(
    assets.backgroundUrls,
    sizes.background,
    () => stageHeight * config.background.scale,
    () => config.background.y,
    config.background.x,
    0.15,
    'scene-background',
  )
}

// Ground track the character walks on: every frame scaled to the same
// sensible fraction of the viewport height by default, anchored so its TOP
// sits at the shared ground line (y offset nudges it to line up with the
// character's feet). Fastest parallax layer (matches apparent stride
// speed).
function buildPlatformLayer(assets: SceneAssets, sizes: LoadedSceneAssets, config: SceneConfig, stageHeight: number): SceneLayer {
  const groundY = groundScreenY(stageHeight)
  return buildStitchedLayer(
    assets.platformUrls,
    sizes.platform,
    () => stageHeight * 0.22 * config.platform.scale,
    (frameHeight) => groundY - frameHeight + config.platform.y,
    config.platform.x,
    1,
    'scene-platform',
  )
}

// Buildings cycle through every image in assets.buildingUrls, left to
// right, separated by config.buildings.spacing, then repeat -- one shared
// scale factor (preserving each building's own aspect ratio/relative size)
// keyed off the tallest building reading as roughly 4x the character's
// height by default. Anchored by their BOTTOM to the ground line (+ y
// offset). Medium parallax layer, between background and platform.
function buildBuildingsLayer(assets: SceneAssets, sizes: LoadedSceneAssets, config: SceneConfig, stageHeight: number): SceneLayer | null {
  if (assets.buildingUrls.length === 0) return null
  const groundY = groundScreenY(stageHeight)
  const tallestNativeHeight = Math.max(...sizes.buildings.map((size) => size.height))
  const baseScale = (CHAR_HEIGHT * 4) / tallestNativeHeight
  const scale = baseScale * config.buildings.scale
  const spacing = config.buildings.spacing

  const rendered = assets.buildingUrls.map((url, i) => {
    const size = sizes.buildings[i]
    return { url, w: size.width * scale, h: size.height * scale }
  })
  const tileWidth = rendered.reduce((sum, b) => sum + b.w + spacing, 0)

  return {
    tileWidth,
    speedFactor: 0.42,
    buildTile() {
      const g = createSvgElement('g', { class: 'scene-buildings' })
      let x = 0
      for (const b of rendered) {
        const img = buildImageTile(b.url, b.w, b.h)
        img.setAttribute('x', String(x + config.buildings.x))
        img.setAttribute('y', String(groundY - b.h + config.buildings.y))
        g.appendChild(img)
        x += b.w + spacing
      }
      return g
    },
  }
}

// Order matters -- paint order is DOM order, so background first (furthest
// back), then buildings, then the platform on top (nearest to the camera).
// A layer whose `enabled` is false is omitted entirely (no DOM at all, not
// just hidden) -- see sceneConfig.ts#LayerTransform.
export function buildSceneLayers(assets: SceneAssets, sizes: LoadedSceneAssets, config: SceneConfig, stageHeight: number): SceneLayer[] {
  const layers: SceneLayer[] = []
  if (config.background.enabled) layers.push(buildBackgroundLayer(assets, sizes, config, stageHeight))
  if (config.buildings.enabled) {
    const buildings = buildBuildingsLayer(assets, sizes, config, stageHeight)
    if (buildings) layers.push(buildings)
  }
  if (config.platform.enabled) layers.push(buildPlatformLayer(assets, sizes, config, stageHeight))
  return layers
}
