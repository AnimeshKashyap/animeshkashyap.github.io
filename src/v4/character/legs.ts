// Modular "leg" layer: a hip-pivoted thigh with a nested knee-pivoted shin,
// so the walk cycle can rotate hip and knee independently. Thigh and shin
// are resolved independently from ./parts/thigh/ and ./parts/shin/ (SVG or
// PNG, see svgAssets.ts#resolvePart) and deliberately overlap and fade
// into each other at the knee -- see parts/README.md for the "dissolve
// joint" convention. Sizing/positioning are handled generically by
// character/partSizing.ts. The shoe is attached once inside the shin
// group. The far leg is darkened with a CSS filter rather than duplicating
// assets -- but each side still gets its OWN customizer control
// (data-part="thigh-back"/"-front" etc, see partAdjust.ts), since the
// shared asset is just the art, not the rig.
import { createSvgElement } from '../stage'
import { metrics } from './metrics'
import { wrapAdjustable } from './partAdjust'
import { buildShoe } from './shoes'
import { buildPartGroup } from './svgAssets'

export type LegSide = 'back' | 'front'

export interface LegRefs {
  hip: SVGGElement
  knee: SVGGElement
  ready: Promise<void>
}

export function buildLeg(side: LegSide): LegRefs {
  const hip = createSvgElement('g', { class: `char-leg char-leg-${side}` })
  const thigh = buildPartGroup('thigh', `thigh-${side}`)

  const knee = createSvgElement('g', { class: 'char-knee' })
  const shin = buildPartGroup('shin', `shin-${side}`)
  const shoe = buildShoe(side)
  shoe.mount.setAttribute('transform', `translate(0, ${metrics.shinLen})`)

  if (side === 'back') {
    hip.setAttribute('style', 'filter: brightness(0.74)')
  }

  knee.append(wrapAdjustable(`shin-${side}`, shin.group), shoe.mount)
  hip.append(wrapAdjustable(`thigh-${side}`, thigh.group), knee)

  const ready = Promise.all([thigh.ready, shin.ready, shoe.ready]).then(() => undefined)
  return { hip, knee, ready }
}
