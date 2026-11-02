// Fullscreen SVG "canvas" stage. Everything in v4 (character now, scene/props
// later) is drawn into this one <svg> so it can be freely layered and scaled.

export const SVG_NS = 'http://www.w3.org/2000/svg'

export function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag)
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value))
  }
  return el
}

export interface Stage {
  svg: SVGSVGElement
  width: number
  height: number
}

export function createStage(container: HTMLElement): Stage {
  const svg = createSvgElement('svg', {
    width: '100%',
    height: '100%',
    preserveAspectRatio: 'none',
  })
  container.appendChild(svg)

  const stage: Stage = { svg, width: window.innerWidth, height: window.innerHeight }

  const resize = () => {
    stage.width = window.innerWidth
    stage.height = window.innerHeight
    svg.setAttribute('viewBox', `0 0 ${stage.width} ${stage.height}`)
  }
  resize()
  window.addEventListener('resize', resize)

  return stage
}
