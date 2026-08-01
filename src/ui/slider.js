/**
 * Live speed control.
 *
 * This is `audio.playbackRate`, never re-synthesis. Dragging the slider must be
 * instant — including mid-playback — and re-running an 82M-parameter model on
 * every pointermove obviously cannot be. `preservesPitch` keeps the voice from
 * turning into a chipmunk at 2x or a drone at 0.5x.
 */

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

    // Chromium/Firefox default this to true, Safari historically did not and
    // used a prefixed name. Setting both costs nothing and avoids a pitch shift
    // on the one platform that would otherwise get it wrong.
    player.preservesPitch = true
    if ('webkitPreservesPitch' in player) player.webkitPreservesPitch = true

    player.playbackRate = rate
    readout.textContent = `${rate.toFixed(2)}×`
  }

  function set(rate) {
    slider.value = String(clamp(rate))
    apply()
  }

  // 'input' rather than 'change' — this is what makes the drag feel live instead
  // of only committing when the pointer is released.
  slider.addEventListener('input', apply)

  // A new blob src resets playbackRate/preservesPitch to their defaults in some
  // browsers, so re-assert the user's chosen rate whenever a clip loads. Without
  // this, synthesizing a second clip silently snaps the speed back to 1x.
  player.addEventListener('loadedmetadata', apply)

  resetButton?.addEventListener('click', () => set(1))

  apply()
  return { apply, get: () => player.playbackRate, set }
}
