// Single generic normalization pass for every part, instead of each
// builder (head.ts, hair.ts, faceFeature.ts, torso.ts, arms.ts, legs.ts,
// shoes.ts) wiring up its own anchorArtwork() call. Every part art group
// gets tagged `data-part-art="<assetKey>"` by buildPartGroup() (svgAssets.ts);
// normalizeAllParts() just walks PART_KEYS and fits whatever is currently
// rendered for each one -- so dropping a new PNG into ANY part's folder
// gets a reasonable fit out of the box, with zero code changes.
//
// PART_SIZING is keyed by AssetKey (the shared SVG/PNG file), not by
// PartKey -- a limb segment's two split control keys (e.g. 'upper-arm-back'
// / 'upper-arm-front') both draw from, and are sized against, the same
// single 'upper-arm' asset (see partAdjust.ts#assetKeyFor).
//
// Hand-authored SVGs (torso, backpack, upper-arm, forearm, thigh, shin)
// carry an explicit `#pivot` marker (see parts/README.md) so normalizing
// them preserves their exact authored joint position -- only a (deliberately
// close-to-1) scale factor is derived from targetHeight below. If a part's
// proportions look slightly off after an art swap, adjust its targetHeight
// here rather than hand-tuning transforms in code.
//
// `anchorX`/`anchorY` (customizer sidebar + parts-config.json, per part)
// nudge that computed anchor further -- see svgAssets.ts#anchorArtwork.
import type { PartKey, PartTransform } from './partAdjust'
import { assetKeyFor, PART_KEYS } from './partAdjust'
import type { AnchorOptions, AssetKey } from './svgAssets'
import { anchorArtwork, previewAnchorScreenPoint } from './svgAssets'

export const PART_SIZING: Record<AssetKey, AnchorOptions> = {
  head: { targetHeight: 92, xAnchor: 'center', yAnchor: 'bottom' },
  hair: { targetHeight: 60, xAnchor: 'center', yAnchor: 'bottom' },
  eye: { targetHeight: 10, xAnchor: 'center', yAnchor: 'bottom' },
  eyebrow: { targetHeight: 5, xAnchor: 'center', yAnchor: 'bottom' },
  ear: { targetHeight: 16, xAnchor: 'center', yAnchor: 'bottom' },
  glasses: { targetHeight: 22, xAnchor: 'center', yAnchor: 'bottom' },
  beard: { targetHeight: 30, xAnchor: 'center', yAnchor: 'bottom' },
  torso: { targetHeight: 104, xAnchor: 'center', yAnchor: 'top' },
  backpack: { targetHeight: 84, xAnchor: 'center', yAnchor: 'top' },
  'upper-arm': { targetHeight: 58, xAnchor: 'center', yAnchor: 'top' },
  forearm: { targetHeight: 69, xAnchor: 'center', yAnchor: 'top' },
  thigh: { targetHeight: 94, xAnchor: 'center', yAnchor: 'top' },
  shin: { targetHeight: 94, xAnchor: 'center', yAnchor: 'top' },
  shoe: { targetHeight: 20, xAnchor: 'left', yAnchor: 'bottom' },
}

// Finds the single art element belonging to this (now always 1:1) part's
// wrapper -- every PartKey has exactly one `[data-part]` wrapper, which
// directly contains exactly one `[data-part-art]` element.
function artElementFor(part: PartKey): SVGGElement | null {
  const wrapper = document.querySelector<SVGGElement>(`[data-part="${part}"]`)
  return wrapper?.querySelector<SVGGElement>('[data-part-art]') ?? null
}

// Call once the character is connected to the live document AND its
// whenReady promise has resolved (see character/index.ts). `anchor` is the
// live anchorX/anchorY nudge for this part (defaults to no nudge) -- safe
// to call repeatedly (e.g. while dragging the customizer's anchor sliders).
export function normalizePart(part: PartKey, anchor: { x: number; y: number } = { x: 0, y: 0 }): void {
  const art = artElementFor(part)
  if (!art) return
  anchorArtwork(art, PART_SIZING[assetKeyFor(part)], anchor)
}

export function normalizeAllParts(config: Record<PartKey, PartTransform>): void {
  for (const part of PART_KEYS) {
    normalizePart(part, { x: config[part].anchorX, y: config[part].anchorY })
  }
}

// Read-only preview: where would `anchor` land on screen for this part,
// given its CURRENT (not yet re-fitted) artwork transform? Used by the
// customizer to show a crosshair that visibly slides across the artwork
// while dragging the Anchor X/Y sliders, before the change is committed via
// normalizePart() (see svgAssets.ts#previewAnchorScreenPoint for why this
// has to be a separate, non-mutating pass).
export function previewPartAnchor(part: PartKey, anchor: { x: number; y: number }): { x: number; y: number }[] {
  const art = artElementFor(part)
  if (!art) return []
  const point = previewAnchorScreenPoint(art, PART_SIZING[assetKeyFor(part)], anchor)
  return point ? [point] : []
}
