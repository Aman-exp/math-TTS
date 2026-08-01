/**
 * Model loading, device detection and caching for Kokoro-82M.
 *
 * The model is fetched from the Hugging Face Hub on first use and then served
 * from the browser's Cache Storage on every later visit — that is the entire
 * "no backend" story, so nothing here may reach for a server of our own.
 */

import { KokoroTTS } from 'kokoro-js'

export const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'

/**
 * q8 on both devices — fp32 on WebGPU would be a ~330MB first-load download
 * versus ~90MB for q8, and every visitor pays that cost on their own
 * connection with no server of ours to spread it across. The quality cost is
 * inaudible for speech at this model size, so there is no real tradeoff, only
 * a much smaller download for anyone landing on the WebGPU path.
 */
const DEVICE_PROFILES = {
  webgpu: { device: 'webgpu', dtype: 'q8' },
  wasm: { device: 'wasm', dtype: 'q8' },
}

/**
 * Probe for a genuinely usable WebGPU adapter.
 *
 * `navigator.gpu` existing is not sufficient — on several Windows and Android
 * configurations the object is present but `requestAdapter()` resolves to null
 * (no compatible adapter, or the GPU is blocklisted by the browser). Asking for
 * the adapter is the only reliable check, and it is cheap.
 *
 * @returns {Promise<'webgpu'|'wasm'>}
 */
export async function detectDevice() {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) return 'wasm'
  try {
    const adapter = await navigator.gpu.requestAdapter()
    return adapter ? 'webgpu' : 'wasm'
  } catch {
    // Some embedded webviews throw outright rather than resolving null.
    return 'wasm'
  }
}

/** @type {Promise<{tts: KokoroTTS, device: string, dtype: string}>|null} */
let loadPromise = null

/**
 * Load the model once per page and hand the same instance to every caller.
 *
 * Concurrent callers share one in-flight promise, so a user who mashes "Speak"
 * during the first load does not trigger a second multi-megabyte download.
 *
 * @param {object} [options]
 * @param {(info: {status: string, file?: string, progress?: number, loaded?: number, total?: number}) => void} [options.onProgress]
 * @returns {Promise<{tts: KokoroTTS, device: string, dtype: string}>}
 */
export function loadTTS({ onProgress } = {}) {
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const detected = await detectDevice()

    // Try the fast path, then fall back. A WebGPU adapter can still fail during
    // shader compilation or device creation well after requestAdapter() said yes,
    // so the fallback has to wrap the actual model load, not just the probe.
    const attempts =
      detected === 'webgpu'
        ? [DEVICE_PROFILES.webgpu, DEVICE_PROFILES.wasm]
        : [DEVICE_PROFILES.wasm]

    let lastError
    for (const { device, dtype } of attempts) {
      try {
        const tts = await KokoroTTS.from_pretrained(MODEL_ID, {
          device,
          dtype,
          progress_callback: onProgress,
        })
        return { tts, device, dtype }
      } catch (error) {
        lastError = error
        console.warn(`[mathspeak] ${device} load failed, trying fallback`, error)
      }
    }

    // Let the next attempt start clean rather than caching a rejected promise.
    loadPromise = null
    throw lastError
  })()

  return loadPromise
}

/**
 * Voice list as flat, sortable records for the UI.
 *
 * @param {KokoroTTS} tts
 * @returns {Array<{id: string, name: string, language: string, gender: string, grade: string}>}
 */
export function listVoices(tts) {
  // Note: tts.list_voices() only console.tables the data; the `voices` getter is
  // the programmatic accessor.
  return Object.entries(tts.voices)
    .map(([id, meta]) => ({
      id,
      name: meta.name ?? id,
      language: meta.language ?? '',
      gender: meta.gender ?? '',
      grade: meta.overallGrade ?? '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
