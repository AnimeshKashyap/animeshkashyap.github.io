// Modular "arm" layer: a shoulder-pivoted upper arm with a nested
// elbow-pivoted forearm, mirroring the leg's hip/knee split. Upper arm and
// forearm are resolved independently from ./parts/upper-arm/ and
// ./parts/forearm/ (SVG or PNG, see svgAssets.ts#resolvePart) and overlap
// + fade into each other at the elbow -- same "dissolve joint" convention
// as the leg (see parts/README.md). Sizing/positioning are handled
// generically by character/partSizing.ts. The far arm is darkened with a
// CSS filter rather than duplicating the files -- but each side still gets
// its OWN customizer control (data-part="upper-arm-back"/"-front" etc, see
// partAdjust.ts), since the shared asset is just the art, not the rig.
import { createSvgElement } from '../stage'
import { wrapAdjustable } from './partAdjust'
import { buildPartGroup } from './svgAssets'

export type ArmSide = 'back' | 'front'

export interface ArmRefs {
  shoulder: SVGGElement
  elbow: SVGGElement
  ready: Promise<void>
}

export function buildArm(side: ArmSide): ArmRefs {
  const shoulder = createSvgElement('g', { class: `char-arm char-arm-${side}` })
  const upperArm = buildPartGroup('upper-arm', `upper-arm-${side}`)

  const elbow = createSvgElement('g', { class: 'char-elbow' })
  const forearm = buildPartGroup('forearm', `forearm-${side}`)

  if (side === 'back') {
    shoulder.setAttribute('style', 'filter: brightness(0.74)')
  }

  elbow.append(wrapAdjustable(`forearm-${side}`, forearm.group))
  shoulder.append(wrapAdjustable(`upper-arm-${side}`, upperArm.group), elbow)

  const ready = Promise.all([upperArm.ready, forearm.ready]).then(() => undefined)
  return { shoulder, elbow, ready }
}
