/**
 * Fold Unicode Mathematical Alphanumeric Symbols to their base letters.
 *
 * Why this exists: text copied out of a PDF or Word equation does not contain
 * ASCII letters. It contains U+1D400-block codepoints — "𝑥" is MATHEMATICAL
 * ITALIC SMALL X (U+1D465), not "x", and "𝜎" is MATHEMATICAL ITALIC SMALL SIGMA
 * (U+1D70E), not "σ". This is the single most common way real loose-Unicode math
 * reaches the app, and without folding, none of the symbol tables match: the
 * text would be read letter-by-letter or silently dropped.
 *
 * Folding is lossy by design. Style (bold/italic/script/fraktur) carries meaning
 * in some papers, but saying "bold italic script x" aloud for every variable is
 * far worse than losing the distinction, so style is discarded and only the
 * identity of the letter is kept.
 *
 * These are astral codepoints (surrogate pairs in UTF-16), so callers that walk
 * strings by code *unit* cannot see them. Running this first means everything
 * downstream deals in BMP characters.
 */

/**
 * Contiguous 26-letter ranges in the Mathematical Alphanumeric Symbols block.
 * Each entry is [firstCodePoint, baseLetter].
 *
 * Several ranges have holes where the character was already encoded in the
 * Letterlike Symbols block (e.g. U+1D455 is reserved because "ℎ" is U+210E).
 * The holes are unassigned codepoints that never occur in real text, so the
 * naive offset arithmetic is safe — the real characters are handled by
 * LETTERLIKE below.
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

/**
 * Math Greek blocks. Every block has the identical 58-character layout, and the
 * blocks are exactly 58 codepoints apart, so one table and one offset handle all
 * five styles.
 */
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
 *
 * Deliberately absent: ℝ ℕ ℤ ℚ ℂ ℙ ℍ ℓ ℏ ℵ. Those carry meaning of their own
 * ("the real numbers", not "R"), and the symbol tables already handle them.
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
 * @param {Set<string>} [keep] Characters to leave alone even if they fall in a
 *   folded range — for symbols that already have a dedicated spoken form, such
 *   as "𝔼" for expectation.
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
  // Everything folded here lives above the BMP; skip the check entirely for
  // ordinary text, which is the overwhelmingly common case.
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
