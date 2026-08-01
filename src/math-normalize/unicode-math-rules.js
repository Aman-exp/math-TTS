/**
 * Loose Unicode math -> spoken English: math typed straight into prose with
 * no delimiters ("∫₀^∞ φ(u)du", "x² + y² = z²", "σ² ≤ 3"). Heuristic by
 * nature, so the goal is to be safe by default.
 *
 * A run is transliterated to LaTeX and rendered through the same parser and
 * speech renderer as delimited math, so there's one set of reading rules to
 * maintain rather than two that drift apart.
 *
 * A run must be anchored by a strong trigger: only a Greek letter, math
 * symbol, or Unicode super/subscript can start one. Digits, single letters
 * and ASCII operators may only join a run already anchored — otherwise
 * "well-known" would become "well minus known".
 */

import {
  SUPERSCRIPT_CHARS,
  SUBSCRIPT_CHARS,
  FUNCTIONS,
  NAMED_SYMBOLS,
  isUnnamedMathSymbol,
} from './symbols.js'
import { latexToSpeech } from './latex-to-speech.js'
import { foldStyledMath } from './unicode-fold.js'

/** Unicode Greek -> LaTeX command. */
const GREEK_LATEX = {
  α: '\\alpha', β: '\\beta', γ: '\\gamma', Γ: '\\Gamma',
  δ: '\\delta', Δ: '\\Delta', ε: '\\epsilon', ϵ: '\\epsilon',
  ζ: '\\zeta', η: '\\eta', θ: '\\theta', Θ: '\\Theta', ϑ: '\\vartheta',
  ι: '\\iota', κ: '\\kappa', λ: '\\lambda', Λ: '\\Lambda',
  μ: '\\mu', ν: '\\nu', ξ: '\\xi', Ξ: '\\Xi', ο: 'o',
  π: '\\pi', Π: '\\Pi', ρ: '\\rho', ϱ: '\\varrho',
  σ: '\\sigma', Σ: '\\Sigma', ς: '\\varsigma',
  τ: '\\tau', υ: '\\upsilon', Υ: '\\Upsilon',
  φ: '\\phi', Φ: '\\Phi', ϕ: '\\varphi',
  χ: '\\chi', ψ: '\\psi', Ψ: '\\Psi', ω: '\\omega', Ω: '\\Omega',
}

/**
 * Capital sigma and pi double as Greek letters and summation/product signs.
 * Limits are the tell — "Σᵢ₌₁ⁿ" is an operator, a bare "Σ" is a letter.
 */
const AMBIGUOUS_BIG_OPS = {
  Σ: '\\sum',
  Π: '\\prod',
}

/**
 * Combining diacritics -> LaTeX accents.
 *
 * "θ̂" is two codepoints (θ + U+0302); a naive char walk would emit the base
 * and a bare mark. Rewritten to real accent commands before the main walk.
 */
const COMBINING_ACCENTS = {
  '̀': 'grave',
  '́': 'acute',
  '̂': 'hat',
  '̃': 'tilde',
  '̄': 'bar',
  '̅': 'bar', // combining overline
  '̆': 'breve',
  '̇': 'dot',
  '̈': 'ddot',
  '̊': 'mathring',
  '̌': 'check',
  '⃗': 'vec', // combining right arrow above
}

const COMBINING_RE = new RegExp(`(\\S)([${Object.keys(COMBINING_ACCENTS).join('')}])`, 'g')

/** Rewrite "x̄" as "\bar{x}" so the LaTeX path can read it as "x bar". */
function foldCombiningAccents(src) {
  return src.replace(COMBINING_RE, (_, base, mark) => `\\${COMBINING_ACCENTS[mark]}{${base}}`)
}

/** Roots need their operand wrapped in braces, so they are handled separately. */
const ROOTS = {
  '√': '\\sqrt',
  '∛': '\\sqrt[3]',
  '∜': '\\sqrt[4]',
}

/** Every other math symbol: a straight character -> command mapping. */
const MATH_LATEX = {
  // integrals and big operators
  '∫': '\\int', '∬': '\\iint', '∭': '\\iiint', '∮': '\\oint',
  '∑': '\\sum', '∏': '\\prod', '∐': '\\coprod', '⋃': '\\bigcup', '⋂': '\\bigcap',

  // arithmetic
  '∞': '\\infty', '±': '\\pm', '∓': '\\mp', '×': '\\times', '÷': '\\div',
  '⋅': '\\cdot', '·': '\\cdot', '∘': '\\circ', '⊕': '\\oplus', '⊗': '\\otimes',
  '−': '-', // U+2212 minus sign, not the ASCII hyphen
  '⁄': '/',

  // relations
  '≤': '\\leq', '≥': '\\geq', '≠': '\\neq', '≈': '\\approx', '≅': '\\cong',
  '≡': '\\equiv', '∝': '\\propto', '≪': '\\ll', '≫': '\\gg',
  '∼': '\\sim', '≃': '\\simeq', '≜': '\\triangleq', '≐': '\\doteq',
  '≺': '\\prec', '≻': '\\succ',

  // sets and logic
  '∈': '\\in', '∉': '\\notin', '∋': '\\ni',
  '⊂': '\\subset', '⊆': '\\subseteq', '⊃': '\\supset', '⊇': '\\supseteq',
  '∪': '\\cup', '∩': '\\cap', '∖': '\\setminus',
  '∅': '\\emptyset', '⌀': '\\emptyset',
  '∀': '\\forall', '∃': '\\exists', '∄': '\\nexists',
  '∧': '\\land', '∨': '\\lor', '¬': '\\neg',

  // arrows
  '→': '\\to', '⟶': '\\to', '←': '\\leftarrow', '⟵': '\\leftarrow',
  '⇒': '\\Rightarrow', '⟹': '\\Rightarrow', '⇐': '\\Leftarrow',
  '⇔': '\\iff', '⟺': '\\iff', '↔': '\\leftrightarrow', '↦': '\\mapsto',

  // calculus and analysis
  '∂': '\\partial', '∇': '\\nabla', 'ℓ': '\\ell', 'ℏ': '\\hbar', 'ℵ': '\\aleph',

  // blackboard-bold sets
  'ℝ': '\\mathbb{R}', 'ℕ': '\\mathbb{N}', 'ℤ': '\\mathbb{Z}',
  'ℚ': '\\mathbb{Q}', 'ℂ': '\\mathbb{C}', '𝔼': '\\mathbb{E}', 'ℙ': '\\mathbb{P}',

  // misc
  '∴': '\\therefore', '∵': '\\because', '⊥': '\\perp', '∥': '\\parallel',
  '∠': '\\angle', '∣': '\\mid', '≔': '\\doteq',
  '…': '\\ldots', '⋯': '\\cdots', '⋮': '\\vdots',
  '′': '^{\\prime}', '″': '^{\\prime}^{\\prime}', '°': '\\degree',
}

/**
 * Characters that can anchor a math run. ASCII digits, letters, and
 * operators are deliberately absent — too common in ordinary prose.
 */
const STRONG_CHARS = new Set([
  ...Object.keys(GREEK_LATEX),
  ...Object.keys(MATH_LATEX),
  ...Object.keys(ROOTS),
  ...Object.keys(SUPERSCRIPT_CHARS),
  ...Object.keys(SUBSCRIPT_CHARS),
  ...Object.keys(COMBINING_ACCENTS),
])

/**
 * Characters with a dedicated spoken form that must survive style folding.
 * "𝔼" means expectation, so folding it to a plain "E" would lose that.
 */
const FOLD_EXCEPTIONS = new Set(Object.keys(MATH_LATEX).filter((ch) => ch.length > 1))

/** Is this character math notation rather than prose? */
export function isStrongMathChar(ch) {
  return STRONG_CHARS.has(ch)
}

/** Does this text contain any loose Unicode math at all? */
export function hasUnicodeMath(text) {
  for (const ch of text) if (STRONG_CHARS.has(ch)) return true
  return false
}

// ---------------------------------------------------------------------------
// Transliteration: Unicode run -> LaTeX
// ---------------------------------------------------------------------------

/**
 * Rewrite a Unicode math run as LaTeX.
 * @param {string} src
 * @returns {string}
 */
export function transliterate(input) {
  const src = foldCombiningAccents(input)
  let out = ''
  let i = 0

  while (i < src.length) {
    const ch = src[i]

    // Runs of Unicode superscripts collapse into one exponent: "⁻¹" -> "^{-1}",
    // which the speech layer then reads as "inverse".
    if (SUPERSCRIPT_CHARS[ch]) {
      let mapped = ''
      while (i < src.length && SUPERSCRIPT_CHARS[src[i]]) mapped += SUPERSCRIPT_CHARS[src[i++]]
      out += `^{${mapped}}`
      continue
    }

    if (SUBSCRIPT_CHARS[ch]) {
      let mapped = ''
      while (i < src.length && SUBSCRIPT_CHARS[src[i]]) mapped += SUBSCRIPT_CHARS[src[i++]]
      out += `_{${mapped}}`
      continue
    }

    if (ROOTS[ch]) {
      const atom = readAtom(src, i + 1)
      out += `${ROOTS[ch]}{${transliterate(atom.text)}}`
      i = atom.end
      continue
    }

    if (AMBIGUOUS_BIG_OPS[ch]) {
      out += `${takesLimits(src, i + 1) ? AMBIGUOUS_BIG_OPS[ch] : GREEK_LATEX[ch]} `
      i++
      continue
    }

    if (GREEK_LATEX[ch]) {
      out += `${GREEK_LATEX[ch]} `
      i++
      continue
    }

    // Surrogate-pair symbols ("𝔼") must be looked up as a pair, not a unit.
    const wide = src.codePointAt(i) > 0xffff ? src.slice(i, i + 2) : ch
    if (MATH_LATEX[wide]) {
      out += `${MATH_LATEX[wide]} `
      i += wide.length
      continue
    }

    // A run of ASCII letters: a known function name becomes a LaTeX command so
    // "sin θ" reads "sin of theta" instead of being spelled out as "s i n".
    if (/[A-Za-z]/.test(ch)) {
      const word = /^[A-Za-z]+/.exec(src.slice(i))[0]
      out += FUNCTIONS.has(word) ? `\\${word} ` : word
      i += word.length
      continue
    }

    out += ch
    i++
  }

  return out
}

/**
 * Does the operator at `from` carry limits? Decides Σ-as-sum vs Σ-as-letter.
 */
function takesLimits(src, from) {
  let i = from
  while (i < src.length && src[i] === ' ') i++
  const ch = src[i]
  return Boolean(ch && (SUBSCRIPT_CHARS[ch] || SUPERSCRIPT_CHARS[ch] || ch === '_' || ch === '^'))
}

/**
 * Read the operand following a root sign: "√(x+y)" takes the whole
 * parenthesized group, "√2" takes a single atom ("√2 + 1" is root-of-2 plus 1).
 */
function readAtom(src, from) {
  let i = from
  while (i < src.length && src[i] === ' ') i++

  if (src[i] === '(') {
    let depth = 0
    const start = i + 1
    for (; i < src.length; i++) {
      if (src[i] === '(') depth++
      else if (src[i] === ')') {
        depth--
        if (depth === 0) return { text: src.slice(start, i), end: i + 1 }
      }
    }
    return { text: src.slice(start), end: src.length }
  }

  // A bare atom: one identifier or number, plus any scripts riding on it.
  const match = /^(?:[A-Za-z]|\d+(?:\.\d+)?|[^\s])/.exec(src.slice(i))
  if (!match) return { text: '', end: i }

  let end = i + match[0].length
  while (end < src.length && (SUPERSCRIPT_CHARS[src[end]] || SUBSCRIPT_CHARS[src[end]])) end++
  return { text: src.slice(i, end), end }
}

// ---------------------------------------------------------------------------
// Detection: finding math runs inside prose
// ---------------------------------------------------------------------------

/** Differentials like "du"/"dx" that ride along at the end of an integral. */
const DIFFERENTIAL = /^d[A-Za-z]$/

/**
 * Split prose into tokens for run detection.
 *
 * @returns {Array<{type: string, text: string, start: number, end: number}>}
 */
function tokenizeProse(text) {
  const tokens = []
  let i = 0

  while (i < text.length) {
    const start = i
    const ch = text[i]

    // Read a full code point: some math symbols ("𝔼") are surrogate pairs, and
    // a code-unit walk would never match them against the tables.
    const cp = text.codePointAt(i)
    const wide = cp > 0xffff ? text.slice(i, i + 2) : ch

    if (STRONG_CHARS.has(wide)) {
      i += wide.length
      tokens.push({ type: 'strong', text: wide, start, end: i })
      continue
    }

    const space = /^[ \t]+/.exec(text.slice(i))
    if (space) {
      i += space[0].length
      tokens.push({ type: 'space', text: space[0], start, end: i })
      continue
    }

    const word = /^[A-Za-z]+/.exec(text.slice(i))
    if (word) {
      i += word[0].length
      tokens.push({ type: word[0].length === 1 ? 'letter' : 'word', text: word[0], start, end: i })
      continue
    }

    const number = /^\d+(?:\.\d+)?/.exec(text.slice(i))
    if (number) {
      i += number[0].length
      tokens.push({ type: 'number', text: number[0], start, end: i })
      continue
    }

    if ('+-*/=<>^_|'.includes(ch)) {
      tokens.push({ type: 'op', text: ch, start, end: ++i })
      continue
    }

    if ('()[]{}'.includes(ch)) {
      tokens.push({ type: 'bracket', text: ch, start, end: ++i })
      continue
    }

    i += wide.length
    tokens.push({ type: 'punct', text: wide, start, end: i })
  }

  return tokens
}

/**
 * May this token join a run?
 *
 * @param {object} token
 * @param {boolean} acrossSpace Whether a space separates it from the run.
 */
function joinable(token, acrossSpace) {
  switch (token.type) {
    case 'strong':
    case 'number':
    case 'letter':
    case 'op':
      return true
    case 'bracket':
      return true
    case 'word':
      // Function names join even across a space ("sin θ"); differentials only
      // join when glued on ("φ(u)du") — a free-standing "du" reads as a word.
      if (FUNCTIONS.has(token.text)) return true
      return !acrossSpace && DIFFERENTIAL.test(token.text)
    default:
      return false
  }
}

/**
 * Find the maximal math runs in a string.
 *
 * @param {string} text
 * @returns {Array<{start: number, end: number}>} Character offsets.
 */
export function findMathRuns(text) {
  const tokens = tokenizeProse(text)
  const runs = []

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== 'strong') continue

    let left = i
    let right = i

    // Walk outward, allowed to cross a single space at a time provided the
    // token beyond it is still math-like.
    for (let k = i - 1; k >= 0; ) {
      const token = tokens[k]
      if (token.type === 'space') {
        const prev = tokens[k - 1]
        if (!prev || !joinable(prev, true)) break
        left = k - 1
        k -= 2
        continue
      }
      if (!joinable(token, false)) break
      left = k
      k--
    }

    for (let k = i + 1; k < tokens.length; ) {
      const token = tokens[k]
      if (token.type === 'space') {
        const nextToken = tokens[k + 1]
        if (!nextToken || !joinable(nextToken, true)) break
        right = k + 1
        k += 2
        continue
      }
      if (!joinable(token, false)) break
      right = k
      k++
    }

    const run = { start: tokens[left].start, end: tokens[right].end }
    const last = runs[runs.length - 1]
    // Two triggers in one expression can produce overlapping runs — merge them.
    if (last && run.start <= last.end) last.end = Math.max(last.end, run.end)
    else runs.push(run)

    i = right
  }

  return runs
}

/**
 * Replace every loose-Unicode math run in a prose string with spoken English.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeUnicodeMath(input) {
  if (!input) return input

  // Fold unconditionally: turning "𝑥" into "x" helps even with no math run around it.
  const text = foldStyledMath(input, FOLD_EXCEPTIONS)

  if (!hasUnicodeMath(text)) return nameStraySymbols(text)

  const runs = findMathRuns(text)
  if (!runs.length) return nameStraySymbols(text)

  let out = ''
  let cursor = 0

  for (const run of runs) {
    out += text.slice(cursor, run.start)
    const source = text.slice(run.start, run.end)
    // If a run renders to nothing, keep the original characters.
    const speech = latexToSpeech(transliterate(source)) || source

    // A run can sit flush against a word that didn't join it ("AB²" — "AB"
    // stays out). Force a boundary space so it doesn't read as "ABsquared".
    if (/\w$/.test(out) && /^\w/.test(speech)) out += ' '
    out += speech
    cursor = run.end
  }

  const tail = text.slice(cursor)
  if (/\w$/.test(out) && /^\w/.test(tail)) out += ' '
  out += tail
  return nameStraySymbols(out)
}

/**
 * Give a spoken name to math symbols left sitting in prose — ones with no
 * LaTeX mapping ("⨁") or that sat alone in a sentence. Scoped to Unicode math
 * blocks so ordinary typography (em dashes, curly quotes), CJK and emoji stay untouched.
 */
function nameStraySymbols(text) {
  let out = ''
  for (const ch of text) {
    if (isUnnamedMathSymbol(ch)) {
      out += NAMED_SYMBOLS[ch] ? ` ${NAMED_SYMBOLS[ch]} ` : ' symbol '
      continue
    }
    out += ch
  }
  return out === text ? text : out.replace(/[ \t]{2,}/g, ' ')
}
