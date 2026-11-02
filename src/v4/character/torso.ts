// Modular "torso" layer -- hoodie look resolved from ./parts/torso/, the
// backpack from ./parts/backpack/ (same shoulder pivot, drawn behind the
// hoodie since the character faces right and the bag sits on its back).
// Sizing and positioning are handled generically by character/partSizing.ts.
import { createSvgElement } from '../stage'
import { wrapAdjustable } from './partAdjust'
import { buildPartGroup } from './svgAssets'

export interface TorsoBuild {
  group: SVGGElement
  ready: Promise<void>
}

export function buildTorso(): TorsoBuild {
  const g = createSvgElement('g', { class: 'char-torso' })
  const backpack = buildPartGroup('backpack', 'backpack')
  const torso = buildPartGroup('torso', 'torso')
  g.append(wrapAdjustable('backpack', backpack.group), wrapAdjustable('torso', torso.group))
  const ready = Promise.all([backpack.ready, torso.ready]).then(() => undefined)
  return { group: g, ready }
}
