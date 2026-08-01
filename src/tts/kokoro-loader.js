/**
 * Model loading, device detection and caching for Kokoro-82M.
 * Model is fetched from the Hugging Face Hub once, then served from Cache Storage.
 */

import { KokoroTTS } from 'kokoro-js'

export const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'

// q8 on WebGPU produces garbled audio (onnxruntime-web quantization bug), so WebGPU
// uses fp32 (~330MB) instead. WASM has no such issue and stays on q8 (~90MB).
const DEVICE_PROFILES = {
  webgpu: { device: 'webgpu', dtype: 'fp32' },
  wasm: { device: 'wasm', dtype: 'q8' },
}

/**
 * `navigator.gpu` can exist while `requestAdapter()` still resolves null (no
 * compatible adapter, or blocklisted GPU), so the adapter request is the real check.
 *
 * @returns {Promise<'webgpu'|'wasm'>}
 */
export async function detectDevice() {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) return 'wasm'
  try {
    const adapter = await navigator.gpu.requestAdapter()
    return adapter ? 'webgpu' : 'wasm'
  } catch {
    // some embedded webviews throw instead of resolving null
    return 'wasm'
  }
}

/** @type {Promise<{tts: KokoroTTS, device: string, dtype: string}>|null} */
let loadPromise = null

/**
 * Loads the model once per page; concurrent callers share the in-flight promise.
 *
 * @param {object} [options]
 * @param {(info: {status: string, file?: string, progress?: number, loaded?: number, total?: number}) => void} [options.onProgress]
 * @returns {Promise<{tts: KokoroTTS, device: string, dtype: string}>}
 */
export function loadTTS({ onProgress } = {}) {
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const detected = await detectDevice()

    // WebGPU can still fail during shader compilation/device creation after
    // requestAdapter() succeeded, so the fallback wraps the actual load, not just the probe.
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

    // don't cache a rejected promise
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
  // tts.list_voices() only console.tables the data; `voices` is the programmatic accessor
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
