// Discovers scenes purely from folder structure under ./scenes/ -- each
// scene is a folder containing:
//   background/   -- far parallax backdrop frame(s): background.png alone
//                     (repeated), or background01.png, background02.png...
//                     (stitched together end-to-end in filename order, then
//                     that whole sequence repeats) -- same convention for
//                     platform/ and buildings/.
//   platform/     -- the ground/track the character walks on, same rules.
//   buildings/    -- optional; images cycled left-to-right with
//                     configurable spacing between them (see genericScene.ts).
// Adding a new scene is just adding a new folder with those subfolders --
// no code change needed; sceneSelector.ts lists whatever this discovers.
//
// import.meta.glob patterns are resolved statically by Vite at build/dev
// time, so this really does "see" new folders/files on the next dev-server
// reload / build, same mechanism character/svgAssets.ts uses for parts.
// NOTE: each pattern below must stay an inline string literal -- Vite's
// import.meta.glob is analyzed statically at the call site, so routing it
// through a helper function that takes the pattern as a parameter would
// silently stop finding anything.
const BACKGROUND_PNG_SOURCES = import.meta.glob('./scenes/*/background/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const BACKGROUND_SVG_SOURCES = import.meta.glob('./scenes/*/background/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const PLATFORM_PNG_SOURCES = import.meta.glob('./scenes/*/platform/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const PLATFORM_SVG_SOURCES = import.meta.glob('./scenes/*/platform/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const BUILDING_PNG_SOURCES = import.meta.glob('./scenes/*/buildings/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const BUILDING_SVG_SOURCES = import.meta.glob('./scenes/*/buildings/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

const BACKGROUND_SOURCES = { ...BACKGROUND_PNG_SOURCES, ...BACKGROUND_SVG_SOURCES }
const PLATFORM_SOURCES = { ...PLATFORM_PNG_SOURCES, ...PLATFORM_SVG_SOURCES }
const BUILDING_SOURCES = { ...BUILDING_PNG_SOURCES, ...BUILDING_SVG_SOURCES }

export interface SceneAssets {
  id: string
  label: string
  /** Sorted by filename; stitched end-to-end (no gap) then the whole sequence repeats. */
  backgroundUrls: string[]
  /** Sorted by filename; stitched end-to-end (no gap) then the whole sequence repeats. */
  platformUrls: string[]
  /** Sorted by filename; cycled in order with a gap (buildings.spacing) between each. */
  buildingUrls: string[]
}

// './scenes/<id>/background/background01.png' -> '<id>'
function sceneIdFromPath(path: string): string {
  const match = /\.\/scenes\/([^/]+)\//.exec(path)
  if (!match) throw new Error(`Could not parse a scene id out of path: ${path}`)
  return match[1]
}

function labelFromId(id: string): string {
  return id
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function urlsForScene(sources: Record<string, string>, id: string): string[] {
  return Object.entries(sources)
    .filter(([path]) => sceneIdFromPath(path) === id)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, url]) => url)
}

let cachedScenes: SceneAssets[] | null = null

// Every scene needs at least one background frame + one platform frame; a
// scene folder missing either is skipped (logged) rather than crashing the
// page.
export function discoverScenes(): SceneAssets[] {
  if (cachedScenes) return cachedScenes

  const ids = Array.from(
    new Set([...Object.keys(BACKGROUND_SOURCES), ...Object.keys(PLATFORM_SOURCES)].map(sceneIdFromPath)),
  ).sort()

  const scenes: SceneAssets[] = []
  for (const id of ids) {
    const backgroundUrls = urlsForScene(BACKGROUND_SOURCES, id)
    const platformUrls = urlsForScene(PLATFORM_SOURCES, id)
    if (backgroundUrls.length === 0 || platformUrls.length === 0) {
      console.warn(`Scene "${id}" is missing background/ or platform/ frames -- skipped.`)
      continue
    }
    const buildingUrls = urlsForScene(BUILDING_SOURCES, id)

    scenes.push({ id, label: labelFromId(id), backgroundUrls, platformUrls, buildingUrls })
  }

  cachedScenes = scenes
  return scenes
}

export function getScene(id: string | null): SceneAssets {
  const scenes = discoverScenes()
  if (scenes.length === 0) throw new Error('No scenes found under src/v4/scene/scenes/*/ (need at least a background/ and platform/ frame).')
  return scenes.find((scene) => scene.id === id) ?? scenes[0]
}

export interface ImageSize {
  width: number
  height: number
}

const sizeCache = new Map<string, Promise<ImageSize>>()

// Probes a PNG/SVG's natural pixel size (cached per URL) -- needed before
// tile geometry (tileWidth, per-building width/height) can be computed,
// since SVG <image> needs explicit width/height to lay out correctly.
export function loadImageSize(url: string): Promise<ImageSize> {
  let cached = sizeCache.get(url)
  if (!cached) {
    cached = new Promise<ImageSize>((resolve) => {
      const probe = new Image()
      probe.onload = () => resolve({ width: probe.naturalWidth || 1, height: probe.naturalHeight || 1 })
      probe.onerror = () => resolve({ width: 1, height: 1 })
      probe.src = url
    })
    sizeCache.set(url, cached)
  }
  return cached
}
