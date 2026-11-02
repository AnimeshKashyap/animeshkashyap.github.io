// Modular "hair" layer -- separate from head.svg so a hair asset (SVG or
// PNG, see svgAssets.ts#resolvePart) can be swapped independently of the
// face/skull art. Rendered as a child of the head joint group (see
// index.ts), so it inherits the head's bob/position automatically. Sizing
// and positioning are handled generically by character/partSizing.ts.
import { createSvgElement } from '../stage'
import { wrapAdjustable } from './partAdjust'
import { buildPartGroup } from './svgAssets'

export interface HairBuild {
  group: SVGGElement
  ready: Promise<void>
}

export function buildHair(): HairBuild {
  const g = createSvgElement('g', { class: 'char-hair' })
  const part = buildPartGroup('hair', 'hair')
  g.appendChild(wrapAdjustable('hair', part.group))
  return { group: g, ready: part.ready }
}
