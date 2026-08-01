/**
 * Thin wrapper over KokoroTTS.generate(). Takes already-normalized spoken-English
 * text (see ../math-normalize) and returns a playable object URL.
 */

import { loadTTS } from './kokoro-loader.js'

export const DEFAULT_VOICE = 'af_heart'

/** Object URLs we minted, so we can revoke them instead of leaking blobs. */
let currentUrl = null

/**
 * Synthesize text to an audio object URL.
 *
 * @param {string} text Text to speak, already normalized to spoken English.
 * @param {object} [options]
 * @param {string} [options.voice]
 * @param {number} [options.speed] Generation-time pace; leave at 1 and use the
 *   player's playbackRate for live speed changes.
 * @param {(info: object) => void} [options.onProgress] Model-download progress.
 * @returns {Promise<{url: string, blob: Blob, device: string}>}
 */
export async function speak(text, { voice = DEFAULT_VOICE, speed = 1, onProgress } = {}) {
  const trimmed = text?.trim()
  if (!trimmed) throw new Error('Nothing to speak — the text is empty.')

  const { tts, device } = await loadTTS({ onProgress })
  const audio = await tts.generate(trimmed, { voice, speed })

  const blob = audio.toBlob()
  revokeCurrent()
  currentUrl = URL.createObjectURL(blob)

  return { url: currentUrl, blob, device }
}

/** Release the previous clip's memory. Safe to call when nothing is held. */
export function revokeCurrent() {
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl)
    currentUrl = null
  }
}

// Above this length, single-shot WASM synthesis can take tens of seconds before
// any sound plays; below it streaming would just add seams for no benefit.
export const STREAM_THRESHOLD = 280

/**
 * Synthesizes in sentence-sized chunks, yielding each as soon as it's ready so
 * chunk 1 can play while chunk 2 is still generating. Chunks stay as separate
 * clips (rather than one appended stream) so playbackRate still applies.
 *
 * @param {string} text
 * @param {object} [options]
 * @param {string} [options.voice]
 * @param {number} [options.speed]
 * @param {(info: object) => void} [options.onProgress]
 * @param {AbortSignal} [options.signal] Abort to stop mid-document.
 * @returns {AsyncGenerator<{url: string, text: string, index: number}>}
 */
export async function* speakStream(
  text,
  { voice = DEFAULT_VOICE, speed = 1, onProgress, signal } = {}
) {
  const trimmed = text?.trim()
  if (!trimmed) throw new Error('Nothing to speak — the text is empty.')

  const { tts } = await loadTTS({ onProgress })
  let index = 0

  for await (const chunk of tts.stream(trimmed, { voice, speed })) {
    // kokoro-js has no cancellation hook, so we can only stop requesting more chunks
    if (signal?.aborted) return

    const url = URL.createObjectURL(chunk.audio.toBlob())
    yield { url, text: chunk.text, index: index++ }
  }
}
