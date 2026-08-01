/**
 * Sequential playback of streamed audio chunks through a single <audio>.
 * Swapping `src` on one element (instead of scheduling AudioBuffers via Web Audio)
 * keeps `playbackRate` working, at the cost of a small seam between chunks.
 */

/**
 * @param {HTMLAudioElement} player
 * @param {object} [callbacks]
 * @param {() => void} [callbacks.onStart] First chunk began playing.
 * @param {() => void} [callbacks.onDrain] Queue emptied and no more expected.
 * @param {(error: Error) => void} [callbacks.onError]
 */
export function createPlayerQueue(player, { onStart, onDrain, onError } = {}) {
  /** @type {Array<{url: string, text: string}>} */
  let queue = []
  let playing = false
  let finished = false // producer says no more chunks are coming
  let started = false
  /** Every URL we have minted, so none leak when the queue is reset. */
  let owned = []

  async function playNext() {
    const item = queue.shift()
    if (!item) {
      playing = false
      // Only truly done when the producer has also finished.
      if (finished) onDrain?.()
      return
    }

    playing = true
    player.src = item.url
    try {
      await player.play()
      if (!started) {
        started = true
        onStart?.()
      }
    } catch (error) {
      // play() can reject under autoplay policy if there was no user gesture
      playing = false
      onError?.(error)
    }
  }

  function onEnded() {
    playNext()
  }

  player.addEventListener('ended', onEnded)

  return {
    /** Add a chunk, starting playback if nothing is currently playing. */
    push(item) {
      queue.push(item)
      owned.push(item.url)
      if (!playing) playNext()
    },

    /** Producer is done; the queue may still be draining. */
    finish() {
      finished = true
      if (!playing && queue.length === 0) onDrain?.()
    },

    /** Stop, discard pending chunks, and release every blob URL. */
    reset() {
      queue = []
      playing = false
      finished = false
      started = false
      player.pause()
      player.removeAttribute('src')
      for (const url of owned) URL.revokeObjectURL(url)
      owned = []
    },

    /** Detach listeners — for symmetry; the app lives as long as the page. */
    destroy() {
      player.removeEventListener('ended', onEnded)
      this.reset()
    },

    get isPlaying() {
      return playing
    },
  }
}
