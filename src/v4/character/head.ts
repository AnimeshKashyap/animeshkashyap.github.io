// Modular "head" layer -- looks for ./parts/head/head.svg first, falling
// back to ./parts/head/head.png (see svgAssets.ts#resolvePart). Sizing and
// positioning are handled generically by character/partSizing.ts, which
// runs once the character is attached and ready (see main.ts) -- no
// per-part normalize call needed here.
import { createSvgElement } from '../stage'
import { wrapAdjustable } from './partAdjust'
import { buildPartGroup } from './svgAssets'

export interface HeadBuild {
  group: SVGGElement
  ready: Promise<void>
}

export function buildHead(): HeadBuild {
  const g = createSvgElement('g', { class: 'char-head' })
  const part = buildPartGroup('head', 'head')
  g.appendChild(wrapAdjustable('head', part.group))
  return { group: g, ready: part.ready }
}
