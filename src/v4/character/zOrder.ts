// Z-index reordering, scoped to each natural sibling group instead of one
// global list -- SVG paint order is DOM order, and limb parts are
// kinematically nested (a shin MUST stay inside its knee group, a forearm
// inside its elbow group, so hip/knee/shoulder/elbow rotations compose
// correctly for the walk cycle). So z-index here only ever reorders
// SIBLINGS within the same existing parent; it never moves a part out of
// its kinematic chain.
//
// A part's zIndex can represent either its own wrapper (e.g. "thigh-back"
// within the hip's children) or, when the part's data-part marker lives
// deeper in the tree, the nearest ancestor that IS a direct child of the
// group's parent (e.g. "forearm-back" resolves to the whole elbow group
// when reordering within the shoulder, since the forearm wrapper itself
// lives inside elbow). This falls out automatically from walking up the
// DOM tree -- no special-casing needed per part.
//
// Limb segments (upper-arm/forearm/thigh/shin/shoe) are split into
// separate back/front PartKeys (see partAdjust.ts), so a part's zIndex is
// always unambiguous -- no side tagging needed here.
import type { PartKey } from './partAdjust'

export interface ZGroup {
  parent: SVGGElement
  parts: PartKey[]
}

function directChildFor(parent: SVGGElement, part: PartKey): SVGGElement | null {
  const marker = parent.querySelector<SVGGElement>(`[data-part="${part}"]`)
  let node: SVGGElement | null = marker
  // `Element.parentElement` is mistyped as `HTMLElement | null` in lib.dom.d.ts
  // even for SVG elements -- walk via `parentNode` instead so TS doesn't
  // flag an always-false comparison against `parent: SVGGElement`.
  while (node && node.parentNode !== parent) {
    node = node.parentNode as SVGGElement | null
  }
  return node
}

// Re-appends each group member in ascending zIndex order -- appendChild on
// an already-attached node moves it, so doing this in sorted order leaves
// the parent's children in the right final sequence (last appended = drawn
// last = on top).
export function applyZOrder(group: ZGroup, zIndexOf: (part: PartKey) => number): void {
  const entries = group.parts
    .map((part) => ({ part, node: directChildFor(group.parent, part) }))
    .filter((entry): entry is { part: PartKey; node: SVGGElement } => entry.node !== null)

  entries.sort((a, b) => zIndexOf(a.part) - zIndexOf(b.part))
  for (const entry of entries) {
    group.parent.appendChild(entry.node)
  }
}

export function applyAllZOrdering(groups: ZGroup[], zIndexOf: (part: PartKey) => number): void {
  for (const group of groups) {
    applyZOrder(group, zIndexOf)
  }
}
