// Generic part-asset loading: every part lives in its own folder under
// ./parts/<name>/, with one file per format (<name>.svg, <name>.png, ...).
// resolvePart() picks the first format present in FORMAT_PRECEDENCE -- add a
// new extension there (and a glob below) to support another format later.
import { SVG_NS } from '../stage'

// The shared asset name a part's art is loaded from -- same as the folder/
// file name under ./parts/. Distinct from partAdjust.ts's `PartKey`: a
// limb segment like upper-arm has ONE asset (this type) shared by its two
// split control keys ('upper-arm-back' / 'upper-arm-front') -- see
// partAdjust.ts#assetKeyFor for the mapping.
export type AssetKey =
  | 'head'
  | 'hair'
  | 'eye'
  | 'eyebrow'
  | 'ear'
  | 'glasses'
  | 'beard'
  | 'torso'
  | 'backpack'
  | 'upper-arm'
  | 'forearm'
  | 'thigh'
  | 'shin'
  | 'shoe'

const SVG_SOURCES = import.meta.glob('./parts/*/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const PNG_SOURCES = import.meta.glob('./parts/*/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const FORMAT_PRECEDENCE = ['svg', 'png'] as const
type PartFormat = (typeof FORMAT_PRECEDENCE)[number]

export interface PartAsset {
  format: PartFormat
  svgRaw?: string
  pngUrl?: string
}

export function resolvePart(name: AssetKey): PartAsset {
  for (const format of FORMAT_PRECEDENCE) {
    const path = `./parts/${name}/${name}.${format}`
    if (format === 'svg' && path in SVG_SOURCES) {
      return { format, svgRaw: SVG_SOURCES[path] }
    }
    if (format === 'png' && path in PNG_SOURCES) {
      return { format, pngUrl: PNG_SOURCES[path] }
    }
  }
  throw new Error(
    `No asset found for part "${name}" -- looked for ${FORMAT_PRECEDENCE.map((f) => `${name}.${f}`).join(', ')} in ./parts/${name}/`,
  )
}

// Inflates an authored .svg file's markup into a live <g> element, so the
// rig can place/rotate it like any other group. Each call gets a unique
// suffix appended to every id (and the url(#id) references that point at
// them) so the same source file can be instantiated more than once (e.g.
// the near/far arm) without colliding <defs> ids in the live document.
let instanceCounter = 0

export function inflateSvgGroup(svgMarkup: string, keyPrefix: string): SVGGElement {
  instanceCounter += 1
  const suffix = `-${keyPrefix}-${instanceCounter}`
  const namespaced = svgMarkup
    .replace(/id="([^"]+)"/g, (_match, id: string) => `id="${id}${suffix}"`)
    .replace(/url\(#([^)]+)\)/g, (_match, id: string) => `url(#${id}${suffix})`)

  const parsed = new DOMParser().parseFromString(namespaced, 'image/svg+xml')
  const source = parsed.documentElement
  const group = document.createElementNS(SVG_NS, 'g')
  Array.from(source.childNodes).forEach((node) => {
    group.appendChild(node.cloneNode(true))
  })
  return group
}

export interface PartGroup {
  group: SVGGElement
  // Resolves once the group's content has real dimensions (immediately for
  // SVG; after image decode for a raster format) -- await it before calling
  // anchorArtwork() so getBBox() sees the real size.
  ready: Promise<void>
}

// Builds a <g> for a part regardless of its source format (SVG or PNG,
// picked by resolvePart()'s precedence), so callers don't need to care
// which one is actually on disk for a given part. The returned group is
// always tagged `data-part-art="<name>"` so the generic normalization pass
// (character/partSizing.ts) can find and auto-fit it without each builder
// wiring that up by hand.
export function buildPartGroup(name: AssetKey, keyPrefix: string): PartGroup {
  const asset = resolvePart(name)

  let group: SVGGElement
  let ready: Promise<void>

  if (asset.format === 'svg' && asset.svgRaw) {
    group = inflateSvgGroup(asset.svgRaw, keyPrefix)
    ready = Promise.resolve()
  } else if (asset.format === 'png' && asset.pngUrl) {
    const url = asset.pngUrl
    group = document.createElementNS(SVG_NS, 'g')
    const image = document.createElementNS(SVG_NS, 'image')
    image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', url)
    image.setAttribute('href', url)
    image.setAttribute('width', '0')
    image.setAttribute('height', '0')
    group.appendChild(image)

    ready = new Promise<void>((resolve) => {
      const probe = new Image()
      probe.onload = () => {
        image.setAttribute('width', String(probe.naturalWidth))
        image.setAttribute('height', String(probe.naturalHeight))
        resolve()
      }
      // Fail open: anchorArtwork() no-ops on a zero-size bbox, so a broken
      // image just stays invisible instead of throwing.
      probe.onerror = () => resolve()
      probe.src = url
    })
  } else {
    throw new Error(`Unsupported asset format for part "${name}"`)
  }

  group.setAttribute('class', 'part-art')
  group.setAttribute('data-part-art', name)
  return { group, ready }
}

export interface AnchorOptions {
  /** Desired height (rig-local units) the artwork is scaled to fit. */
  targetHeight: number
  /** Which horizontal edge/center of the bbox maps to local x=0 (ignored if a #pivot marker exists). */
  xAnchor?: 'left' | 'center' | 'right'
  /** Which vertical edge of the bbox maps to local y=0 (ignored if a #pivot marker exists). */
  yAnchor?: 'top' | 'bottom'
}

export interface AnchorNudge {
  /** Extra shift of the anchor point, as a fraction of the artwork's own bbox width/height (0 = no shift). */
  x: number
  y: number
}

interface AnchorBase {
  bboxWidth: number
  bboxHeight: number
  anchorX: number
  anchorY: number
  targetHeight: number
}

// The #pivot marker (if any) is removed from the render the first time an
// element is fitted, so a later re-fit (e.g. the customizer live-nudging
// the anchor) can't re-query it -- cache the resolved base anchor per
// element instead, so this stays idempotent/re-callable.
const anchorBaseCache = new WeakMap<SVGGElement, AnchorBase>()

// Resolves (and caches) the part's base anchor point + bbox, independent of
// any nudge. Returns null if the artwork doesn't have real dimensions yet
// (e.g. a PNG still decoding) -- callers should no-op in that case rather
// than caching anything.
function resolveAnchorBase(art: SVGGElement, opts: AnchorOptions): AnchorBase | null {
  let base = anchorBaseCache.get(art)
  if (base) return base

  const bbox = art.getBBox()
  if (bbox.width === 0 || bbox.height === 0) return null

  const pivotMarker = art.querySelector<SVGGraphicsElement>('#pivot')
  let anchorX: number
  let anchorY: number

  if (pivotMarker) {
    const pivotBox = pivotMarker.getBBox()
    anchorX = pivotBox.x + pivotBox.width / 2
    anchorY = pivotBox.y + pivotBox.height / 2
    pivotMarker.remove()
  } else {
    const xFrac = opts.xAnchor === 'left' ? 0 : opts.xAnchor === 'right' ? 1 : 0.5
    anchorX = bbox.x + bbox.width * xFrac
    anchorY = opts.yAnchor === 'top' ? bbox.y : bbox.y + bbox.height
  }

  base = { bboxWidth: bbox.width, bboxHeight: bbox.height, anchorX, anchorY, targetHeight: opts.targetHeight }
  anchorBaseCache.set(art, base)
  return base
}

// Auto-scales/repositions an inflated part so artwork authored at any scale
// or offset (e.g. exported from an illustration tool, or a raster asset)
// lines up with the rig's joint at local (0, 0). MUST be called after `art`
// is connected to the live document AND its ready promise has resolved
// (getBBox() needs real layout + real content dimensions).
//
// If the artwork contains an element with id="pivot" (any shape -- a small
// circle is easiest to author, SVG only), that element's own center becomes
// the anchor point (and the marker is then removed from the render), which
// is far more precise than guessing from the overall bounding box.
// Otherwise xAnchor/yAnchor pick a corner/edge of the bounding box.
//
// `nudge` (customizer "Anchor X"/"Anchor Y") shifts that computed anchor by
// a fraction of the artwork's own bbox size, so it's resolution-independent
// -- re-callable any number of times without drifting, since the base
// anchor is only ever computed once. This MOVES the artwork (to keep the
// chosen anchor glued to the rig's fixed joint, so animation pivots
// correctly there) -- see previewAnchorScreenPoint() below for a read-only
// variant used while live-dragging, before the change is committed.
export function anchorArtwork(art: SVGGElement, opts: AnchorOptions, nudge: AnchorNudge = { x: 0, y: 0 }): void {
  const base = resolveAnchorBase(art, opts)
  if (!base) return

  const finalAnchorX = base.anchorX + nudge.x * base.bboxWidth
  const finalAnchorY = base.anchorY + nudge.y * base.bboxHeight
  const scale = base.targetHeight / base.bboxHeight
  art.setAttribute('transform', `scale(${scale}) translate(${-finalAnchorX}, ${-finalAnchorY})`)
}

// Read-only: where would the given (candidate) anchor nudge land on screen,
// given `art`'s CURRENT transform (i.e. without re-committing anything)?
// Used by the customizer to show a crosshair that actually slides across
// the artwork while a slider is being dragged -- anchorArtwork() always
// re-centers the artwork so the chosen anchor ends up at the SAME fixed
// joint location (by design, so the limb animates correctly), which means
// a crosshair reading that final position never visibly moves. This
// instead maps the candidate point through `art`'s own (frozen, since we
// don't call anchorArtwork during the drag) screen transform, so you see
// where that point actually falls on the artwork as currently drawn.
export function previewAnchorScreenPoint(art: SVGGElement, opts: AnchorOptions, nudge: AnchorNudge): { x: number; y: number } | null {
  const base = resolveAnchorBase(art, opts)
  const svg = art.ownerSVGElement
  const ctm = art.getScreenCTM()
  if (!base || !svg || !ctm) return null

  const finalAnchorX = base.anchorX + nudge.x * base.bboxWidth
  const finalAnchorY = base.anchorY + nudge.y * base.bboxHeight
  const point = svg.createSVGPoint()
  point.x = finalAnchorX
  point.y = finalAnchorY
  const screenPoint = point.matrixTransform(ctm)
  return { x: screenPoint.x, y: screenPoint.y }
}
