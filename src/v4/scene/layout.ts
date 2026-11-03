// Shared ground-line geometry so scene layers and the character rig agree on
// where the ground sits on screen. Single source of truth -- main.ts reads
// this instead of hardcoding its own copy.
export const GROUND_MARGIN_PX = 70

export function groundScreenY(stageHeight: number): number {
  return stageHeight - GROUND_MARGIN_PX
}

// Every committed scene-config.json value (and the character's own x/y
// scene offset in main.ts) was tuned by eye on ONE specific browser
// window -- this is that window's size (Chrome inner width/height at the
// moment everything lined up correctly). Several of those tuned numbers
// are FLAT pixel nudges layered on top of artwork that itself scales
// proportionally with stageWidth/stageHeight (e.g. the platform graphic's
// rendered height is `stageHeight * someFraction`), so a flat nudge is
// only correct at this exact size -- on any other window, the nudge and
// the artwork it's correcting drift apart. widthScale()/heightScale()
// convert such a flat, reference-sized nudge into one that stays visually
// equivalent at any window size: multiply the stored value by the
// relevant scale() before adding it in.
//
// NOT every offset needs this treatment -- only ones added on top of a
// stageWidth/stageHeight-proportional quantity. Offsets added on top of a
// quantity that's already independent of window size (e.g. the
// character's OWN y offset, or the buildings' y offset -- both characters
// and buildings keep a FIXED pixel size regardless of window size, by
// design) are already window-size-invariant and must NOT be scaled, or
// scaling would introduce drift instead of removing it.
export const REFERENCE_STAGE_WIDTH = 2038.4
export const REFERENCE_STAGE_HEIGHT = 1142.4

export function widthScale(stageWidth: number): number {
  return stageWidth / REFERENCE_STAGE_WIDTH
}

export function heightScale(stageHeight: number): number {
  return stageHeight / REFERENCE_STAGE_HEIGHT
}
