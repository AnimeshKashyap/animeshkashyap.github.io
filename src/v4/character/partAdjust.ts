// Every customizable part gets wrapped in a `<g data-part="...">` by its
// builder (head.ts, hair.ts, faceFeature.ts, torso.ts, arms.ts, legs.ts,
// shoes.ts). This is a layer separate from both the joint transform
// (hip/knee/shoulder/elbow, owned by walkCycle.ts) and the head/hair/face
// auto-fit transform (anchorArtwork, owned by svgAssets.ts) -- the
// customizer only ever touches this wrapper, so it can't fight either of
// those.
//
// Limb segments that have a real back AND front instance (upper-arm,
// forearm, thigh, shin, shoe) are split into SEPARATE PartKeys per side
// (e.g. 'upper-arm-back' / 'upper-arm-front') rather than one shared key --
// every part then has exactly ONE instance and exactly ONE uniform set of
// controls (x/y/rotate/scale/zIndex/anchorX/anchorY), same as every other
// part. The underlying SVG/PNG file is still shared between both sides
// (see svgAssets.ts's separate `AssetKey` -- assetKeyFor() strips the
// `-back`/`-front` suffix to find it), so splitting controls does NOT mean
// duplicating art files.
//
// `zIndex` is NOT part of the transform string (translate/rotate/scale) --
// it's consumed separately by character/zOrder.ts, which actually reorders
// DOM siblings (SVG paint order = DOM order; there's no CSS z-index
// equivalent that reliably reorders plain <g> elements here).
import { createSvgElement } from '../stage'
import type { AssetKey } from './svgAssets'

export type PartKey =
  | 'head'
  | 'hair'
  | 'eye'
  | 'eyebrow'
  | 'ear'
  | 'glasses'
  | 'beard'
  | 'torso'
  | 'backpack'
  | 'upper-arm-back'
  | 'upper-arm-front'
  | 'forearm-back'
  | 'forearm-front'
  | 'thigh-back'
  | 'thigh-front'
  | 'shin-back'
  | 'shin-front'
  | 'shoe-back'
  | 'shoe-front'
  | 'shadow-base'
  | 'shadow-expanded'

export const PART_KEYS: PartKey[] = [
  'head',
  'hair',
  'eye',
  'eyebrow',
  'ear',
  'glasses',
  'beard',
  'torso',
  'backpack',
  'upper-arm-back',
  'upper-arm-front',
  'forearm-back',
  'forearm-front',
  'thigh-back',
  'thigh-front',
  'shin-back',
  'shin-front',
  'shoe-back',
  'shoe-front',
  'shadow-base',
  'shadow-expanded',
]

// Strips a trailing `-back`/`-front` to find the shared asset (SVG/PNG
// file + PART_SIZING entry) a split PartKey draws from -- e.g.
// 'upper-arm-back' -> 'upper-arm'. Parts with no split (head, torso, ...)
// are their own asset key already (identity).
export function assetKeyFor(part: PartKey): AssetKey {
  return part.replace(/-(back|front)$/, '') as AssetKey
}

export interface PartTransform {
  x: number
  y: number
  rotate: number
  scale: number
  zIndex: number
  anchorX: number
  anchorY: number
  // Shifts the ACTUAL joint (the fixed rotation axis the walk cycle swings
  // this limb around) -- NOT the artwork within it. Only meaningful for
  // the 4 parts that own a real joint (upper-arm/forearm/thigh/shin, one
  // per side); see character/walkCycle.ts and parts/README.md's "Anchor
  // vs. the actual joint" section for why this has to be a separate
  // mechanism from anchorX/anchorY -- those live inside the already-
  // rotated frame and can never move the axis itself, only reposition
  // content relative to it.
  jointOffsetX: number
  jointOffsetY: number
  // Generic opacity multiplier -- only exposed in the customizer for parts
  // that actually need it (currently just shadow-base/shadow-expanded, see
  // panel.ts's SHADOW_PARTS), but kept on the shared shape (default 1, no
  // visual change for every other part) rather than a shadow-only type, to
  // reuse the same Save/Reset/JSON plumbing every other field already has.
  opacity: number
  // Fully hides the part (display: none on its wrapper) when false --
  // distinct from `opacity` (which can still fade a VISIBLE part); this
  // skips rendering entirely. Customizer: one checkbox per part, applied
  // the same way as every other field, so Save/Reset/JSON all cover it
  // with no extra plumbing.
  enabled: boolean
}

export function defaultPartTransform(): PartTransform {
  return {
    x: 0,
    y: 0,
    rotate: 0,
    scale: 1,
    zIndex: 0,
    anchorX: 0,
    anchorY: 0,
    jointOffsetX: 0,
    jointOffsetY: 0,
    opacity: 1,
    enabled: true,
  }
}

export function wrapAdjustable(name: PartKey, inner: SVGGElement): SVGGElement {
  const wrapper = createSvgElement('g', { class: 'part-adjust', 'data-part': name })
  wrapper.appendChild(inner)
  return wrapper
}

// Applies position/rotation/scale to the (single) wrapper for a given
// part. Does NOT touch z-order -- see character/zOrder.ts#applyAllZOrdering
// for that.
export function applyPartTransform(name: PartKey, transform: PartTransform): void {
  const nodes = document.querySelectorAll<SVGGElement>(`[data-part="${name}"]`)
  const { x, y, rotate, scale, opacity, enabled } = transform
  nodes.forEach((node) => {
    node.setAttribute('transform', `translate(${x}, ${y}) rotate(${rotate}) scale(${scale})`)
    node.setAttribute('opacity', String(opacity))
    node.style.display = enabled ? '' : 'none'
  })
}
