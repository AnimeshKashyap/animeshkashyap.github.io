// Ground shadow, drawn first (behind every other part) so it always sits
// under the character. Unlike every other part, this one doesn't go
// through svgAssets.ts#buildPartGroup -- its folder holds two FIXED,
// differently-named files instead of the usual `<name>/<name>.<ext>`
// convention: `base.png` (a simple oval, the character's resting
// footprint shadow -- always visible) and `expanded.png` (a wider
// V-shaped shadow cast by both feet when a stride has the legs fully
// apart -- its own shape converges back toward the same center point as
// the oval, so scaling it down horizontally around that shared center and
// fading it out leaves exactly the oval behind).
//
// Both source images share the same canvas height, so a single uniform
// scale (by height) keeps them visually consistent with each other --
// `expanded` naturally renders proportionally wider than `base`, no
// separate width math needed before the per-frame expand fraction is
// applied on top.
import { createSvgElement } from '../stage'
import { metrics, groundY } from './metrics'
import { wrapAdjustable } from './partAdjust'

const SHADOW_SOURCES = import.meta.glob('./parts/shadow/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

type ShadowFile = 'base' | 'expanded'

function shadowUrl(file: ShadowFile): string {
  const path = `./parts/shadow/${file}.png`
  const url = SHADOW_SOURCES[path]
  if (!url) throw new Error(`Missing shadow asset: ${path} -- expected parts/shadow/base.png and parts/shadow/expanded.png`)
  return url
}

const SHADOW_DISPLAY_HEIGHT = 30 // rig units

function loadShadowImage(file: ShadowFile): { image: SVGImageElement; ready: Promise<void> } {
  const image = createSvgElement('image')
  const url = shadowUrl(file)
  image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', url)
  image.setAttribute('href', url)
  image.setAttribute('width', '0')
  image.setAttribute('height', '0')

  const ready = new Promise<void>((resolve) => {
    const probe = new Image()
    probe.onload = () => {
      const scale = SHADOW_DISPLAY_HEIGHT / probe.naturalHeight
      const width = probe.naturalWidth * scale
      const height = probe.naturalHeight * scale
      image.setAttribute('width', String(width))
      image.setAttribute('height', String(height))
      // Centered on the group's local (0,0) so both images -- and the
      // expand wrapper's horizontal scale below -- share the same center.
      image.setAttribute('x', String(-width / 2))
      image.setAttribute('y', String(-height / 2))
      resolve()
    }
    // Fail open, same convention as svgAssets.ts#buildPartGroup.
    probe.onerror = () => resolve()
    probe.src = url
  })

  return { image, ready }
}

export interface ShadowRefs {
  group: SVGGElement
  ready: Promise<void>
  /** 0 = legs together (expanded shadow fully hidden) .. 1 = legs fully apart (expanded shadow at full size/opacity). Clamped. */
  update: (expandFraction: number) => void
}

export function buildShadow(): ShadowRefs {
  const group = createSvgElement('g', { class: 'char-shadow' })
  group.setAttribute('transform', `translate(${metrics.centerX}, ${groundY})`)

  const base = loadShadowImage('base')
  const expanded = loadShadowImage('expanded')

  // A separate wrapper (rather than scaling the <image> directly) so the
  // scale always applies around local (0,0) regardless of how the image's
  // own x/y get set once its real size is known above.
  const expandedWrap = createSvgElement('g', { class: 'char-shadow-expanded' })
  expandedWrap.appendChild(expanded.image)

  // wrapAdjustable() gives each image its own `[data-part="shadow-..."]`
  // customizer wrapper -- Offset X/Y, Scale and Opacity (character
  // customizer sidebar) are applied to these OUTER wrappers by the same
  // generic applyPartTransform() every other part uses (see partAdjust.ts
  // -- 'shadow-base'/'shadow-expanded' are just two more PartKeys). The
  // expand wrapper's own dynamic scale/opacity (above, driven by the walk
  // cycle) lives one level INSIDE "shadow-expanded"'s wrapper, so the two
  // never fight: a customizer scale sets the overall max size, and the
  // per-frame expand fraction further shrinks width on top of that as the
  // legs come together.
  const baseInner = createSvgElement('g')
  baseInner.appendChild(base.image)
  const baseAdjust = wrapAdjustable('shadow-base', baseInner)
  const expandedAdjust = wrapAdjustable('shadow-expanded', expandedWrap)

  group.append(baseAdjust, expandedAdjust)

  function update(expandFraction: number): void {
    const f = Math.max(0, Math.min(1, expandFraction))
    expandedWrap.setAttribute('transform', `scale(${f}, 1)`)
    expandedWrap.setAttribute('opacity', String(f))
  }
  update(0)

  const ready = Promise.all([base.ready, expanded.ready]).then(() => undefined)
  return { group, ready, update }
}
