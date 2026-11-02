// Turns one SceneLayer definition into a live, scrollable DOM group: lays
// out enough tile copies side by side to cover the viewport (plus slack for
// the scroll offset), then on every update() just translates the whole
// group by the scrolled distance modulo one tile width -- because adjacent
// tiles are identical, wrapping the offset is visually seamless and never
// needs rebuilding mid-scroll.
import type { SceneLayer } from './types'

export interface LiveLayer {
  group: SVGGElement
  update: (elapsedSeconds: number, basePxPerSecond: number) => void
}

export function createParallaxLayer(layer: SceneLayer, minCoverageWidth: number): LiveLayer {
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  group.setAttribute('class', 'scene-layer')

  // update() shifts the WHOLE group left by `wrapped`, which ranges over
  // [0, tileWidth) -- so at the worst instant (wrapped just under
  // tileWidth, a moment before it wraps back to 0) the rightmost edge of
  // the rendered tiles has to reach all the way to tileWidth + the full
  // viewport width, or there's nothing left to show past that point for
  // the rest of this frame -- a gap straight through to the scene's dark
  // backdrop. That means the number of tile copies must satisfy
  // `(copies - 1) * tileWidth >= minCoverageWidth`, i.e.
  // `copies >= minCoverageWidth / tileWidth + 1`. `tilesForViewport` below
  // is exactly `ceil(minCoverageWidth / tileWidth)`, so `+ 1` on top of
  // that is already the mathematically-required minimum -- `+ 3` adds a
  // healthy safety margin on top (covers e.g. a viewport resize to
  // something wider than what this layer was last built for, before the
  // next resize() call rebuilds it).
  const tilesForViewport = Math.max(1, Math.ceil(minCoverageWidth / layer.tileWidth))
  const copies = Math.max(4, tilesForViewport + 3)
  for (let i = 0; i < copies; i++) {
    const tile = layer.buildTile(i)
    tile.setAttribute('transform', `translate(${i * layer.tileWidth}, 0)`)
    group.appendChild(tile)
  }

  function update(elapsedSeconds: number, basePxPerSecond: number) {
    const scrollPx = elapsedSeconds * basePxPerSecond * layer.speedFactor
    const wrapped = ((scrollPx % layer.tileWidth) + layer.tileWidth) % layer.tileWidth
    group.setAttribute('transform', `translate(${-wrapped}, 0)`)
  }

  return { group, update }
}
