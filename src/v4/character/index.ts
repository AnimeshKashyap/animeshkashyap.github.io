// Assembles the modular parts into one character group, in back-to-front
// z-order for a side-scroller silhouette facing right: far leg, near leg,
// far arm, torso (+ backpack), head (+ hair/ear/eye/eyebrow/beard/glasses),
// near arm. This is only the INITIAL DOM order -- character/zOrder.ts's
// root-level ZGroup (below) re-sorts ALL of head/torso/upper-arm-back/
// upper-arm-front/thigh-back/thigh-front by zIndex on every mount/update,
// so the actual default appearance comes from their zIndex defaults in
// parts-config.json, not from this append() call.
import { createSvgElement } from '../stage'
import { buildArm } from './arms'
import { buildFaceFeature } from './faceFeature'
import { buildHair } from './hair'
import { buildHead } from './head'
import { buildLeg } from './legs'
import { metrics } from './metrics'
import { buildShadow } from './shadow'
import { buildTorso } from './torso'
import type { JointGroups } from './types'
import type { ZGroup } from './zOrder'

export interface Character {
  root: SVGGElement
  joints: JointGroups
  // Resolves once every part's artwork has real dimensions (immediate for
  // SVG, after image decode for any PNG-backed part) -- await before
  // calling character/partSizing.ts#normalizeAllParts().
  whenReady: Promise<void>
  // Customizer-tunable z-index scopes -- see character/zOrder.ts.
  zGroups: ZGroup[]
}

export function buildCharacter(): Character {
  const root = createSvgElement('g', { class: 'character' })

  const backLeg = buildLeg('back')
  const frontLeg = buildLeg('front')
  const backArm = buildArm('back')
  const frontArm = buildArm('front')
  const torsoBuild = buildTorso()
  const headBuild = buildHead()
  const shadowBuild = buildShadow()
  const hairBuild = buildHair()
  const earBuild = buildFaceFeature('ear')
  const eyeBuild = buildFaceFeature('eye')
  const eyebrowBuild = buildFaceFeature('eyebrow')
  const beardBuild = buildFaceFeature('beard')
  const glassesBuild = buildFaceFeature('glasses')
  // Order matters: later = drawn on top. Beard sits on the skin, glasses
  // sit over the eyes, on top of everything else on the face. This is the
  // INITIAL order only -- the "head overlays" z-group below lets the
  // customizer re-sort these same siblings live.
  headBuild.group.append(
    hairBuild.group,
    earBuild.group,
    beardBuild.group,
    eyeBuild.group,
    eyebrowBuild.group,
    glassesBuild.group,
  )

  backLeg.hip.setAttribute('transform', `translate(${metrics.centerX}, ${metrics.hipY})`)
  frontLeg.hip.setAttribute('transform', `translate(${metrics.centerX}, ${metrics.hipY})`)
  backArm.shoulder.setAttribute('transform', `translate(${metrics.centerX}, ${metrics.armSocketY})`)
  frontArm.shoulder.setAttribute('transform', `translate(${metrics.centerX}, ${metrics.armSocketY})`)

  // shadow goes first -- SVG paint order is DOM order, so this is the one
  // part that must be the character's very first child, drawn behind
  // every other part including both legs.
  root.append(shadowBuild.group, backLeg.hip, frontLeg.hip, backArm.shoulder, torsoBuild.group, headBuild.group, frontArm.shoulder)

  const joints: JointGroups = {
    root,
    head: headBuild.group,
    torso: torsoBuild.group,
    armBackShoulder: backArm.shoulder,
    armBackElbow: backArm.elbow,
    armFrontShoulder: frontArm.shoulder,
    armFrontElbow: frontArm.elbow,
    legBackHip: backLeg.hip,
    legBackKnee: backLeg.knee,
    legFrontHip: frontLeg.hip,
    legFrontKnee: frontLeg.knee,
    shadowUpdate: shadowBuild.update,
  }

  const whenReady = Promise.all([
    backLeg.ready,
    frontLeg.ready,
    backArm.ready,
    frontArm.ready,
    torsoBuild.ready,
    headBuild.ready,
    shadowBuild.ready,
    hairBuild.ready,
    earBuild.ready,
    eyeBuild.ready,
    eyebrowBuild.ready,
    beardBuild.ready,
    glassesBuild.ready,
  ]).then(() => undefined)

  // Each entry is a set of SIBLINGS sharing one real DOM parent -- the only
  // scope within which reordering is safe without breaking the walk
  // cycle's joint nesting (see zOrder.ts for how a part like "forearm-back"
  // still resolves correctly even though its own wrapper lives one level
  // deeper, inside the elbow group).
  //
  // The ROOT-level group is the one "global" shared z-index space: it
  // includes head, torso, AND one representative PartKey per limb --
  // "upper-arm-back"/"upper-arm-front" (the shoulder, i.e. the whole arm)
  // and "thigh-back"/"thigh-front" (the hip, i.e. the whole leg). A limb's
  // outermost joint IS the root-level ancestor for its entire subtree
  // (directChildFor walks up from any descendant -- e.g. "forearm-back" --
  // to the nearest ancestor that's a direct child of root, which is always
  // the shoulder/hip), so these 6 keys are enough to cover every part:
  // raising upper-arm-front's zIndex moves its WHOLE arm (including
  // forearm-front) as one unit, since forearm can't be pulled to a
  // different global depth than its own shoulder without breaking the
  // elbow's kinematic nesting. The `parts` order below is the fallback
  // when zIndex values tie (JS sort is stable) -- it reproduces the
  // original back-leg/back-arm/torso/head/front-leg/front-arm order so an
  // all-default (zIndex 0) character looks unchanged.
  const zGroups: ZGroup[] = [
    { parent: root, parts: ['thigh-back', 'upper-arm-back', 'torso', 'head', 'thigh-front', 'upper-arm-front'] },
    { parent: headBuild.group, parts: ['head', 'hair', 'ear', 'beard', 'eye', 'eyebrow', 'glasses'] },
    { parent: torsoBuild.group, parts: ['backpack', 'torso'] },
    { parent: backArm.shoulder, parts: ['upper-arm-back', 'forearm-back'] },
    { parent: frontArm.shoulder, parts: ['upper-arm-front', 'forearm-front'] },
    { parent: backLeg.hip, parts: ['thigh-back', 'shin-back'] },
    { parent: frontLeg.hip, parts: ['thigh-front', 'shin-front'] },
    { parent: backLeg.knee, parts: ['shin-back', 'shoe-back'] },
    { parent: frontLeg.knee, parts: ['shin-front', 'shoe-front'] },
  ]

  return { root, joints, whenReady, zGroups }
}
