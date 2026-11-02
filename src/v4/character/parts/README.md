# Character parts (editable SVGs / PNGs)

Each part lives in its own folder here, named after the part: `./<name>/
<name>.<ext>`. Open any of those files in Inkscape/Illustrator/Figma/
Photoshop/etc. and tweak it directly -- the rig (`../svgAssets.ts`) resolves
and loads them at build time via `import.meta.glob`, so adding or swapping a
file is enough, no code changes needed for a pure look change.

## `parts-config.json` -- position/rotation/scale, no code change needed

`parts-config.json` (this folder) holds the per-part `{ x, y, rotate, scale,
zIndex }` transform every part starts at (see `../../customizer/config.ts`).
It's read fresh on every page load, so to update where a part sits:

1. Open the customizer (gear icon, top-right of the v4 page), tweak a part
   until it looks right.
2. Click **Show JSON**, then **Copy to clipboard**.
3. Paste that JSON over the full contents of this file.
4. Reload the page -- no agent/code change required.

If a browser has an in-session **Save** (localStorage) on top of this file,
that browser's saved copy wins until you click **Use file defaults** in the
panel (or clear that browser's localStorage) -- that's what makes "Save"
useful for iterating before you're ready to commit a value into the file.

## Format precedence (SVG > PNG > ...)

`svgAssets.ts#resolvePart(name)` looks for `<name>.svg` first, then
`<name>.png`, in that order (the list lives in `FORMAT_PRECEDENCE` in that
file -- add another extension + a matching `import.meta.glob` there to
support a new format later, e.g. `.webp`). Whichever one exists wins; if a
folder has a `.svg` it is always preferred, so a `.png` left next to it as a
reference/fallback is simply ignored until the `.svg` is removed (or
renamed -- see `shoe/shoe_bkp.svg`, which is `shoe.svg` renamed out of the
way so `shoe.png` is the active asset).

Every part builder (`head.ts`, `hair.ts`, `faceFeature.ts`, `torso.ts`,
`arms.ts`, `legs.ts`, `shoes.ts`) goes through `buildPartGroup(name,
keyPrefix)` in `svgAssets.ts`, which returns a `{ group, ready }` pair --
`group` is usable immediately (SVG content or a placeholder-sized
`<image>`), `ready` resolves once real dimensions are known (instantly for
SVG, after image decode for a PNG), and is tagged `data-part-art="<name>"`
so the generic normalization pass below can find it.

`head/head_bkp.svg` and `shoe/shoe_bkp.svg` are inactive reference copies --
nothing imports them (folders aren't globbed by name, only
`<folder>/<folder>.<ext>` matches). Safe to delete or keep around for
comparison.

## Generic normalization -- every part, automatically

**`character/partSizing.ts`** is the single place that fits every part to
the rig: one `PART_SIZING` table (`{ targetHeight, xAnchor, yAnchor }` per
part) and one `normalizeAllParts()` call, run once from `main.ts` after the
character is attached to the stage **and** `whenReady` has resolved. This
means dropping a new PNG into *any* part's folder -- not just
head/hair/eye/eyebrow/ear/glasses/beard -- gets a reasonable fit out of the
box, with no per-part code to write.

How the fit is computed for a given part (`svgAssets.ts#anchorArtwork`):

- If the artwork contains an element with `id="pivot"` (any shape -- a tiny
  circle is easiest, SVG only), that element's own center becomes the exact
  anchor point (local `(0,0)`), and the marker is stripped before
  rendering. All of the hand-authored limb/torso SVGs (`torso`, `backpack`,
  `upper-arm`, `forearm`, `thigh`, `shin`) carry one of these, so swapping
  in a differently-scaled recreation of any of them still lines up exactly
  at the joint -- only the uniform scale (`targetHeight` vs. the new
  artwork's real height) might need a tweak in `partSizing.ts`.
- Otherwise it falls back to a bounding-box edge/center (`xAnchor`/
  `yAnchor` in `PART_SIZING`) -- used for `head`, `hair`, and the small
  facial features (`eye`, `eyebrow`, `ear`, `glasses`, `beard`), none of
  which have an inherent "correct" position to mark with a pivot. For
  these, treat `PART_SIZING`'s numbers as a rough starting point and use
  the customizer (see above) to dial in the real placement.

If a part's size looks slightly off after you swap in new art, the fix is
almost always a one-line edit to that part's `targetHeight` in
`character/partSizing.ts` -- not a transform hand-written into a builder.

### Nudging the anchor point (`anchorX` / `anchorY`)

Every part also has `anchorX`/`anchorY` in the customizer (and
`parts-config.json`) -- a fine nudge on top of whatever `anchorArtwork`
already computed (pivot marker or bbox edge/center above), expressed as a
fraction of the artwork's own bounding box (`-5` to `5`; e.g. `0.1` on
`anchorX` shifts the anchor 10% of the art's width further right, `1.0`
shifts a full bbox-width). Use this when a part's natural anchor is close
but not quite right -- e.g. a facial-feature PNG whose bbox-center guess is
a bit off, or a recreated limb SVG whose `#pivot` marker needs a small
correction without re-editing the file.

While dragging either Anchor X or Anchor Y in the sidebar, the artwork
itself stays frozen in place and a red crosshair slides across it live,
showing exactly which point you're choosing -- it keeps tracking every
frame, including through the walk cycle. The artwork only snaps into its
new, correctly joint-aligned position once you release the slider (or
blur/confirm the number field) -- it has to move then, since the whole
point of the anchor is to keep it glued to the rig's joint for animation,
which is a different on-screen spot than wherever you were just pointing
at mid-drag.

### Anchor vs. the actual joint -- these are NOT the same thing

`anchorX`/`anchorY` only decide **which pixel of the artwork** gets placed
at the joint -- they can never move the joint itself. The joint (the true,
fixed point a limb rotates around every frame) is set once, rig-wide, in
`character/metrics.ts` (`armSocketY` for both shoulders, `hipY` for both
hips) and applied every frame in `character/walkCycle.ts` as
`translate(centerX, armSocketY/hipY) rotate(angle)` -- `anchorArtwork`'s
transform lives two levels deeper (inside the art group, inside the
customizer's own offset wrapper, inside that joint group), so no amount of
anchor nudging reaches it.

If a limb's visual "weight" is landing in the wrong place relative to the
body (e.g. the arm's swing looks centered too high, nowhere near the
jacket's actual armhole) -- that's a joint-position problem, not an anchor
problem. Fix it with **Joint Offset X/Y** (see below), not `anchorY`.

For a PNG specifically (no `#pivot` marker possible, unlike SVG), the
anchor falls back entirely to `PART_SIZING`'s bbox edge/center
(`xAnchor`/`yAnchor`) -- same two-levels-deep limitation applies; it still
can't touch the joint.

### Moving the actual joint (`jointOffsetX` / `jointOffsetY`)

Only `upper-arm`, `forearm`, `thigh`, and `shin` (both sides each) get a
**Joint Offset X** / **Joint Offset Y** control in the customizer -- these
are the only parts that own a real kinematic joint (shoulder, elbow, hip,
knee respectively). Unlike every other field, this does NOT touch the
artwork's transform at all -- `character/walkCycle.ts` adds it directly to
that joint's base position (`metrics.armSocketY + jointOffsetY`, etc.)
every frame, moving the actual rotation axis. That's the one thing
`anchorX`/`anchorY` structurally can't do (see above): a translation nested
*inside* an already-rotated frame changes the apparent swing radius, not
the swing's center, whereas Joint Offset changes a translate that's applied
*before* the rotation -- a true rigid shift of the whole limb, same motion,
just relocated.

It's in the same rig-unit space as Offset X/Y (not a bbox fraction like the
anchor fields), and applies live as you drag -- no freeze/crosshair
dance needed, since there's no "pick a pixel" ambiguity to preview; the
joint's new position is exactly what you see.

`metrics.ts`'s `armSocketY`/`hipY` remain the shared baseline for both
sides of a limb; `jointOffsetX`/`jointOffsetY` is a further per-side nudge
on top, for e.g. correcting a left/right art asymmetry without touching the
shared rig geometry.

Not exposed for `shoe`, or for `head`/`torso`/`hair`/the facial
features/`backpack`: `shoe` has no rotation of its own (it just rides the
knee's swing via a static mount offset), and the others don't bend at all
in the walk cycle, so there's no separate "joint" distinct from their
regular position to move.

## Pivot convention (important -- don't move the origin)

Every part's artwork is drawn around local `(0, 0)` = the joint it attaches
at (see the table below). Hand-authored parts (`torso`, `backpack`,
`upper-arm`, `forearm`, `thigh`, `shin`) additionally carry an explicit
`id="pivot"` marker there (see "Generic normalization" above) -- don't move
or delete that marker when editing the art.

| Part | Pivot `(0,0)` is... | Facing |
|---|---|---|
| `torso` | shoulder/collar centerline | -- |
| `backpack` | same shoulder centerline as `torso` (bag sits on -x) | -- |
| `upper-arm` | shoulder | hangs down +y, fades out ~72%-100% |
| `forearm` | elbow | starts at -14 (overlapping the upper arm), cuff fades in 0%-60% |
| `thigh` | hip | hangs down +y, fades out ~76%-100% |
| `shin` | knee | starts at -16 (overlapping the thigh), fades in 0%-24% |
| `shoe` | ankle | toe points +x |

## Parts with no inherent position (`head`, `hair`, `eye`, `eyebrow`, `ear`, `glasses`, `beard`)

These are meant to be freely recreated/replaced -- different art tool,
different scale, different origin, even a different format (SVG vs. PNG) --
without hand-matching coordinates every time. `eye`, `eyebrow`, `ear`,
`glasses`, and `beard` are small facial-feature overlays added as children
of the head group (see `faceFeature.ts`) with *no* inherent correct
position on the face, unlike a limb's joint pivot, so they're expected to
be positioned entirely through the customizer (see `parts-config.json`
above), not hand-matched in the file.

## Reused assets, independent controls (near/far limbs)

`upper-arm`, `forearm`, `thigh`, `shin`, and `shoe` each have exactly ONE
asset file (used by both the near and far limb -- the rig darkens the far
instance with a CSS `filter: brightness(...)`, it does not duplicate the
file), but TWO independent customizer entries: e.g. **Upper Arm (Back)**
and **Upper Arm (Front)** in the part dropdown. Every field --
position/rotation/scale/zIndex/anchor -- is tunable separately per side;
there is no "shared" control for these parts. `parts-config.json` carries
one full entry per side (`upper-arm-back`, `upper-arm-front`, etc.) -- see
`character/partAdjust.ts`'s `PartKey` (the 19 control identities) vs
`character/svgAssets.ts`'s `AssetKey` (the 14 underlying files;
`assetKeyFor()` strips the `-back`/`-front` suffix to find which file a
split part draws from). Editing the one shared asset file still updates
both sides' look at once -- only position/rotation/scale/z-index/anchor are
independently tunable, not the artwork itself.

## The knee/elbow "dissolve" joint

Thigh/shin and upper-arm/forearm deliberately overlap: the upper segment is
drawn longer than its `metrics` bone length and fades to transparent near
its end; the lower segment starts before the joint and fades in from
transparent, and is rendered on top. The two fades blend into one
continuous limb instead of a hard seam. If you resize a segment, keep
roughly a 12-20px overlap + fade on both sides of the joint for the effect
to hold.

## Joint lengths live in code, not here

`character/metrics.ts` defines the *logical* joint distances (`thighLen`,
`shinLen`, `upperArmLen`, `forearmLen`, ...) that the rig uses to place the
next joint down the chain. If you resize a hand-authored limb's artwork
meaningfully, update the matching number in `metrics.ts` so the next joint
still lines up.

## Z-index (draw order) -- scoped to sibling groups, not global

Every part has a single `zIndex` (customizer sidebar, same place as
offset/rotation/scale; higher draws in front) -- exactly one control per
part, same as every other field, including for the split back/front limb
entries (see "Reused assets, independent controls" above: `upper-arm-back`
and `upper-arm-front` each get their OWN `zIndex`, letting you reorder the
near arm's segments without touching the far arm's).

`zIndex` does **not** work like a single global stacking order across the
whole character, though -- SVG paint order is DOM order, and limb segments
are kinematically nested (a shin's group must stay inside its knee group, a
forearm's inside its elbow group, so hip/knee and shoulder/elbow rotations
compose correctly for the walk cycle). Reordering those out of their
kinematic chain would break the animation. So `zIndex` only ever reorders
**siblings that already share one real DOM parent** -- see
`character/zOrder.ts`'s `ZGroup` list (built in `character/index.ts`):

- **Head overlays** -- `head`, `hair`, `ear`, `beard`, `eye`, `eyebrow`,
  `glasses` all sit directly on the head group with no kinematic
  dependency on each other, so these seven can be freely reordered (e.g.
  draw glasses in front of hair, or ear behind the head art).
- **Torso layers** -- `backpack` vs `torso`.
- **Head vs torso (top-level)** -- `head` and `torso` are each a single
  instance, so their zIndex also controls which one draws in front at the
  top level -- e.g. set `torso`'s zIndex above `head`'s to have the hoodie
  collar cover the chin.
- **Per-arm** -- `upper-arm-back` vs `forearm-back` (within the back arm),
  and `upper-arm-front` vs `forearm-front` (within the front arm) --
  entirely independent groups.
- **Per-leg** -- `thigh-back` vs `shin-back` (whole back lower leg + shoe
  as a unit), `shin-back` vs `shoe-back` (within the back knee), and the
  same pair for `-front`.

### The shared global space: head, torso, and the 4 limb roots

`head`, `torso`, `upper-arm-back`, `upper-arm-front`, `thigh-back`, and
`thigh-front` ALL sit in one more ZGroup, at the ROOT -- this is the actual
"everyone shares the same z-index space" scope: set `upper-arm-front`
above `torso` and the front arm genuinely draws in front of the torso.

Two things worth knowing about this group specifically:

- **`upper-arm-*`/`thigh-*` represent their WHOLE limb, not just that one
  segment.** A limb's shoulder/hip is the single point where it attaches to
  `root`, so raising `upper-arm-front`'s zIndex moves the entire front arm
  (forearm-front included) forward as one unit -- `forearm-front` can't be
  pulled to a different global depth than its own shoulder without
  unhooking it from the elbow's rotation, which would break the walk
  animation. Likewise `thigh-*` represents thigh+knee+shin+shoe together.
- **Because it's a real shared space, moving one part can shift it past
  OTHER parts you weren't targeting too** -- e.g. raising `torso` above its
  default also moves it in front of whichever leg currently has an equal or
  lower zIndex, not just past `head`. If you only want "A in front of B",
  it's worth checking where everything else in this group currently sits.

This does NOT make every individual segment (forearm, shin, shoe)
independently globally placeable -- see "The one hard limit" below.

### The one hard limit

Moving a whole limb (both legs, or both arms) in front of or behind the
torso/head is still a bigger, one-time structural decision made directly in
`character/index.ts`'s top-level `root.append(...)` order, not through the
customizer -- a limb is two separate PartKeys (back/front), not one unit a
single zIndex value could move together.
