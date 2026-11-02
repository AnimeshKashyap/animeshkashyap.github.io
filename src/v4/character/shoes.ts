// Modular "shoe" layer -- resolved from ./parts/shoe/ (SVG or PNG, see
// svgAssets.ts#resolvePart), pivot at the ankle, toe pointing +x. Wrapped
// in a `data-part="shoe-back"`/`"shoe-front"` wrapper (see partAdjust.ts)
// for the live customizer -- each side has its own control even though
// both draw from the same shared asset file -- inside an outer "mount"
// group that legs.ts positions at the ankle -- kept separate so the
// customizer's transform never clobbers that positioning (or vice versa).
// Sizing/positioning within its own local space are handled generically by
// character/partSizing.ts.
import { createSvgElement } from '../stage'
import { wrapAdjustable } from './partAdjust'
import { buildPartGroup } from './svgAssets'

export interface ShoeBuild {
  mount: SVGGElement
  ready: Promise<void>
}

export function buildShoe(side: 'back' | 'front'): ShoeBuild {
  const part = buildPartGroup('shoe', `shoe-${side}`)
  const mount = createSvgElement('g', { class: 'char-shoe-mount' })
  mount.appendChild(wrapAdjustable(`shoe-${side}`, part.group))
  return { mount, ready: part.ready }
}
