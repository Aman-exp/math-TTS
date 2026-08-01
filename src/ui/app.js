// Wires the page together: textarea -> normalize -> speak -> player.

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

// localStorage rather than a session flag, so the warning stays gone across future visits too.
function initFirstVisitBanner() {
  if (localStorage.getItem(VISITED_KEY)) return

  els.firstVisitBanner.hidden = false
  els.firstVisitDismiss.addEventListener('click', markVisited)
}

function markVisited() {
  localStorage.setItem(VISITED_KEY, '1')
  els.firstVisitBanner.hidden = true
}

// Shows what the normalizer produced, so a bad reading can be traced to normalizer vs voice.
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

// Restore the previous session's speed.
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

// Transformers.js reports progress per-file; track the least-complete file so the
// bar doesn't jump backwards when a new file starts at 0%.
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
    // only restore the saved voice if it still exists in this model build
    const savedVoice = localStorage.getItem(VOICE_KEY)
    const available = new Set([...els.voice.options].map((option) => option.value))
    els.voice.value = savedVoice && available.has(savedVoice) ? savedVoice : DEFAULT_VOICE
    els.voice.disabled = false
    els.voice.addEventListener('change', () => {
      localStorage.setItem(VOICE_KEY, els.voice.value)
    })
    markVisited() // model is cached now, warning no longer applies

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
  // assigning src can reset playbackRate before 'loadedmetadata' fires
  speed.apply()
  await els.player.play()

  els.stopButton.disabled = false
  const seconds = ((performance.now() - started) / 1000).toFixed(1)
  setStatus(`Playing — synthesized in ${seconds}s on ${device.toUpperCase()}.`)
}

/** Long text: play chunk 1 while chunk 2 is still generating. */
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

// single-clip completion; streaming completion goes through queue's onDrain
els.player.addEventListener('ended', () => {
  if (!queue.isPlaying) {
    els.stopButton.disabled = true
    setStatus('Done.')
  }
})

// cheap enough to run on every keystroke without debouncing
els.input.addEventListener('input', () => {
  const text = normalize(els.input.value)
  if (text) showPreview(text)
  else els.preview.hidden = true
})

els.input.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    onSpeak()
  }
})

initFirstVisitBanner()

// warm the model at page load so the first "Speak" isn't also the first download
populateVoices()
