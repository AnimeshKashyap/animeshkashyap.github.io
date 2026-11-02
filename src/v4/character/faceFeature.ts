// Generic builder for small facial-feature overlays (eye, eyebrow, ear,
// beard, glasses) -- attached as children of the head group (see
// character/index.ts) so they inherit its bob/position. Sizing and
// positioning are handled generically by character/partSizing.ts; there's
// no reliable default placement for an isolated facial feature PNG/SVG, so
// positioning via the customizer sidebar (then "Show JSON"/parts-config.json)
// is the intended workflow for these.
import { createSvgElement } from '../stage'
import { wrapAdjustable } from './partAdjust'
import { buildPartGroup } from './svgAssets'

export interface FaceFeatureBuild {
  group: SVGGElement
  ready: Promise<void>
}

// These overlays are singleton (no back/front split, unlike a limb
// segment), so the same literal name works as both the PartKey (control
// identity) and the AssetKey (which file to load) -- this narrower type is
// assignable to both.
export type FaceFeatureKey = 'eye' | 'eyebrow' | 'ear' | 'glasses' | 'beard'

export function buildFaceFeature(name: FaceFeatureKey): FaceFeatureBuild {
  const g = createSvgElement('g', { class: `char-feature char-feature-${name}` })
  const part = buildPartGroup(name, name)
  g.appendChild(wrapAdjustable(name, part.group))
  return { group: g, ready: part.ready }
}
