// Procedural walk cycle: no keyframes/sprites, just sinusoidal joint angles
// driven by a shared phase clock. Hips/shoulders swing opposite-phase,
// knees/elbows bend only on the forward swing (clamped sine), and the
// torso/head add a small double-bob per stride.
//
// Each joint's base position is `metrics.<...>` PLUS that limb segment's
// live `jointOffsetX/Y` (customizer -- see partAdjust.ts), read fresh every
// frame from `config` so a live slider drag is reflected immediately. This
// is the ONLY thing that can move a joint's actual rotation axis --
// anchorX/anchorY (svgAssets.ts) live inside this already-rotated frame
// and can only reposition content relative to a fixed axis, never move the
// axis itself (see parts/README.md's "Anchor vs. the actual joint").
import type { PartKey, PartTransform } from './partAdjust'
import { metrics } from './metrics'
import type { JointGroups } from './types'

const LEG_SWING_DEG = 26
const KNEE_BEND_DEG = 42
const ARM_SWING_DEG = 24
const ELBOW_BEND_DEG = 20
const BOB_PX = 4
const CYCLE_SPEED = 2.2 // radians of phase per second

export type WalkCycle = (t: number) => void

export function createWalkCycle(joints: JointGroups, config: Record<PartKey, PartTransform>): WalkCycle {
  return function update(t: number) {
    const phase = t * CYCLE_SPEED

    const frontLegAngle = LEG_SWING_DEG * Math.sin(phase)
    const backLegAngle = LEG_SWING_DEG * Math.sin(phase + Math.PI)
    const frontKneeAngle = KNEE_BEND_DEG * Math.max(0, Math.sin(phase - 0.6))
    const backKneeAngle = KNEE_BEND_DEG * Math.max(0, Math.sin(phase + Math.PI - 0.6))

    const frontArmAngle = ARM_SWING_DEG * Math.sin(phase + Math.PI)
    const backArmAngle = ARM_SWING_DEG * Math.sin(phase)
    // Negated vs. the knee formula: a positive rotation here bends the
    // forearm toward -x (back/left), but a natural elbow bends toward the
    // front (+x, the facing direction) as the arm swings, so flip the sign.
    const frontElbowAngle = -ELBOW_BEND_DEG * Math.max(0, Math.sin(phase + Math.PI - 0.6))
    const backElbowAngle = -ELBOW_BEND_DEG * Math.max(0, Math.sin(phase - 0.6))

    const bob = Math.abs(Math.sin(phase)) * BOB_PX
    // Same magnitude the hip angles swing by (frontLegAngle/backLegAngle
    // above are +/- this fraction of LEG_SWING_DEG) -- 0 when the legs are
    // together (passing each other), 1 when they're at their widest apart.
    const legSpreadFraction = Math.abs(Math.sin(phase))
    joints.shadowUpdate(legSpreadFraction)

    const thighFront = config['thigh-front']
    const thighBack = config['thigh-back']
    const shinFront = config['shin-front']
    const shinBack = config['shin-back']
    const upperArmFront = config['upper-arm-front']
    const upperArmBack = config['upper-arm-back']
    const forearmFront = config['forearm-front']
    const forearmBack = config['forearm-back']

    joints.legFrontHip.setAttribute(
      'transform',
      `translate(${metrics.centerX + thighFront.jointOffsetX}, ${metrics.hipY + thighFront.jointOffsetY}) rotate(${frontLegAngle})`,
    )
    joints.legFrontKnee.setAttribute(
      'transform',
      `translate(${shinFront.jointOffsetX}, ${metrics.thighLen + shinFront.jointOffsetY}) rotate(${frontKneeAngle})`,
    )
    joints.legBackHip.setAttribute(
      'transform',
      `translate(${metrics.centerX + thighBack.jointOffsetX}, ${metrics.hipY + thighBack.jointOffsetY}) rotate(${backLegAngle})`,
    )
    joints.legBackKnee.setAttribute(
      'transform',
      `translate(${shinBack.jointOffsetX}, ${metrics.thighLen + shinBack.jointOffsetY}) rotate(${backKneeAngle})`,
    )

    joints.armFrontShoulder.setAttribute(
      'transform',
      `translate(${metrics.centerX + upperArmFront.jointOffsetX}, ${metrics.armSocketY + upperArmFront.jointOffsetY}) rotate(${frontArmAngle})`,
    )
    joints.armFrontElbow.setAttribute(
      'transform',
      `translate(${forearmFront.jointOffsetX}, ${metrics.upperArmLen + forearmFront.jointOffsetY}) rotate(${frontElbowAngle})`,
    )
    joints.armBackShoulder.setAttribute(
      'transform',
      `translate(${metrics.centerX + upperArmBack.jointOffsetX}, ${metrics.armSocketY + upperArmBack.jointOffsetY}) rotate(${backArmAngle})`,
    )
    joints.armBackElbow.setAttribute(
      'transform',
      `translate(${forearmBack.jointOffsetX}, ${metrics.upperArmLen + forearmBack.jointOffsetY}) rotate(${backElbowAngle})`,
    )

    joints.torso.setAttribute('transform', `translate(${metrics.centerX}, ${metrics.shoulderY - bob})`)
    joints.head.setAttribute('transform', `translate(${metrics.centerX}, ${metrics.headAttachY - bob * 1.2})`)
  }
}
