// Per-scene layer transforms (position/scale, + spacing for buildings),
// following the same file-defaults + localStorage-override pattern as
// character/customizer/config.ts:
//   1. scenes/<id>/scene-config.json  -- optional, hand-edited or produced
//      by the Scene Customizer's "Show JSON" output. Missing file = identity.
//      (This was always supported -- every existing scene now ships one
//      with identity defaults, the same way character/parts/parts-config.json
//      is checked in, rather than leaving it to only ever be created lazily
//      via "Save".)
//   2. localStorage (this browser only) -- live override on top, written by
//      "Save". "Use file defaults" drops this and re-reads the file.
export interface LayerTransform {
  x: number
  y: number
  scale: number
  /** Omits this layer entirely (no DOM, not just invisible) when false -- see genericScene.ts#buildSceneLayers. */
  enabled: boolean
}

export interface BuildingsTransform extends LayerTransform {
  /** Gap in px between one building's right edge and the next building's left edge. */
  spacing: number
}

/** Extra nudge applied on top of the character's normal fixed walk-in-place position. */
export interface CharacterOffset {
  x: number
  y: number
  /** Hides the whole character (main.ts#positionCharacter) when false. */
  enabled: boolean
}

export interface SceneConfig {
  background: LayerTransform
  platform: LayerTransform
  buildings: BuildingsTransform
  character: CharacterOffset
}

export function identitySceneConfig(): SceneConfig {
  return {
    background: { x: 0, y: 0, scale: 1, enabled: true },
    platform: { x: 0, y: 0, scale: 1, enabled: true },
    buildings: { x: 0, y: 0, scale: 1, spacing: 60, enabled: true },
    character: { x: 0, y: 0, enabled: true },
  }
}

const SCENE_CONFIG_SOURCES = import.meta.glob('./scenes/*/scene-config.json', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

function sceneIdFromPath(path: string): string {
  const match = /\.\/scenes\/([^/]+)\//.exec(path)
  return match ? match[1] : ''
}

function fileDefaultsFor(sceneId: string): Partial<SceneConfig> {
  const entry = Object.entries(SCENE_CONFIG_SOURCES).find(([path]) => sceneIdFromPath(path) === sceneId)
  if (!entry) return {}
  try {
    return JSON.parse(entry[1]) as Partial<SceneConfig>
  } catch (error) {
    console.error(`scenes/${sceneId}/scene-config.json is invalid JSON -- using identity defaults`, error)
    return {}
  }
}

function mergeLayer<T extends object>(base: T, override?: Partial<T>): T {
  return override ? { ...base, ...override } : base
}

export function createDefaultSceneConfig(sceneId: string): SceneConfig {
  const identity = identitySceneConfig()
  const fileDefaults = fileDefaultsFor(sceneId)
  return {
    background: mergeLayer(identity.background, fileDefaults.background),
    platform: mergeLayer(identity.platform, fileDefaults.platform),
    buildings: mergeLayer(identity.buildings, fileDefaults.buildings),
    character: mergeLayer(identity.character, fileDefaults.character),
  }
}

function storageKey(sceneId: string): string {
  return `v4-scene-customizer-config:${sceneId}`
}

export function loadSceneConfig(sceneId: string): SceneConfig {
  const config = createDefaultSceneConfig(sceneId)
  try {
    const raw = localStorage.getItem(storageKey(sceneId))
    if (!raw) return config
    const parsed = JSON.parse(raw) as Partial<SceneConfig>
    return {
      background: mergeLayer(config.background, parsed.background),
      platform: mergeLayer(config.platform, parsed.platform),
      buildings: mergeLayer(config.buildings, parsed.buildings),
      character: mergeLayer(config.character, parsed.character),
    }
  } catch {
    return config
  }
}

export function saveSceneConfig(sceneId: string, config: SceneConfig): void {
  localStorage.setItem(storageKey(sceneId), JSON.stringify(config))
}

export function clearSavedSceneConfig(sceneId: string): void {
  localStorage.removeItem(storageKey(sceneId))
}
