// A scene is a stack of infinitely-looping horizontal parallax layers,
// furthest first. Each layer is defined as one repeatable tile -- the
// engine (parallaxLayer.ts) handles cloning it sideways and scrolling it.
export interface SceneLayer {
  /** Width (px) of one repeatable tile. Content inside must line up at x=0 and x=tileWidth. */
  tileWidth: number
  /**
   * Relative scroll speed vs. the scene's base ground speed.
   * 1 = foreground/ground (moves at the character's apparent stride rate),
   * < 1 = further back (slower, classic parallax depth cue).
   */
  speedFactor: number
  /** Builds one tile instance. `index` is a stable per-tile seed for deterministic variation (not randomness). */
  buildTile: (index: number) => SVGGElement
}


