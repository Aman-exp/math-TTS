/**
 * Thin wrapper over KokoroTTS.generate().
 *
 * Deliberately narrow: it takes text that is already spoken-English (the math
 * normalizer's job, Phase 1+) and returns a playable object URL. Keeping the
 * generation call free of any math awareness is what lets the normalizer be
 * tested without loading an 82M-parameter model.
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
 * @param {number} [options.speed] Generation-time pace. Leave at 1 — live speed
 *   changes belong to the player's playbackRate, not to re-synthesis.
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

/**
 * Text long enough that waiting for full synthesis is worse than sentence gaps.
 *
 * Below this, a single generate() finishes fast enough that streaming would add
 * audible seams for no benefit. Above it, WASM synthesis of the whole document
 * can take tens of seconds before the first sound, which reads as a hang.
 */
export const STREAM_THRESHOLD = 280

/**
 * Synthesize in sentence-sized chunks, yielding each as soon as it is ready.
 *
 * Playback of chunk 1 overlaps synthesis of chunk 2, so time-to-first-audio
 * stops depending on document length. The chunks are separate clips rather than
 * one appended stream: keeping them as ordinary `<audio>` sources is what
 * preserves the `playbackRate` speed slider, which is a non-negotiable of the
 * design. Kokoro splits on sentence boundaries, so the seam lands where a
 * reader would pause anyway.
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
    // Checked after each chunk rather than mid-inference: kokoro-js has no
    // cancellation hook, so the best we can do is stop requesting more.
    if (signal?.aborted) return

    const url = URL.createObjectURL(chunk.audio.toBlob())
    yield { url, text: chunk.text, index: index++ }
  }
}
