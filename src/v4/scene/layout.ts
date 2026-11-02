// Shared ground-line geometry so scene layers and the character rig agree on
// where the ground sits on screen. Single source of truth -- main.ts reads
// this instead of hardcoding its own copy.
export const GROUND_MARGIN_PX = 70

export function groundScreenY(stageHeight: number): number {
  return stageHeight - GROUND_MARGIN_PX
}
