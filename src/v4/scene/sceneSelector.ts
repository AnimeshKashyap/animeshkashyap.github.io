// Top-middle scene picker, populated from whatever sceneAssets.discoverScenes()
// finds on disk -- adding a new scenes/<id>/ folder (with background/ +
// platform/ frames) makes it appear here with no code change. The "Next"
// button cycles forward through that same discovered list, looping back to
// the first scene after the last.
import './sceneSelector.css'
import { discoverScenes } from './sceneAssets'

export function mountSceneSelector(container: HTMLElement, initialSceneId: string, onChange: (sceneId: string) => void): HTMLSelectElement {
  const scenes = discoverScenes()

  const wrap = document.createElement('div')
  wrap.className = 'scene-selector'

  const label = document.createElement('label')
  label.textContent = 'Scene'
  label.htmlFor = 'scene-selector-select'

  const select = document.createElement('select')
  select.id = 'scene-selector-select'
  for (const scene of scenes) {
    const option = document.createElement('option')
    option.value = scene.id
    option.textContent = scene.label
    select.appendChild(option)
  }
  select.value = initialSceneId

  select.addEventListener('change', () => onChange(select.value))

  const nextButton = document.createElement('button')
  nextButton.type = 'button'
  nextButton.className = 'scene-selector__next'
  nextButton.textContent = 'Next \u25B6'
  nextButton.title = 'Switch to the next scene'
  nextButton.addEventListener('click', () => {
    if (scenes.length < 2) return
    const currentIndex = scenes.findIndex((scene) => scene.id === select.value)
    const nextScene = scenes[(currentIndex + 1 + scenes.length) % scenes.length]
    select.value = nextScene.id
    onChange(nextScene.id)
  })

  wrap.append(label, select, nextButton)
  container.appendChild(wrap)
  return select
}
