/**
 * Wires the page together: textarea -> (normalize, Phase 1+) -> speak -> player.
 *
 * Phase 0 has no math normalization on purpose — BUILD.md says get this loop
 * working end to end first. The single call site marked below is where the
 * normalizer drops in, so adding it should not touch anything else in this file.
 */

import { speak, speakStream, STREAM_THRESHOLD, DEFAULT_VOICE } from '../tts/speak.js'
import { loadTTS, listVoices } from '../tts/kokoro-loader.js'
import { normalize } from '../math-normalize/normalize.js'
import { initSpeedControl } from './slider.js'
import { createPlayerQueue } from './player-queue.js'

const $ = (id) => document.getElementById(id)

const els = {
  input: $('input'),
  speakButton: $('speak'),
  stopButton: $('stop'),
  voice: $('voice'),
  slider: $('speed'),
  readout: $('speedValue'),
  speedReset: $('speedReset'),
  player: $('player'),
  status: $('status'),
  progress: document.querySelector('.progress'),
  progressBar: $('progressBar'),
  preview: $('preview'),
  previewText: $('previewText'),
  firstVisitBanner: $('firstVisitBanner'),
  firstVisitDismiss: $('firstVisitDismiss'),
}

const VISITED_KEY = 'mathspeak:visited'
const VOICE_KEY = 'mathspeak:voice'
const SPEED_KEY = 'mathspeak:speed'

/**
 * Warn a first-time visitor that the model download is coming.
 *
 * Keyed off localStorage rather than a session flag: the point is to warn
 * about a one-time cost, so it must stay gone across future sessions too, not
 * just for the rest of this tab's life. Dismissing early (before the model
 * finishes loading) still counts as "seen" — nagging a second time on the same
 * visit would be more annoying than informative.
 */
function initFirstVisitBanner() {
  if (localStorage.getItem(VISITED_KEY)) return

  els.firstVisitBanner.hidden = false
  els.firstVisitDismiss.addEventListener('click', markVisited)
}

function markVisited() {
  localStorage.setItem(VISITED_KEY, '1')
  els.firstVisitBanner.hidden = true
}

/**
 * Show what the normalizer produced.
 *
 * Worth the screen space: when a reading is wrong, the only useful question is
 * whether the normalizer or the voice got it wrong, and this answers that
 * without opening the console.
 */
function showPreview(text) {
  els.previewText.textContent = text
  els.preview.hidden = false
}

const speed = initSpeedControl({
  player: els.player,
  slider: els.slider,
  readout: els.readout,
  resetButton: els.speedReset,
})

// Restore the previous session's pace. Someone who prefers 1.5x wants 1.5x every
// time, not to re-drag the slider on every visit.
const savedSpeed = Number(localStorage.getItem(SPEED_KEY))
if (savedSpeed >= 0.5 && savedSpeed <= 2) speed.set(savedSpeed)
els.slider.addEventListener('change', () => {
  localStorage.setItem(SPEED_KEY, String(speed.get()))
})

const queue = createPlayerQueue(els.player, {
  onStart: () => {
    els.stopButton.disabled = false
  },
  onDrain: () => {
    els.stopButton.disabled = true
    setStatus('Done.')
  },
  onError: (error) => setStatus(`Playback failed: ${error.message}`, 'error'),
})

/** Lets Stop abort an in-flight streaming synthesis. */
let streamAbort = null

function setStatus(message, kind = 'info') {
  els.status.textContent = message
  els.status.dataset.kind = kind
}

function setProgress(fraction) {
  if (fraction === null) {
    els.progress.hidden = true
    return
  }
  els.progress.hidden = false
  els.progressBar.style.width = `${Math.round(fraction * 100)}%`
}

/**
 * Model download progress. Transformers.js reports per-file, so we track the
 * worst-case (least complete) file to avoid a bar that jumps backwards as each
 * new file starts at 0%.
 */
const fileProgress = new Map()
function onProgress(info) {
  if (info.status === 'progress' && info.file) {
    fileProgress.set(info.file, info.progress ?? 0)
    const values = [...fileProgress.values()]
    const min = Math.min(...values) / 100
    setProgress(min)
    setStatus(`Downloading model (first run only) — ${Math.round(min * 100)}%…`)
  } else if (info.status === 'done' && info.file) {
    fileProgress.set(info.file, 100)
  }
}

async function populateVoices() {
  try {
    setStatus('Loading the speech model…')
    const { tts, device, dtype } = await loadTTS({ onProgress })
    setProgress(null)

    els.voice.innerHTML = ''
    for (const v of listVoices(tts)) {
      const option = document.createElement('option')
      option.value = v.id
      const bits = [v.language, v.gender, v.grade].filter(Boolean).join(' · ')
      option.textContent = bits ? `${v.name} (${bits})` : v.name
      els.voice.append(option)
    }
    // Restore the saved voice, but only if it still exists in this model build.
    const savedVoice = localStorage.getItem(VOICE_KEY)
    const available = new Set([...els.voice.options].map((option) => option.value))
    els.voice.value = savedVoice && available.has(savedVoice) ? savedVoice : DEFAULT_VOICE
    els.voice.disabled = false
    els.voice.addEventListener('change', () => {
      localStorage.setItem(VOICE_KEY, els.voice.value)
    })
    markVisited() // model is cached now — the one-time-cost warning no longer applies

    setStatus(
      `Ready — running on ${device.toUpperCase()} (${dtype}). ${
        device === 'wasm' ? 'No WebGPU here, so synthesis will be slower.' : ''
      }`.trim()
    )
  } catch (error) {
    setProgress(null)
    setStatus(`Could not load the model: ${error.message}`, 'error')
    console.error(error)
  }
}

let busy = false

async function onSpeak() {
  if (busy) return
  const raw = els.input.value

  if (!raw.trim()) {
    setStatus('Type or paste some text first.', 'error')
    els.input.focus()
    return
  }

  busy = true
  els.speakButton.disabled = true
  els.speakButton.textContent = 'Synthesizing…'

  try {
    const text = normalize(raw)
    showPreview(text)

    if (!text.trim()) {
      setStatus('That input normalized to nothing speakable.', 'error')
      return
    }

    queue.reset()
    setStatus('Synthesizing…')
    const started = performance.now()
    const voice = els.voice.value || DEFAULT_VOICE

    if (text.length >= STREAM_THRESHOLD) {
      await streamSynthesis(text, voice, started)
    } else {
      await singleSynthesis(text, voice, started)
    }
  } catch (error) {
    setProgress(null)
    setStatus(`Synthesis failed: ${error.message}`, 'error')
    console.error(error)
  } finally {
    busy = false
    els.speakButton.disabled = false
    els.speakButton.textContent = 'Speak'
  }
}

/** Short text: one clip, no seams. */
async function singleSynthesis(text, voice, started) {
  const { url, device } = await speak(text, { voice, onProgress })
  setProgress(null)

  els.player.src = url
  // Re-assert the slider's rate: assigning src resets playbackRate in some
  // browsers, and 'loadedmetadata' may not have fired yet.
  speed.apply()
  await els.player.play()

  els.stopButton.disabled = false
  const seconds = ((performance.now() - started) / 1000).toFixed(1)
  setStatus(`Playing — synthesized in ${seconds}s on ${device.toUpperCase()}.`)
}

/**
 * Long text: play chunk 1 while chunk 2 is still being generated.
 *
 * Time-to-first-audio stops depending on document length, which is the whole
 * point — on the WASM path a long paste can otherwise take tens of seconds
 * before any sound, and silence that long reads as a hang.
 */
async function streamSynthesis(text, voice, started) {
  streamAbort?.abort()
  streamAbort = new AbortController()
  const { signal } = streamAbort

  let chunks = 0
  let firstAudioAt = null

  for await (const chunk of speakStream(text, { voice, onProgress, signal })) {
    if (signal.aborted) break
    setProgress(null)
    queue.push(chunk)
    chunks++

    if (firstAudioAt === null) {
      firstAudioAt = ((performance.now() - started) / 1000).toFixed(1)
      setStatus(`Playing — first audio in ${firstAudioAt}s, still synthesizing…`)
    } else {
      setStatus(`Playing — ${chunks} chunks synthesized (first audio in ${firstAudioAt}s).`)
    }
  }

  // Tell the queue no more chunks are coming, so it can report "Done." when the
  // last one finishes rather than stalling with the Stop button enabled.
  if (!signal.aborted) queue.finish()
}

function onStop() {
  streamAbort?.abort()
  queue.reset()
  els.player.pause()
  els.player.currentTime = 0
  els.stopButton.disabled = true
  setStatus('Stopped.')
}

els.speakButton.addEventListener('click', onSpeak)
els.stopButton.addEventListener('click', onStop)

// Single-clip playback reports its own completion; the queue handles the
// streaming case via onDrain.
els.player.addEventListener('ended', () => {
  if (!queue.isPlaying) {
    els.stopButton.disabled = true
    setStatus('Done.')
  }
})

// Normalization is pure string work — cheap enough to run on every keystroke,
// so the preview stays live without debouncing.
els.input.addEventListener('input', () => {
  const text = normalize(els.input.value)
  if (text) showPreview(text)
  else els.preview.hidden = true
})

// Ctrl/Cmd+Enter from the textarea is the fastest path for someone pasting and
// immediately wanting to hear it.
els.input.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    onSpeak()
  }
})

initFirstVisitBanner()

// Warm the model at page load so the first "Speak" is not also the first download.
populateVoices()
