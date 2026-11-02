// Config source of truth, in priority order:
//   1. character/parts/parts-config.json  -- the file to hand-edit, or to
//      overwrite with the customizer's "Show JSON" output, to change the
//      shipped look with NO code change. Loaded fresh on every page load.
//   2. localStorage (this browser only)   -- a live in-session override on
//      top of the file, written by "Save". Lets you keep experimenting
//      across reloads before committing a value into the file. Use "Use
//      file defaults" in the panel to drop this and go back to the file.
import { defaultPartTransform, PART_KEYS } from '../character/partAdjust'
import type { PartKey, PartTransform } from '../character/partAdjust'
import partsConfigRaw from '../character/parts/parts-config.json?raw'

export type CustomizerConfig = Record<PartKey, PartTransform>

const STORAGE_KEY = 'v4-character-customizer-config'

function mergeOverrides(
  base: CustomizerConfig,
  overrides: Partial<Record<PartKey, Partial<PartTransform>>>,
): CustomizerConfig {
  const merged = { ...base }
  for (const key of PART_KEYS) {
    const override = overrides[key]
    if (override) {
      merged[key] = { ...merged[key], ...override }
    }
  }
  return merged
}

function identityConfig(): CustomizerConfig {
  const config = {} as CustomizerConfig
  for (const key of PART_KEYS) {
    config[key] = defaultPartTransform()
  }
  return config
}

// Reads parts/parts-config.json, falling back to identity transforms for
// any part missing from the file (or if the file fails to parse) so a new
// PartKey or a hand-edit mistake never crashes the page.
export function createDefaultConfig(): CustomizerConfig {
  const config = identityConfig()
  try {
    const parsed = JSON.parse(partsConfigRaw) as Partial<Record<PartKey, Partial<PartTransform>>>
    return mergeOverrides(config, parsed)
  } catch (error) {
    console.error('parts-config.json is invalid JSON -- using identity transforms', error)
    return config
  }
}

// Merges any saved (localStorage) values over the file-backed defaults.
export function loadConfig(): CustomizerConfig {
  const config = createDefaultConfig()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return config
    const parsed = JSON.parse(raw) as Partial<Record<PartKey, Partial<PartTransform>>>
    return mergeOverrides(config, parsed)
  } catch {
    return config
  }
}

export function saveConfig(config: CustomizerConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

// Drops the browser-local override so the next loadConfig() reflects
// parts-config.json again.
export function clearSavedConfig(): void {
  localStorage.removeItem(STORAGE_KEY)
}
