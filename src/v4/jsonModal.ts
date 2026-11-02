// Reusable "show live JSON" modal, shared by both the character customizer
// (customizer/panel.ts) and the scene customizer (scene/sceneCustomizer.ts)
// -- each mounts its own independent instance (same pattern as each
// mounting its own toggle button/sidebar), so this is just the one piece of
// UI duplicated between them. A centered dialog over a dismissible backdrop
// (click outside, Escape, or the \u2715 button all close it), with a
// read-only textarea + "Copy to clipboard" -- replaces the inline,
// always-in-the-DOM "Show JSON" section either customizer previously used.
import './jsonModal.css'

export interface JsonModalController {
  open: (json: string) => void
}

function flashStatus(el: HTMLElement, text: string, ms = 1600): void {
  el.textContent = text
  window.setTimeout(() => {
    if (el.textContent === text) el.textContent = ''
  }, ms)
}

export function createJsonModal(container: HTMLElement, title: string): JsonModalController {
  const backdrop = document.createElement('div')
  backdrop.className = 'json-modal-backdrop'
  backdrop.hidden = true

  const dialog = document.createElement('div')
  dialog.className = 'json-modal'
  dialog.setAttribute('role', 'dialog')
  dialog.setAttribute('aria-modal', 'true')
  dialog.setAttribute('aria-label', title)

  const header = document.createElement('div')
  header.className = 'json-modal__header'
  const titleEl = document.createElement('span')
  titleEl.textContent = title
  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.className = 'json-modal__close'
  closeButton.textContent = '\u2715'
  closeButton.setAttribute('aria-label', 'Close')
  header.append(titleEl, closeButton)

  const textarea = document.createElement('textarea')
  textarea.className = 'json-modal__textarea'
  textarea.readOnly = true

  const status = document.createElement('span')
  status.className = 'json-modal__status'

  const copyButton = document.createElement('button')
  copyButton.type = 'button'
  copyButton.textContent = 'Copy to clipboard'
  copyButton.className = 'json-modal__copy-btn'
  copyButton.addEventListener('click', () => {
    navigator.clipboard.writeText(textarea.value).then(
      () => flashStatus(status, 'Copied \u2713'),
      () => flashStatus(status, 'Copy failed \u2014 select & copy manually', 3000),
    )
  })

  const actions = document.createElement('div')
  actions.className = 'json-modal__actions'
  actions.append(copyButton, status)

  function close(): void {
    backdrop.hidden = true
  }

  closeButton.addEventListener('click', close)
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close()
  })
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !backdrop.hidden) close()
  })

  dialog.append(header, textarea, actions)
  backdrop.appendChild(dialog)
  container.appendChild(backdrop)

  return {
    open(json) {
      textarea.value = json
      backdrop.hidden = false
    },
  }
}
