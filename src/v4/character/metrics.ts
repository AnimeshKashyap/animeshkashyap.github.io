// Single source of truth for the rig's joint positions and bone lengths.
// Part builders load their look from ./parts/*.svg (see parts/README.md);
// this file only controls where joints sit and how far apart they are.
export const metrics = {
  centerX: 80,
  shoulderY: 80,
  // Separate from `shoulderY` on purpose: that one also positions the
  // torso's attachment point (see walkCycle.ts), so bumping it would shift
  // the torso too. This is the arms' ACTUAL rotation axis -- the true
  // "stable joint" the shoulder swings around every frame (walkCycle.ts)
  // -- distinct from anchorX/anchorY (customizer, per-part), which only
  // pick which pixel of the artwork sits at this already-fixed point and
  // can never move the point itself.
  armSocketY: 85,
  headAttachY: 76,
  hipY: 170,
  thighLen: 78,
  shinLen: 78,
  upperArmLen: 44,
  forearmLen: 46,
}

export const ankleY = metrics.hipY + metrics.thighLen + metrics.shinLen
export const groundY = ankleY + 18 // clears the shoe sole drawn in parts/shoe.svg
export const CHAR_WIDTH = 170
export const CHAR_HEIGHT = groundY + 10
