// Left-docked sidebar (mirrors ../customizer/panel.ts's character sidebar
// -- same pattern: section CHIPS at the top instead of always showing every
// section at once, a union of all possible fields below (disabled, not
// hidden, when not applicable to the current section(s)), Ctrl/Cmd-click a
// chip to multi-select and tweak/move/scale several sections together).
// Every field edit mutates the live SceneConfig object in place then asks
// the scene renderer to rebuild its layers (geometry depends on these
// values, unlike the character panel's live-transform fields). Top-level
// actions are icon buttons beside the title: Save (checkmark, disabled
// unless the live config differs from the last saved/loaded snapshot),
// Restore the scene from scene-config.json, Show JSON (opens
// ../jsonModal.ts's modal with Copy to clipboard) -- no buttons below the
// field list.
import './sceneCustomizer.css'
import { createJsonModal } from '../jsonModal'
import { clearSavedSceneConfig, createDefaultSceneConfig, saveSceneConfig } from './sceneConfig'
import type { BuildingsTransform, SceneConfig } from './sceneConfig'

type SectionKey = keyof SceneConfig
type FieldKey = keyof BuildingsTransform // superset of LayerTransform's x/y/scale, plus spacing

const SECTION_LABELS: Record<SectionKey, string> = {
  background: 'Background',
  buildings: 'Buildings',
  platform: 'Platform',
  character: 'Character',
}

const SECTION_ICONS: Record<SectionKey, string> = {
  background: '\u{1F3DE}\uFE0F',
  buildings: '\u{1F3E2}',
  platform: '\u{1F6E3}\uFE0F',
  character: '\u{1F9CD}',
}

const SECTION_KEYS: SectionKey[] = ['background', 'buildings', 'platform', 'character']

interface FieldSpec {
  key: FieldKey
  label: string
  min: number
  max: number
  step: number
  // Only APPLICABLE (not hidden -- see req #2) for sections where this
  // predicate returns true (default: every section). 'scale' doesn't mean
  // anything for 'character' (just a position nudge, see sceneConfig.ts),
  // and 'spacing' only means anything for 'buildings'.
  visibleFor?: (section: SectionKey) => boolean
}

// Union of every field across every section -- always shown, see req #2 in
// the customizer skill: a field gets DISABLED (not hidden) for a section
// it doesn't apply to, so the control set stays visually consistent no
// matter which section chip(s) are selected.
const FIELD_SPECS: FieldSpec[] = [
  { key: 'x', label: 'Offset X', min: -800, max: 800, step: 1 },
  { key: 'y', label: 'Offset Y', min: -800, max: 800, step: 1 },
  { key: 'scale', label: 'Scale', min: 0.1, max: 4, step: 0.01, visibleFor: (section) => section !== 'character' },
  { key: 'spacing', label: 'Spacing', min: -200, max: 800, step: 1, visibleFor: (section) => section === 'buildings' },
]

function flashStatus(el: HTMLElement, text: string, ms = 1600): void {
  el.textContent = text
  window.setTimeout(() => {
    if (el.textContent === text) el.textContent = ''
  }, ms)
}

export interface SceneCustomizerController {
  /** Call after mounting (or switching) a scene so the panel edits the new live config. */
  bind: (sceneId: string, config: SceneConfig, onApply: () => void) => void
}

export function mountSceneCustomizer(container: HTMLElement): SceneCustomizerController {
  let sceneId = ''
  let config: SceneConfig | null = null
  let applyChange: () => void = () => {}

  const toggleButton = document.createElement('button')
  toggleButton.type = 'button'
  toggleButton.className = 'scene-customizer-toggle'
  toggleButton.textContent = '\u{1F3D9}\uFE0F'
  toggleButton.setAttribute('aria-label', 'Open scene customizer')
  toggleButton.setAttribute('aria-expanded', 'false')

  const sidebar = document.createElement('aside')
  sidebar.className = 'scene-customizer'

  function setOpen(open: boolean): void {
    sidebar.classList.toggle('is-open', open)
    toggleButton.setAttribute('aria-expanded', String(open))
    toggleButton.setAttribute('aria-label', open ? 'Close scene customizer' : 'Open scene customizer')
  }

  toggleButton.addEventListener('click', () => setOpen(!sidebar.classList.contains('is-open')))

  const title = document.createElement('div')
  title.className = 'scene-customizer__title'
  title.textContent = 'Scene Customizer'

  const jsonModal = createJsonModal(container, 'Scene Customizer JSON')

  const titleStatus = document.createElement('div')
  titleStatus.className = 'scene-customizer__title-status'

  // Disabled unless the live config actually differs from the last
  // saved/loaded snapshot -- see refreshSaveState()/savedSnapshot below.
  const saveIconButton = document.createElement('button')
  saveIconButton.type = 'button'
  saveIconButton.className = 'scene-customizer__icon-btn'
  saveIconButton.textContent = '\u2713'
  saveIconButton.title = 'Save'
  saveIconButton.setAttribute('aria-label', 'Save')
  saveIconButton.addEventListener('click', () => {
    if (!config) return
    saveSceneConfig(sceneId, config)
    savedSnapshot = JSON.stringify(config)
    refreshSaveState()
    flashStatus(titleStatus, 'Saved \u2713')
  })

  // No per-item "Reset part" icon here, unlike the character customizer --
  // every section is shown at once (no single selected item), so the only
  // reset concept that makes sense at this level is reloading everything
  // from scene-config.json (below). An in-memory "Reset scene" button used
  // to exist too, but createDefaultSceneConfig() already merges in the
  // file defaults, making it identical to restoring from file except it
  // forgot to also clear localStorage -- same redundancy the character
  // customizer's old "Reset all" had, so it's dropped for the same reason.
  const restoreFromFileIconButton = document.createElement('button')
  restoreFromFileIconButton.type = 'button'
  restoreFromFileIconButton.className = 'scene-customizer__icon-btn'
  restoreFromFileIconButton.textContent = '\u{1F4C2}'
  restoreFromFileIconButton.title = 'Restore scene from scene-config.json'
  restoreFromFileIconButton.setAttribute('aria-label', 'Restore scene from scene-config.json')
  restoreFromFileIconButton.addEventListener('click', () => {
    restoreFromFile()
  })

  const jsonIconButton = document.createElement('button')
  jsonIconButton.type = 'button'
  jsonIconButton.className = 'scene-customizer__icon-btn'
  jsonIconButton.textContent = '{}'
  jsonIconButton.title = 'Show JSON'
  jsonIconButton.setAttribute('aria-label', 'Show JSON')
  jsonIconButton.addEventListener('click', () => {
    if (!config) return
    jsonModal.open(JSON.stringify(config, null, 2))
  })

  const titleRow = document.createElement('div')
  titleRow.className = 'scene-customizer__title-row'
  const titleActions = document.createElement('div')
  titleActions.className = 'scene-customizer__title-actions'
  titleActions.append(saveIconButton, restoreFromFileIconButton, jsonIconButton)
  titleRow.append(title, titleActions)

  // Selection order matters: selectedSections[0] is the "primary" section
  // -- its values are what every control displays. Plain click replaces
  // the whole selection with just that one section; Ctrl/Cmd-click toggles
  // a section in/out of the existing selection (multi-select) so e.g.
  // Background + Platform can be nudged together in one drag.
  let selectedSections: SectionKey[] = [SECTION_KEYS[0]]
  const primarySection = (): SectionKey => selectedSections[0]

  const chipsWrap = document.createElement('div')
  chipsWrap.className = 'scene-customizer__chips'
  const chipButtons = {} as Record<SectionKey, HTMLButtonElement>

  function updateChipSelectionUI(): void {
    for (const key of SECTION_KEYS) {
      chipButtons[key].classList.toggle('is-selected', selectedSections.includes(key))
      chipButtons[key].classList.toggle('is-primary', key === primarySection())
    }
  }

  function handleChipClick(key: SectionKey, multi: boolean): void {
    if (!multi) {
      selectedSections = [key]
    } else if (selectedSections.includes(key)) {
      if (selectedSections.length > 1) selectedSections = selectedSections.filter((s) => s !== key)
    } else {
      selectedSections = [...selectedSections, key]
    }
    updateChipSelectionUI()
    syncInputsFromConfig()
  }

  for (const key of SECTION_KEYS) {
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = 'scene-customizer__chip'
    chip.title = SECTION_LABELS[key]
    chip.setAttribute('aria-label', SECTION_LABELS[key])
    chip.textContent = SECTION_ICONS[key]
    chip.addEventListener('click', (event) => {
      handleChipClick(key, event.ctrlKey || event.metaKey)
    })
    chipsWrap.appendChild(chip)
    chipButtons[key] = chip
  }
  updateChipSelectionUI()

  // One set of {range, number} inputs per field -- a single shared row
  // list now (not one per section), same as the character customizer.
  const inputsByField = {} as Record<FieldKey, { range: HTMLInputElement; number: HTMLInputElement }>
  const rowsByField = {} as Record<FieldKey, HTMLElement>

  // Master visibility switch, applied to every currently selected section
  // (absolute set -- a boolean has no "delta" to preserve). Omits that
  // layer's DOM entirely (not just invisible) when off, see
  // genericScene.ts and main.ts#positionCharacter (for 'character').
  const enabledRow = document.createElement('label')
  enabledRow.className = 'scene-customizer__enabled-row'
  const enabledCheckbox = document.createElement('input')
  enabledCheckbox.type = 'checkbox'
  enabledRow.append(enabledCheckbox, document.createTextNode(' Enabled'))
  enabledCheckbox.addEventListener('change', () => {
    if (!config) return
    for (const section of selectedSections) {
      ;(config[section] as unknown as { enabled: boolean }).enabled = enabledCheckbox.checked
    }
    applyChange()
    refreshSaveState()
  })

  // Save stays disabled until the live config actually differs from
  // whatever was last saved/loaded -- call this after every mutation.
  let savedSnapshot = ''
  function refreshSaveState(): void {
    saveIconButton.disabled = !config || JSON.stringify(config) === savedSnapshot
  }

  // Tracks what's currently shown for each field (the PRIMARY section's
  // value) so a multi-selection edit can compute a DELTA and apply it
  // uniformly to every selected section, instead of snapping them all to
  // one identical absolute value -- see panel.ts's identical pattern.
  const displayedValues = {} as Record<FieldKey, number>

  function syncInputsFromConfig(): void {
    if (!config) return
    const primary = primarySection()
    const raw = config[primary]
    enabledCheckbox.checked = (raw as unknown as { enabled: boolean }).enabled
    const values = raw as unknown as Record<FieldKey, number>
    for (const spec of FIELD_SPECS) {
      const value = values[spec.key]
      displayedValues[spec.key] = value
      inputsByField[spec.key].range.value = String(value)
      inputsByField[spec.key].number.value = String(value)
      const applicable = spec.visibleFor ? selectedSections.every(spec.visibleFor) : true
      inputsByField[spec.key].range.disabled = !applicable
      inputsByField[spec.key].number.disabled = !applicable
      rowsByField[spec.key].classList.toggle('is-disabled', !applicable)
      rowsByField[spec.key].title = applicable ? '' : 'Not applicable to the selected section(s)'
    }
  }

  function handleFieldChange(key: FieldKey, value: number): void {
    if (!config) return
    const delta = value - (displayedValues[key] ?? value)
    displayedValues[key] = value
    for (const section of selectedSections) {
      const target = config[section] as unknown as Record<FieldKey, number>
      target[key] = target[key] + delta
    }
    applyChange()
    refreshSaveState()
  }

  for (const spec of FIELD_SPECS) {
    const row = document.createElement('div')
    row.className = 'scene-customizer__row'

    const rowTop = document.createElement('div')
    rowTop.className = 'scene-customizer__row-top'

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
      handleFieldChange(spec.key, Number(range.value))
    })
    number.addEventListener('input', () => {
      const value = Number(number.value)
      if (Number.isNaN(value)) return
      range.value = number.value
      handleFieldChange(spec.key, value)
    })

    rowTop.append(labelSpan, number)
    row.append(rowTop, range)
    rowsByField[spec.key] = row
    inputsByField[spec.key] = { range, number }
  }

  const fieldsWrap = document.createElement('div')
  fieldsWrap.className = 'scene-customizer__fields'
  for (const spec of FIELD_SPECS) fieldsWrap.appendChild(rowsByField[spec.key])

  // Reloads the whole scene from scene-config.json and drops this
  // browser's saved (localStorage) overrides -- bound to the folder icon
  // beside the title (see the comment above restoreFromFileIconButton for
  // why there's no separate in-memory "Reset scene" button anymore).
  function restoreFromFile(): void {
    if (!config) return
    clearSavedSceneConfig(sceneId)
    const fresh = createDefaultSceneConfig(sceneId)
    config.background = fresh.background
    config.platform = fresh.platform
    config.buildings = fresh.buildings
    config.character = fresh.character
    applyChange()
    syncInputsFromConfig()
    savedSnapshot = JSON.stringify(config)
    refreshSaveState()
    flashStatus(titleStatus, 'Restored from file \u2713')
  }

  sidebar.append(titleRow, titleStatus, chipsWrap, enabledRow, fieldsWrap)
  container.append(toggleButton, sidebar)

  return {
    bind(nextSceneId, nextConfig, onApply) {
      sceneId = nextSceneId
      config = nextConfig
      applyChange = onApply
      syncInputsFromConfig()
      savedSnapshot = JSON.stringify(config)
      refreshSaveState()
    },
  }
}
