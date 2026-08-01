/**
 * Orchestration: raw pasted text -> speakable English.
 *
 * detect -> route each segment -> merge back into one string. This is the
 * only module the UI should import.
 */

import { detectSegments } from './detect.js'
import { latexToSpeech } from './latex-to-speech.js'
import { normalizeUnicodeMath } from './unicode-math-rules.js'

/**
 * @param {string} input Raw text as pasted by the user.
 * @param {object} [options]
 * @param {boolean} [options.unicodeMath=true] Handle loose Unicode math in
 *   prose runs. Turn off for strict LaTeX-only behaviour.
 * @returns {string} Text ready to hand to the TTS engine.
 */
export function normalize(input, { unicodeMath = true } = {}) {
  if (!input?.trim()) return ''

  const segments = detectSegments(input)
  const rendered = segments.map((segment) => {
    if (segment.type === 'math') {
      const speech = latexToSpeech(segment.content)
      // A math span that renders to nothing (e.g. "$ $") would otherwise
      // leave a doubled space and a dangling comma in the prose.
      if (!speech) return { text: '', display: segment.display }
      return { text: speech, display: segment.display }
    }
    return { text: unicodeMath ? normalizeProse(segment.content) : segment.content, display: false }
  })

  return joinSegments(rendered)
}

/**
 * Prose runs get loose-Unicode math treatment. Only segments outside LaTeX
 * delimiters reach this, so delimited math is never processed twice.
 */
function normalizeProse(text) {
  return normalizeUnicodeMath(text)
}

/**
 * Stitch segments back together with the pauses a reader would use.
 * Inline math gets spaces; display math gets comma pauses on both sides.
 */
function joinSegments(segments) {
  let out = ''

  for (const segment of segments) {
    if (!segment.text) continue

    if (segment.display) {
      out = `${trimTrailingSpace(out)}${needsComma(out) ? ',' : ''} ${segment.text}, `
      continue
    }

    const needsSpace = out && !/\s$/.test(out) && !/^[\s,.;!?)]/.test(segment.text)
    out += (needsSpace ? ' ' : '') + segment.text
  }

  return cleanup(out)
}

const trimTrailingSpace = (text) => text.replace(/\s+$/, '')

/** Only add a pause comma if the prose does not already end in punctuation. */
function needsComma(text) {
  const trimmed = trimTrailingSpace(text)
  return Boolean(trimmed) && !/[,.;:!?]$/.test(trimmed)
}

function cleanup(text) {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,;:])\1+/g, '$1')
    .replace(/,(\s*[.!?])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export { detectSegments, latexToSpeech, normalizeUnicodeMath }
