// Refs to every animatable joint group, handed from the assembled character
// to the walk cycle so it can drive each layer independently.
export interface JointGroups {
  root: SVGGElement
  head: SVGGElement
  torso: SVGGElement
  armBackShoulder: SVGGElement
  armBackElbow: SVGGElement
  armFrontShoulder: SVGGElement
  armFrontElbow: SVGGElement
  legBackHip: SVGGElement
  legBackKnee: SVGGElement
  legFrontHip: SVGGElement
  legFrontKnee: SVGGElement
  /** Drives the ground shadow's expanded (both-legs-apart) state -- see character/shadow.ts. 0 = legs together .. 1 = fully apart. */
  shadowUpdate: (expandFraction: number) => void
}
