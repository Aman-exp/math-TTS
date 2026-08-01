/**
 * Fold Unicode Mathematical Alphanumeric Symbols to their base letters.
 *
 * Text copied out of a PDF or Word equation uses U+1D400-block codepoints
 * instead of ASCII — "𝑥" is MATHEMATICAL ITALIC SMALL X (U+1D465), not "x".
 * Without folding, none of the symbol tables match and the text gets read
 * letter-by-letter or dropped.
 *
 * Lossy by design: style (bold/italic/script/fraktur) is discarded, only
 * letter identity is kept — saying "bold italic script x" aloud is worse
 * than losing the distinction.
 *
 * These are astral codepoints (surrogate pairs in UTF-16); run this first so
 * everything downstream deals in BMP characters.
 */

/**
 * Contiguous 26-letter ranges in the Mathematical Alphanumeric Symbols block.
 * Each entry is [firstCodePoint, baseLetter]. Some ranges have holes where a
 * letter is already encoded in the Letterlike Symbols block instead (e.g.
 * U+1D455 is unassigned because "ℎ" is U+210E) — those codepoints never
 * occur in real text, so the offset arithmetic below is safe.
 */
const LATIN_RANGES = [
  [0x1d400, 'A'], [0x1d41a, 'a'], // bold
  [0x1d434, 'A'], [0x1d44e, 'a'], // italic
  [0x1d468, 'A'], [0x1d482, 'a'], // bold italic
  [0x1d49c, 'A'], [0x1d4b6, 'a'], // script
  [0x1d4d0, 'A'], [0x1d4ea, 'a'], // bold script
  [0x1d504, 'A'], [0x1d51e, 'a'], // fraktur
  [0x1d538, 'A'], [0x1d552, 'a'], // double-struck
  [0x1d56c, 'A'], [0x1d586, 'a'], // bold fraktur
  [0x1d5a0, 'A'], [0x1d5ba, 'a'], // sans-serif
  [0x1d5d4, 'A'], [0x1d5ee, 'a'], // sans-serif bold
  [0x1d608, 'A'], [0x1d622, 'a'], // sans-serif italic
  [0x1d63c, 'A'], [0x1d656, 'a'], // sans-serif bold italic
  [0x1d670, 'A'], [0x1d68a, 'a'], // monospace
]

/** Digit ranges: bold, double-struck, sans, sans-bold, monospace. */
const DIGIT_RANGE_STARTS = [0x1d7ce, 0x1d7d8, 0x1d7e2, 0x1d7ec, 0x1d7f6]

/** Math Greek blocks: identical 58-character layout, 58 codepoints apart. */
const GREEK_BLOCK_STARTS = [
  0x1d6a8, // bold
  0x1d6e2, // italic
  0x1d71c, // bold italic
  0x1d756, // sans-serif bold
  0x1d790, // sans-serif bold italic
]

const GREEK_SEQUENCE =
  'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡϴΣΤΥΦΧΨΩ' + // 25 capitals (ϴ sits before Σ)
  '∇' + //                          nabla
  'αβγδεζηθικλμνξοπρςστυφχψω' + // 25 smalls (final sigma before sigma)
  '∂ϵϑϰϕϱϖ' //                      7 variant forms

/**
 * Letterlike Symbols that are really styled letters.
 * Deliberately absent: ℝ ℕ ℤ ℚ ℂ ℙ ℍ ℓ ℏ ℵ — those carry their own meaning
 * ("the real numbers") and are handled by the symbol tables instead.
 */
const LETTERLIKE = {
  ℎ: 'h', ℬ: 'B', ℰ: 'E', ℱ: 'F', ℋ: 'H', ℐ: 'I', ℒ: 'L', ℳ: 'M',
  ℛ: 'R', ℯ: 'e', ℊ: 'g', ℴ: 'o', ℭ: 'C', ℨ: 'Z', ℌ: 'H', ℑ: 'I',
  ℜ: 'R', ℘: 'P', '℮': 'e', ℼ: 'π', ℽ: 'γ', ℾ: 'Γ', ℿ: 'Π',
}

/**
 * Fold styled math characters to their base forms.
 *
 * @param {string} text
 * @param {Set<string>} [keep] Characters to leave alone even if they fall in
 *   a folded range, e.g. "𝔼" which already has a dedicated spoken form.
 * @returns {string}
 */
export function foldStyledMath(text, keep = new Set()) {
  if (!text) return text

  let out = ''
  // for...of iterates by code point, so surrogate pairs stay intact.
  for (const ch of text) {
    if (keep.has(ch)) {
      out += ch
      continue
    }
    out += foldChar(ch)
  }
  return out
}

function foldChar(ch) {
  if (LETTERLIKE[ch]) return LETTERLIKE[ch]

  const cp = ch.codePointAt(0)
  // Everything folded here lives above the BMP; skip the check for ordinary text.
  if (cp < 0x1d400 || cp > 0x1d7ff) return ch

  for (const [start, base] of LATIN_RANGES) {
    if (cp >= start && cp < start + 26) {
      return String.fromCharCode(base.charCodeAt(0) + (cp - start))
    }
  }

  for (const start of DIGIT_RANGE_STARTS) {
    if (cp >= start && cp < start + 10) return String(cp - start)
  }

  for (const start of GREEK_BLOCK_STARTS) {
    if (cp >= start && cp < start + GREEK_SEQUENCE.length) {
      return GREEK_SEQUENCE[cp - start]
    }
  }

  return ch
}

/** Does this text contain any styled math characters worth folding? */
export function hasStyledMath(text) {
  for (const ch of text) {
    if (LETTERLIKE[ch]) return true
    const cp = ch.codePointAt(0)
    if (cp >= 0x1d400 && cp <= 0x1d7ff) return true
  }
  return false
}
