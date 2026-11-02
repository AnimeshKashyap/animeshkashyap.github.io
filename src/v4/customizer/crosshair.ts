// Floating HTML crosshair overlay -- shown while dragging a part's
// Anchor X/Y sliders in the customizer, so the exact pivot point an art
// swap/anchor nudge lines up to is visible, not just inferred. Positioned
// in raw viewport pixels (position: fixed), independent of the SVG stage's
// own coordinate system.
export interface Crosshair {
  show(points: { x: number; y: number }[]): void
  hide(): void
}

export function createCrosshair(container: HTMLElement): Crosshair {
  const layer = document.createElement('div')
  layer.className = 'char-anchor-crosshair-layer'
  layer.hidden = true
  container.appendChild(layer)

  return {
    show(points) {
      layer.innerHTML = ''
      for (const point of points) {
        const mark = document.createElement('div')
        mark.className = 'char-anchor-crosshair'
        mark.style.left = `${point.x}px`
        mark.style.top = `${point.y}px`
        mark.innerHTML =
          '<span class="char-anchor-crosshair__h"></span>' +
          '<span class="char-anchor-crosshair__v"></span>' +
          '<span class="char-anchor-crosshair__dot"></span>'
        layer.appendChild(mark)
      }
      layer.hidden = points.length === 0
    },
    hide() {
      layer.innerHTML = ''
      layer.hidden = true
    },
  }
}

// A part's anchor, once committed (see svgAssets.ts#anchorArtwork), always
// ends up at local (0, 0) of its `[data-part="name"]` wrapper by
// construction -- which is why the crosshair can't simply read that
// wrapper's position while dragging (it never moves). See
// character/partSizing.ts#previewPartAnchor for the live-drag preview.
