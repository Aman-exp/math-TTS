/**
 * Shared spoken-form vocabulary, used by both the LaTeX and loose-Unicode
 * paths. Every entry maps to lowercase spoken English with no punctuation —
 * callers add the surrounding commas and pauses.
 */

/** LaTeX command name -> spoken form. Greek letters. */
export const GREEK = {
  alpha: 'alpha',
  beta: 'beta',
  gamma: 'gamma',
  Gamma: 'capital gamma',
  delta: 'delta',
  Delta: 'capital delta',
  epsilon: 'epsilon',
  varepsilon: 'epsilon',
  zeta: 'zeta',
  eta: 'eta',
  theta: 'theta',
  Theta: 'capital theta',
  vartheta: 'theta',
  iota: 'iota',
  kappa: 'kappa',
  lambda: 'lambda',
  Lambda: 'capital lambda',
  mu: 'mu',
  nu: 'nu',
  xi: 'xi',
  Xi: 'capital xi',
  pi: 'pi',
  Pi: 'capital pi',
  rho: 'rho',
  varrho: 'rho',
  sigma: 'sigma',
  Sigma: 'capital sigma',
  varsigma: 'sigma',
  tau: 'tau',
  upsilon: 'upsilon',
  Upsilon: 'capital upsilon',
  phi: 'phi',
  Phi: 'capital phi',
  varphi: 'phi',
  chi: 'chi',
  psi: 'psi',
  Psi: 'capital psi',
  omega: 'omega',
  Omega: 'capital omega',
}

/** Unicode Greek codepoint -> spoken form. */
export const GREEK_UNICODE = {
  α: 'alpha', β: 'beta', γ: 'gamma', Γ: 'capital gamma',
  δ: 'delta', Δ: 'capital delta', ε: 'epsilon', ϵ: 'epsilon',
  ζ: 'zeta', η: 'eta', θ: 'theta', Θ: 'capital theta', ϑ: 'theta',
  ι: 'iota', κ: 'kappa', λ: 'lambda', Λ: 'capital lambda',
  μ: 'mu', ν: 'nu', ξ: 'xi', Ξ: 'capital xi',
  π: 'pi', Π: 'capital pi', ρ: 'rho', ϱ: 'rho',
  σ: 'sigma', Σ: 'capital sigma', ς: 'sigma',
  τ: 'tau', υ: 'upsilon', Υ: 'capital upsilon',
  φ: 'phi', Φ: 'capital phi', ϕ: 'phi',
  χ: 'chi', ψ: 'psi', Ψ: 'capital psi', ω: 'omega', Ω: 'capital omega',
}

/** Binary operators and relations. Renderer adds spaces: "a+b" -> "a plus b". */
export const OPERATORS = {
  '+': 'plus',
  '-': 'minus',
  '*': 'times',
  '/': 'divided by',
  '=': 'equals',
  '<': 'is less than',
  '>': 'is greater than',
  ',': ',',
  ';': ';',
  '!': 'factorial',
  ':': 'colon',
  '|': 'given', // conditional probability reading
}

/** LaTeX command -> spoken form, for operators, relations, arrows, sets. */
export const COMMAND_SYMBOLS = {
  // arithmetic
  times: 'times', cdot: 'times', div: 'divided by', pm: 'plus or minus',
  mp: 'minus or plus', ast: 'times', star: 'star', circ: 'composed with',
  bullet: 'times', oplus: 'circle plus', otimes: 'circle times',

  // relations
  neq: 'is not equal to', ne: 'is not equal to', equiv: 'is equivalent to',
  approx: 'is approximately', sim: 'is similar to', simeq: 'is approximately',
  cong: 'is congruent to', propto: 'is proportional to',
  leq: 'is less than or equal to', le: 'is less than or equal to',
  geq: 'is greater than or equal to', ge: 'is greater than or equal to',
  ll: 'is much less than', gg: 'is much greater than',
  prec: 'precedes', succ: 'succeeds',
  doteq: 'is defined as', triangleq: 'is defined as',
  mid: 'given', // P(A \mid B)
  colon: 'colon', vert: 'given',

  // set theory / logic
  in: 'is in', notin: 'is not in', ni: 'contains',
  subset: 'is a subset of', subseteq: 'is a subset of or equal to',
  supset: 'is a superset of', supseteq: 'is a superset of or equal to',
  cup: 'union', cap: 'intersection', setminus: 'set minus',
  emptyset: 'the empty set', varnothing: 'the empty set',
  forall: 'for all', exists: 'there exists', nexists: 'there does not exist',
  land: 'and', wedge: 'and', lor: 'or', vee: 'or', neg: 'not', lnot: 'not',
  therefore: 'therefore', because: 'because',

  // arrows
  to: 'goes to', rightarrow: 'goes to', Rightarrow: 'implies',
  leftarrow: 'is implied by', Leftarrow: 'is implied by',
  leftrightarrow: 'if and only if', Leftrightarrow: 'if and only if',
  iff: 'if and only if', implies: 'implies', mapsto: 'maps to',
  longrightarrow: 'goes to', uparrow: 'up arrow', downarrow: 'down arrow',

  // named constants and sets
  infty: 'infinity', partial: 'partial', nabla: 'del', ell: 'l',
  hbar: 'h bar', aleph: 'aleph', Re: 'real part', Im: 'imaginary part',
  mathbb: null, // handled structurally

  // misc
  ldots: 'and so on', dots: 'and so on', cdots: 'and so on',
  vdots: 'and so on', ddots: 'and so on',
  prime: 'prime', degree: 'degrees', percent: 'percent',
  angle: 'angle', perp: 'is perpendicular to', parallel: 'is parallel to',
  quad: ' ', qquad: ' ', ',': ' ', ';': ' ', ':': ' ', '!': '',
}

/** Blackboard-bold sets: \mathbb{R} -> "the reals". */
export const BLACKBOARD = {
  R: 'the real numbers',
  N: 'the natural numbers',
  Z: 'the integers',
  Q: 'the rationals',
  C: 'the complex numbers',
  E: 'the expectation',
  P: 'the probability',
  1: 'the indicator',
}

/**
 * Named functions. Presence here licenses "f of x" instead of "f times x" —
 * see FUNCTION_LETTERS for the single-letter heuristic.
 */
export const FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
  'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'coth',
  'log', 'ln', 'lg', 'exp', 'det', 'dim', 'ker', 'deg', 'gcd',
  'min', 'max', 'inf', 'sup', 'arg', 'Pr', 'mod',
])

/** Big operators that take limits: \sum_{i=1}^{n}. */
export const BIG_OPERATORS = {
  sum: { speech: 'the sum', unicode: '∑' },
  prod: { speech: 'the product', unicode: '∏' },
  coprod: { speech: 'the coproduct', unicode: '∐' },
  int: { speech: 'the integral', unicode: '∫' },
  iint: { speech: 'the double integral', unicode: '∬' },
  iiint: { speech: 'the triple integral', unicode: '∭' },
  oint: { speech: 'the contour integral', unicode: '∮' },
  lim: { speech: 'the limit', unicode: null, asLimit: true },
  limsup: { speech: 'the limit superior', unicode: null, asLimit: true },
  liminf: { speech: 'the limit inferior', unicode: null, asLimit: true },
  bigcup: { speech: 'the union', unicode: '⋃' },
  bigcap: { speech: 'the intersection', unicode: '⋂' },
}

/**
 * Single letters that read as functions when applied to a parenthesized
 * argument. Everything else reads as multiplication ("a(b+c)" is usually a
 * product). Heuristic — will occasionally be wrong in both directions.
 */
export const FUNCTION_LETTERS = new Set([
  'f', 'g', 'h', 'F', 'G', 'H', 'p', 'q', 'P', 'Q', 'u', 'v', 'w', 'T',
  // Greek letters conventionally used for functions and densities
  'phi', 'varphi', 'psi', 'sigma', 'mu', 'nu', 'lambda', 'rho', 'tau',
  'Phi', 'Psi', 'Gamma', 'zeta', 'chi', 'theta', 'eta',
])

/** Accents: \hat{x} -> "x hat". Postfix reads better aloud than prefix. */
export const ACCENTS = {
  hat: 'hat', widehat: 'hat', bar: 'bar', overline: 'bar',
  tilde: 'tilde', widetilde: 'tilde', vec: 'vector',
  dot: 'dot', ddot: 'double dot', check: 'check', acute: 'acute',
  grave: 'grave', breve: 'breve', mathring: 'ring',
}

/**
 * Symbols outside the core math vocabulary that still have an obvious name.
 * Kokoro renders unknown codepoints as silence, so naming them beats dropping them.
 */
export const NAMED_SYMBOLS = {
  '†': 'dagger', '‡': 'double dagger', '§': 'section', '¶': 'paragraph',
  '©': 'copyright', '®': 'registered', '™': 'trademark',
  '№': 'number', '‰': 'per mille', '¤': 'currency',
  '£': 'pounds', '€': 'euros', '¥': 'yen', '¢': 'cents',
  '¼': 'one quarter', '½': 'one half', '¾': 'three quarters',
  '⅓': 'one third', '⅔': 'two thirds', '⅛': 'one eighth',
  '☐': 'checkbox', '☑': 'checked box', '✓': 'check', '✔': 'check',
  '✗': 'cross', '✘': 'cross', '★': 'star', '☆': 'star',
  '•': 'bullet', '‣': 'bullet', '◦': 'bullet', '·': 'dot',
  '«': 'quote', '»': 'unquote', '“': '"', '”': '"', '‘': "'", '’': "'",
  '–': '-', '—': '-', '―': '-', '‑': '-',
  '⟨': 'left angle bracket', '⟩': 'right angle bracket',
  '⌈': 'ceiling', '⌉': 'end ceiling', '⌊': 'floor', '⌋': 'end floor',
  '⊤': 'top', '⊢': 'proves', '⊨': 'models', '⊣': 'reverse turnstile',
  '∎': 'end of proof', '□': 'box', '△': 'triangle', '○': 'circle',
  '∗': 'times', '⋆': 'star', '≀': 'wreath product',
  '↑': 'up arrow', '↓': 'down arrow', '↕': 'up down arrow',
  '⇑': 'double up arrow', '⇓': 'double down arrow',
  '↗': 'up right arrow', '↘': 'down right arrow',
  '≥': 'is greater than or equal to', '≤': 'is less than or equal to',
}

/**
 * Unicode blocks that are unambiguously mathematical. An unnamed character in
 * one of these still gets a spoken placeholder rather than silence.
 */
const MATH_BLOCKS = [
  [0x2190, 0x21ff], // Arrows
  [0x2200, 0x22ff], // Mathematical Operators
  [0x2300, 0x23ff], // Miscellaneous Technical
  [0x25a0, 0x25ff], // Geometric Shapes
  [0x27c0, 0x27ef], // Miscellaneous Mathematical Symbols-A
  [0x2900, 0x297f], // Supplemental Arrows-B
  [0x2980, 0x29ff], // Miscellaneous Mathematical Symbols-B
  [0x2a00, 0x2aff], // Supplemental Mathematical Operators
]

/** Is this a math symbol we have no spoken name for? */
export function isUnnamedMathSymbol(ch) {
  const cp = ch.codePointAt(0)
  return MATH_BLOCKS.some(([lo, hi]) => cp >= lo && cp <= hi)
}

/** Digits spoken as words — more reliable than trusting TTS digit handling. */
export const DIGIT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

/** Unicode superscript/subscript characters -> the digit or sign they encode. */
export const SUPERSCRIPT_CHARS = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁺': '+', '⁻': '-', '⁼': '=', '⁽': '(', '⁾': ')',
  'ⁿ': 'n', 'ⁱ': 'i',
}

export const SUBSCRIPT_CHARS = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  '₊': '+', '₋': '-', '₌': '=', '₍': '(', '₎': ')',
  'ₐ': 'a', 'ₑ': 'e', 'ₒ': 'o', 'ₓ': 'x', 'ₕ': 'h',
  'ₖ': 'k', 'ₗ': 'l', 'ₘ': 'm', 'ₙ': 'n', 'ₚ': 'p', 'ₛ': 's', 'ₜ': 't',
  'ᵢ': 'i', 'ⱼ': 'j',
}

/** Single digits become words; longer numerals pass through (TTS reads "1024" fine already). */
export function speakNumber(text) {
  if (text.length === 1 && DIGIT_WORDS[text]) return DIGIT_WORDS[text]
  return text
}
