// Floating HTML overlay (not SVG -- plain positioned elements over the
// stage): a small round toggle button docked at the top-right edge opens a
// sliding right-hand sidebar for live-tweaking each part's
// position/rotation/scale/z-index/anchor point (and, for limb segments
// that own a real joint, the joint itself). All top-level actions are icon
// buttons beside the title (left to right): Save (checkmark, disabled
// unless the live config differs from the last saved/loaded snapshot),
// Reset this part, Restore everything from parts-config.json, Show JSON
// (opens ../jsonModal.ts's modal with Copy to clipboard) -- no buttons
// below the field list.
//
// Limb segments with a back/front instance (upper-arm, forearm, thigh,
// shin, shoe) are simply separate entries in the dropdown (see
// partAdjust.ts's split PartKeys), each with its own full set of fields.
import './panel.css'
import { applyPartTransform, PART_KEYS } from '../character/partAdjust'
import type { PartKey, PartTransform } from '../character/partAdjust'
import { normalizePart, previewPartAnchor } from '../character/partSizing'
import { applyAllZOrdering } from '../character/zOrder'
import type { ZGroup } from '../character/zOrder'
import { createJsonModal } from '../jsonModal'
import { clearSavedConfig, createDefaultConfig, saveConfig } from './config'
import type { CustomizerConfig } from './config'
import { createCrosshair } from './crosshair'

const PART_LABELS: Record<PartKey, string> = {
  head: 'Head',
  hair: 'Hair',
  eye: 'Eye',
  eyebrow: 'Eyebrow',
  ear: 'Ear',
  glasses: 'Glasses',
  beard: 'Beard',
  torso: 'Torso',
  backpack: 'Backpack',
  'upper-arm-back': 'Upper Arm (Back)',
  'upper-arm-front': 'Upper Arm (Front)',
  'forearm-back': 'Forearm (Back)',
  'forearm-front': 'Forearm (Front)',
  'thigh-back': 'Thigh (Back)',
  'thigh-front': 'Thigh (Front)',
  'shin-back': 'Shin (Back)',
  'shin-front': 'Shin (Front)',
  'shoe-back': 'Shoe (Back)',
  'shoe-front': 'Shoe (Front)',
  'shadow-base': 'Shadow (Base)',
  'shadow-expanded': 'Shadow (Expanded)',
}

// One glyph per part for the chip row (chip tooltip is the full
// PART_LABELS name, so the glyph only needs to be roughly recognizable,
// not self-explanatory). Split back/front (and shadow base/expanded)
// instances share one glyph -- badgeFor() below adds a small corner
// letter so the two chips are still visually distinct at a glance.
const PART_ICONS: Record<PartKey, string> = {
  head: '\u{1F642}',
  hair: '\u{1F487}',
  eye: '\u{1F441}\uFE0F',
  eyebrow: '\u3030\uFE0F',
  ear: '\u{1F442}',
  glasses: '\u{1F453}',
  beard: '\u{1F9D4}',
  torso: '\u{1F455}',
  backpack: '\u{1F392}',
  'upper-arm-back': '\u{1F4AA}',
  'upper-arm-front': '\u{1F4AA}',
  'forearm-back': '\u270A',
  'forearm-front': '\u270A',
  'thigh-back': '\u{1F9B5}',
  'thigh-front': '\u{1F9B5}',
  'shin-back': '\u{1F9B4}',
  'shin-front': '\u{1F9B4}',
  'shoe-back': '\u{1F45F}',
  'shoe-front': '\u{1F45F}',
  'shadow-base': '\u{1F463}',
  'shadow-expanded': '\u{1F463}',
}

function badgeFor(part: PartKey): string | null {
  if (part.endsWith('-back')) return 'B'
  if (part.endsWith('-front')) return 'F'
  if (part === 'shadow-base') return 'B'
  if (part === 'shadow-expanded') return 'E'
  return null
}

// Shadow parts don't have a joint, an anchor-artwork pivot, or a z-order
// group (see character/shadow.ts) -- they only ever need position/scale/
// opacity, so Rotation/Z-Index/Anchor X/Anchor Y are hidden for them below
// and Opacity (otherwise hidden -- every other part stays fully opaque) is
// shown only for them.
const SHADOW_PARTS = new Set<PartKey>(['shadow-base', 'shadow-expanded'])

// The only parts that own a real kinematic joint (shoulder/elbow/hip/knee)
// -- walkCycle.ts applies a fixed translate() for each of these BEFORE
// rotating, so (and only so) their jointOffsetX/Y can move the actual
// rotation axis. Every other part (including shoe, which just rides the
// knee's rotation with a static mount offset, no rotation of its own) has
// no such axis to move, so the Joint Offset fields are hidden for them.
const JOINT_OWNING_PARTS = new Set<PartKey>([
  'upper-arm-back',
  'upper-arm-front',
  'forearm-back',
  'forearm-front',
  'thigh-back',
  'thigh-front',
  'shin-back',
  'shin-front',
])

type Field = keyof PartTransform

interface FieldSpec {
  key: Field
  label: string
  min: number
  max: number
  step: number
  // Anchor fields show a live crosshair on the stage while being dragged,
  // marking the exact point the artwork is currently anchored at.
  isAnchor?: boolean
  // Only shown for parts where this predicate returns true (default: all
  // parts) -- used for Joint Offset X/Y, which only make sense for parts
  // with a real joint (see JOINT_OWNING_PARTS above).
  visibleFor?: (part: PartKey) => boolean
}

const FIELD_SPECS: FieldSpec[] = [
  { key: 'x', label: 'Offset X', min: -150, max: 150, step: 0.1 },
  { key: 'y', label: 'Offset Y', min: -150, max: 150, step: 0.1 },
  { key: 'rotate', label: 'Rotation', min: -180, max: 180, step: 0.1, visibleFor: (part) => !SHADOW_PARTS.has(part) },
  { key: 'scale', label: 'Scale', min: 0.2, max: 2.5, step: 0.01 },
  { key: 'opacity', label: 'Opacity', min: 0, max: 1, step: 0.01, visibleFor: (part) => SHADOW_PARTS.has(part) },
  { key: 'zIndex', label: 'Z-Index', min: -10, max: 10, step: 1, visibleFor: (part) => !SHADOW_PARTS.has(part) },
  { key: 'anchorX', label: 'Anchor X', min: -5, max: 5, step: 0.01, isAnchor: true, visibleFor: (part) => !SHADOW_PARTS.has(part) },
  { key: 'anchorY', label: 'Anchor Y', min: -5, max: 5, step: 0.01, isAnchor: true, visibleFor: (part) => !SHADOW_PARTS.has(part) },
  {
    key: 'jointOffsetX',
    label: 'Joint Offset X',
    min: -150,
    max: 150,
    step: 0.1,
    visibleFor: (part) => JOINT_OWNING_PARTS.has(part),
  },
  {
    key: 'jointOffsetY',
    label: 'Joint Offset Y',
    min: -150,
    max: 150,
    step: 0.1,
    visibleFor: (part) => JOINT_OWNING_PARTS.has(part),
  },
]

function flashStatus(el: HTMLElement, text: string, ms = 1600): void {
  el.textContent = text
  window.setTimeout(() => {
    if (el.textContent === text) el.textContent = ''
  }, ms)
}

// Applies `config` to the live character and mounts the toggle button +
// sidebar into `container`. Call once, after the character has been built
// and appended. `config` is the SAME object main.ts passes to
// createWalkCycle() -- mutating it here is read live by the walk cycle
// every frame (for jointOffsetX/Y), so a slider drag needs no extra apply
// step for those two fields. `zGroups` are the customizer-tunable z-index
// sibling scopes from character/index.ts.
export function mountCustomizer(container: HTMLElement, zGroups: ZGroup[], config: CustomizerConfig): void {
  const zIndexOf = (part: PartKey) => config[part].zIndex

  for (const key of PART_KEYS) {
    applyPartTransform(key, config[key])
  }
  applyAllZOrdering(zGroups, zIndexOf)
  // NOT calling normalizePart() here: main.ts already does the one-off
  // initial anchor fit after `whenReady` resolves (so PNG parts have real,
  // decoded dimensions). Doing it again here, synchronously at mount
  // (before PNGs are guaranteed decoded), would risk anchorArtwork's cache
  // locking in a garbage placeholder bbox. normalizePart() is only called
  // reactively below, in response to user interaction well after mount.

  // Selection order matters: selectedParts[0] is the "primary" part --
  // its values are what every control displays, and what previewPartAnchor
  // crosshairs preview. Plain click replaces the whole selection with just
  // that one part; Ctrl/Cmd-click toggles a part in/out of the existing
  // selection (multi-select) without changing which one is primary, unless
  // the primary itself gets toggled off, in which case the next one in
  // selection order becomes primary. See handleChipClick() below.
  let selectedParts: PartKey[] = [PART_KEYS[0]]
  const primaryPart = (): PartKey => selectedParts[0]

  const crosshair = createCrosshair(container)
  let crosshairRaf: number | null = null

  function stopCrosshair(): void {
    if (crosshairRaf !== null) cancelAnimationFrame(crosshairRaf)
    crosshairRaf = null
    crosshair.hide()
  }

  // Shows a crosshair that tracks the CANDIDATE (not-yet-committed) anchor
  // value live -- see svgAssets.ts#previewAnchorScreenPoint for why this
  // has to read the artwork's current (frozen) transform rather than the
  // final, always-fixed joint position. Runs every frame (not just on
  // input) so it keeps tracking the walk cycle while held. Only previews
  // the PRIMARY part even when multiple are selected -- one crosshair,
  // not one per selected part.
  function startCrosshair(): void {
    stopCrosshair()
    const tick = () => {
      const part = primaryPart()
      crosshair.show(previewPartAnchor(part, { x: config[part].anchorX, y: config[part].anchorY }))
      crosshairRaf = requestAnimationFrame(tick)
    }
    tick()
  }

  const toggleButton = document.createElement('button')
  toggleButton.type = 'button'
  toggleButton.className = 'char-customizer-toggle'
  toggleButton.textContent = '\u2699\uFE0F'
  toggleButton.setAttribute('aria-label', 'Open character customizer')
  toggleButton.setAttribute('aria-expanded', 'false')

  const sidebar = document.createElement('aside')
  sidebar.className = 'char-customizer'

  function setOpen(open: boolean): void {
    sidebar.classList.toggle('is-open', open)
    toggleButton.setAttribute('aria-expanded', String(open))
    toggleButton.textContent = open ? '\u2715' : '\u2699\uFE0F'
    toggleButton.setAttribute('aria-label', open ? 'Close character customizer' : 'Open character customizer')
    if (!open) stopCrosshair()
  }

  toggleButton.addEventListener('click', () => {
    setOpen(!sidebar.classList.contains('is-open'))
  })

  const title = document.createElement('div')
  title.className = 'char-customizer__title'
  title.textContent = 'Character Customizer'

  const jsonModal = createJsonModal(container, 'Character Customizer JSON')

  const titleStatus = document.createElement('div')
  titleStatus.className = 'char-customizer__title-status'

  // Disabled unless the live config actually differs from the last
  // saved/loaded snapshot -- see refreshSaveState()/savedSnapshot below.
  const saveIconButton = document.createElement('button')
  saveIconButton.type = 'button'
  saveIconButton.className = 'char-customizer__icon-btn'
  saveIconButton.textContent = '\u2713'
  saveIconButton.title = 'Save'
  saveIconButton.setAttribute('aria-label', 'Save')
  saveIconButton.addEventListener('click', () => {
    saveConfig(config)
    savedSnapshot = JSON.stringify(config)
    refreshSaveState()
    flashStatus(titleStatus, 'Saved \u2713')
  })

  const resetPartIconButton = document.createElement('button')
  resetPartIconButton.type = 'button'
  resetPartIconButton.className = 'char-customizer__icon-btn'
  resetPartIconButton.textContent = '\u21BA'
  resetPartIconButton.title = 'Reset this part'
  resetPartIconButton.setAttribute('aria-label', 'Reset this part')
  resetPartIconButton.addEventListener('click', () => {
    resetPart()
  })

  // Different icon from Reset Part's \u21BA on purpose -- this one reloads
  // EVERYTHING from parts-config.json (and drops this browser's saved
  // overrides), not just the selected part.
  const restoreFromFileIconButton = document.createElement('button')
  restoreFromFileIconButton.type = 'button'
  restoreFromFileIconButton.className = 'char-customizer__icon-btn'
  restoreFromFileIconButton.textContent = '\u{1F4C2}'
  restoreFromFileIconButton.title = 'Restore all parts from parts-config.json'
  restoreFromFileIconButton.setAttribute('aria-label', 'Restore all parts from parts-config.json')
  restoreFromFileIconButton.addEventListener('click', () => {
    restoreFromFile()
  })

  const jsonIconButton = document.createElement('button')
  jsonIconButton.type = 'button'
  jsonIconButton.className = 'char-customizer__icon-btn'
  jsonIconButton.textContent = '{}'
  jsonIconButton.title = 'Show JSON'
  jsonIconButton.setAttribute('aria-label', 'Show JSON')
  jsonIconButton.addEventListener('click', () => {
    jsonModal.open(JSON.stringify(config, null, 2))
  })

  const titleRow = document.createElement('div')
  titleRow.className = 'char-customizer__title-row'
  const titleActions = document.createElement('div')
  titleActions.className = 'char-customizer__title-actions'
  titleActions.append(saveIconButton, resetPartIconButton, restoreFromFileIconButton, jsonIconButton)
  titleRow.append(title, titleActions)

  // Chip row replaces the old <select> dropdown: one icon button per part
  // (PART_ICONS + badgeFor's corner letter for split back/front/base/
  // expanded instances), tooltip = the full PART_LABELS name. Plain click
  // selects just that chip; Ctrl/Cmd-click toggles it into/out of a
  // multi-selection (see selectedParts/primaryPart above) so e.g. every
  // face part can be nudged or scaled together in one drag.
  const chipsWrap = document.createElement('div')
  chipsWrap.className = 'char-customizer__chips'
  const chipButtons = {} as Record<PartKey, HTMLButtonElement>

  function updateChipSelectionUI(): void {
    for (const key of PART_KEYS) {
      chipButtons[key].classList.toggle('is-selected', selectedParts.includes(key))
      chipButtons[key].classList.toggle('is-primary', key === primaryPart())
    }
  }

  function handleChipClick(key: PartKey, multi: boolean): void {
    stopCrosshair()
    if (!multi) {
      selectedParts = [key]
    } else if (selectedParts.includes(key)) {
      if (selectedParts.length > 1) selectedParts = selectedParts.filter((p) => p !== key)
      // else: it's the only selected part -- ignore, a selection can't go empty.
    } else {
      selectedParts = [...selectedParts, key]
    }
    updateChipSelectionUI()
    syncInputsFromConfig()
  }

  for (const key of PART_KEYS) {
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = 'char-customizer__chip'
    chip.title = PART_LABELS[key]
    chip.setAttribute('aria-label', PART_LABELS[key])
    chip.textContent = PART_ICONS[key]
    const badge = badgeFor(key)
    if (badge) {
      const badgeEl = document.createElement('span')
      badgeEl.className = 'char-customizer__chip-badge'
      badgeEl.textContent = badge
      chip.appendChild(badgeEl)
    }
    chip.addEventListener('click', (event) => {
      handleChipClick(key, event.ctrlKey || event.metaKey)
    })
    chipsWrap.appendChild(chip)
    chipButtons[key] = chip
  }
  updateChipSelectionUI()

  // Master per-part visibility switch -- fully hides the part (no
  // rendering at all) regardless of every other field, see
  // partAdjust.ts#applyPartTransform's `enabled` handling. Applies to
  // every currently selected part (absolute set -- a boolean has no
  // "delta" to preserve, unlike the numeric fields below).
  const enabledRow = document.createElement('label')
  enabledRow.className = 'char-customizer__enabled-row'
  const enabledCheckbox = document.createElement('input')
  enabledCheckbox.type = 'checkbox'
  enabledRow.append(enabledCheckbox, document.createTextNode(' Enabled'))
  enabledCheckbox.addEventListener('change', () => {
    for (const part of selectedParts) {
      config[part] = { ...config[part], enabled: enabledCheckbox.checked }
      applyPartTransform(part, config[part])
    }
    refreshSaveState()
  })

  const fieldsWrap = document.createElement('div')
  fieldsWrap.className = 'char-customizer__fields'
  const rowsByField = {} as Record<Field, HTMLElement>
  const inputsByField = {} as Record<Field, { range: HTMLInputElement; number: HTMLInputElement }>

  // Save (the checkmark icon beside the title) stays disabled until the
  // live config actually differs from whatever was last saved/loaded --
  // call this after every mutation to `config`.
  let savedSnapshot = JSON.stringify(config)
  function refreshSaveState(): void {
    saveIconButton.disabled = JSON.stringify(config) === savedSnapshot
  }

  // Tracks what's currently shown for each numeric field (the PRIMARY
  // part's value) so a multi-selection edit can compute a DELTA and apply
  // it uniformly to every selected part, instead of snapping them all to
  // one identical absolute value -- that's what lets "move several face
  // parts together" or "scale them together" preserve each part's own
  // existing offset rather than collapsing them onto each other.
  const displayedValues = {} as Record<Field, number>

  function syncInputsFromConfig(): void {
    const transform = config[primaryPart()]
    enabledCheckbox.checked = transform.enabled
    for (const spec of FIELD_SPECS) {
      const value = transform[spec.key] as number
      displayedValues[spec.key] = value
      inputsByField[spec.key].range.value = String(value)
      inputsByField[spec.key].number.value = String(value)
      // Disabled (never hidden) when not applicable to EVERY currently
      // selected part -- req #2: always shown, just inert, with a tooltip
      // explaining why.
      const applicable = spec.visibleFor ? selectedParts.every(spec.visibleFor) : true
      inputsByField[spec.key].range.disabled = !applicable
      inputsByField[spec.key].number.disabled = !applicable
      rowsByField[spec.key].classList.toggle('is-disabled', !applicable)
      rowsByField[spec.key].title = applicable ? '' : 'Not applicable to the selected part(s)'
    }
  }

  // jointOffsetX/Y need NO apply step here -- walkCycle.ts reads `config`
  // live every frame, so mutating it (already done by the caller) is
  // enough; the next animation frame picks it up automatically.
  function applyFieldToSelection(key: Field): void {
    if (key === 'zIndex') {
      applyAllZOrdering(zGroups, zIndexOf)
    } else if (key === 'anchorX' || key === 'anchorY') {
      for (const part of selectedParts) normalizePart(part, { x: config[part].anchorX, y: config[part].anchorY })
    } else if (key !== 'jointOffsetX' && key !== 'jointOffsetY') {
      for (const part of selectedParts) applyPartTransform(part, config[part])
    }
  }

  // Anchor fields are NOT applied on every 'input' -- normalizePart()
  // always re-centers the artwork so the chosen anchor lands at the rig's
  // fixed joint, which means the artwork (not a crosshair reading that
  // fixed point) is the only thing that visibly moves while dragging. So
  // for anchor fields, 'input' only updates the config + crosshair preview
  // (artwork stays put); the real re-fit (and the artwork snapping into
  // its new position) happens once, on 'change' (range: on release; number:
  // on blur/Enter).
  function handleFieldInput(key: Field, value: number): void {
    const delta = value - (displayedValues[key] ?? value)
    displayedValues[key] = value
    for (const part of selectedParts) {
      config[part] = { ...config[part], [key]: (config[part][key] as number) + delta }
    }
    if (key === 'anchorX' || key === 'anchorY') {
      const primary = primaryPart()
      crosshair.show(previewPartAnchor(primary, { x: config[primary].anchorX, y: config[primary].anchorY }))
    } else {
      applyFieldToSelection(key)
    }
    refreshSaveState()
  }

  function handleFieldCommit(key: Field): void {
    if (key === 'anchorX' || key === 'anchorY') {
      applyFieldToSelection(key)
    }
  }

  for (const spec of FIELD_SPECS) {
    const row = document.createElement('div')
    row.className = 'char-customizer__row'

    const rowTop = document.createElement('div')
    rowTop.className = 'char-customizer__row-top'

    const labelSpan = document.createElement('span')
    labelSpan.textContent = spec.label

    const number = document.createElement('input')
    number.type = 'number'
    number.min = String(spec.min)
    number.max = String(spec.max)
    number.step = String(spec.step)

    const range = document.createElement('input')
    range.type = 'range'
    range.min = String(spec.min)
    range.max = String(spec.max)
    range.step = String(spec.step)

    range.addEventListener('input', () => {
      number.value = range.value
      handleFieldInput(spec.key, Number(range.value))
    })
    range.addEventListener('change', () => {
      handleFieldCommit(spec.key)
    })
    number.addEventListener('input', () => {
      const value = Number(number.value)
      if (Number.isNaN(value)) return
      range.value = number.value
      handleFieldInput(spec.key, value)
    })
    number.addEventListener('change', () => {
      handleFieldCommit(spec.key)
    })

    if (spec.isAnchor) {
      range.addEventListener('pointerdown', startCrosshair)
      range.addEventListener('pointerup', stopCrosshair)
      range.addEventListener('pointercancel', stopCrosshair)
      number.addEventListener('focus', startCrosshair)
      number.addEventListener('blur', stopCrosshair)
    }

    rowTop.append(labelSpan, number)
    row.append(rowTop, range)
    fieldsWrap.appendChild(row)
    rowsByField[spec.key] = row
    inputsByField[spec.key] = { range, number }
  }

  // Resets every currently SELECTED part back to its parts-config.json
  // default -- bound to the \u21BA icon beside the title.
  function resetPart(): void {
    const fresh = createDefaultConfig()
    for (const part of selectedParts) {
      config[part] = fresh[part]
      applyPartTransform(part, config[part])
      normalizePart(part, { x: config[part].anchorX, y: config[part].anchorY })
    }
    applyAllZOrdering(zGroups, zIndexOf)
    syncInputsFromConfig()
    refreshSaveState()
  }

  // Reloads EVERY part from parts-config.json and drops this browser's
  // saved (localStorage) overrides -- bound to the folder icon beside the
  // title. (Deliberately removed the old separate "Reset all" button --
  // createDefaultConfig() already merges in the file defaults, so it and
  // "Use file defaults" produced an identical config; "Reset all" just
  // forgot to also clear localStorage, so a reload could silently bring
  // the old override back. One button, no gotcha.)
  function restoreFromFile(): void {
    clearSavedConfig()
    const fresh = createDefaultConfig()
    for (const key of PART_KEYS) {
      config[key] = fresh[key]
      applyPartTransform(key, config[key])
      normalizePart(key, { x: config[key].anchorX, y: config[key].anchorY })
    }
    applyAllZOrdering(zGroups, zIndexOf)
    syncInputsFromConfig()
    savedSnapshot = JSON.stringify(config)
    refreshSaveState()
    flashStatus(titleStatus, 'Restored from file \u2713')
  }

  sidebar.append(titleRow, titleStatus, chipsWrap, enabledRow, fieldsWrap)
  container.append(toggleButton, sidebar)

  syncInputsFromConfig()
  refreshSaveState()
}
