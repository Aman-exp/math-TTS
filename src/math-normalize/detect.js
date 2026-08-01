/**
 * Split mixed prose/math text into segments.
 *
 * Returns a segment list rather than a string so later passes can process
 * `text` segments (loose Unicode math) without re-scanning delimited math.
 */

/**
 * Delimiter pairs, longest opener first so `$$` is tested before `$`.
 * `display` marks block math, which the speech layer may pause around.
 */
const DELIMITERS = [
  { open: '$$', close: '$$', display: true },
  { open: '\\[', close: '\\]', display: true },
  { open: '\\(', close: '\\)', display: false },
  { open: '$', close: '$', display: false },
]

/**
 * @typedef {{type: 'text'|'math', content: string, display?: boolean, raw?: string}} Segment
 */

/**
 * @param {string} input
 * @returns {Segment[]}
 */
export function detectSegments(input) {
  if (!input) return []

  /** @type {Segment[]} */
  const segments = []
  let buffer = ''
  let i = 0

  const flushText = () => {
    if (buffer) {
      segments.push({ type: 'text', content: buffer })
      buffer = ''
    }
  }

  while (i < input.length) {
    // A backslash-escaped dollar is a literal dollar sign, not a delimiter.
    if (input[i] === '\\' && input[i + 1] === '$') {
      buffer += '$'
      i += 2
      continue
    }

    const delim = DELIMITERS.find((d) => input.startsWith(d.open, i))

    if (delim) {
      const contentStart = i + delim.open.length
      const closeIndex = findClose(input, contentStart, delim.close)

      if (closeIndex === -1) {
        // Unterminated delimiter: treat as literal text.
        buffer += input.slice(i, i + delim.open.length)
        i += delim.open.length
        continue
      }

      const content = input.slice(contentStart, closeIndex)

      // Currency guard for single-dollar spans only.
      if (delim.open === '$' && !isInlineMathSpan(content, input, closeIndex + 1)) {
        buffer += input.slice(i, closeIndex + delim.close.length)
        i = closeIndex + delim.close.length
        continue
      }

      flushText()
      segments.push({
        type: 'math',
        content,
        display: delim.display,
        raw: input.slice(i, closeIndex + delim.close.length),
      })
      i = closeIndex + delim.close.length
      continue
    }

    buffer += input[i]
    i++
  }

  flushText()
  return segments
}

/** Find an unescaped closing delimiter. */
function findClose(input, from, close) {
  let i = from
  while (i < input.length) {
    if (input[i] === '\\' && input[i + 1] === close[0]) {
      // Escaped delimiter char — but "\]" and "\)" ARE the closers, so only
      // skip when the escape is not itself the delimiter we are looking for.
      if (!input.startsWith(close, i)) {
        i += 2
        continue
      }
    }
    if (input.startsWith(close, i)) return i
    i++
  }
  return -1
}

/**
 * Decide whether a single-dollar span is inline math or two currency amounts
 * (the KaTeX auto-render rule). Real math never has whitespace just inside
 * its delimiters ("$x + 1$"); a currency pair almost always does
 * ("$5 and $10"). A digit right after the closing dollar is the other tell
 * ("$5 to $10x" is not math).
 *
 * @param {string} content Text between the dollars.
 * @param {string} input Full input, for lookahead.
 * @param {number} afterIndex Index just past the closing dollar.
 */
function isInlineMathSpan(content, input, afterIndex) {
  if (!content.trim()) return false
  if (/^\s/.test(content) || /\s$/.test(content)) return false
  if (/^\d/.test(input.slice(afterIndex))) return false
  return true
}
