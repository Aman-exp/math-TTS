// Live speed control via audio.playbackRate (never re-synthesis).
// preservesPitch keeps the voice from turning into a chipmunk at 2x.

const MIN_RATE = 0.5
const MAX_RATE = 2

/**
 * @param {object} refs
 * @param {HTMLAudioElement} refs.player
 * @param {HTMLInputElement} refs.slider
 * @param {HTMLOutputElement|HTMLElement} refs.readout
 * @param {HTMLButtonElement} [refs.resetButton]
 * @returns {{apply: () => void, get: () => number, set: (rate: number) => void}}
 */
export function initSpeedControl({ player, slider, readout, resetButton }) {
  const clamp = (rate) => Math.min(MAX_RATE, Math.max(MIN_RATE, rate))

  function apply() {
    const rate = clamp(Number(slider.value) || 1)

    // Safari historically needed the prefixed property
    player.preservesPitch = true
    if ('webkitPreservesPitch' in player) player.webkitPreservesPitch = true

    player.playbackRate = rate
    readout.textContent = `${rate.toFixed(2)}×`
  }

  function set(rate) {
    slider.value = String(clamp(rate))
    apply()
  }

  // 'input' fires live while dragging; 'change' would only fire on release
  slider.addEventListener('input', apply)

  // a new blob src can reset playbackRate to its default, so re-apply on load
  player.addEventListener('loadedmetadata', apply)

  resetButton?.addEventListener('click', () => set(1))

  apply()
  return { apply, get: () => player.playbackRate, set }
}
