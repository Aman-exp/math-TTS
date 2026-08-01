/**
 * Phase 2 corpus: loose Unicode math typed straight into prose.
 *
 * The UNTOUCHED block is the important half. A heuristic detector earns trust by
 * what it leaves alone, and every entry there is a plausible sentence that a
 * careless trigger rule would mangle. Regressions in that block are worse than
 * a missed reading in the block above it: mangling ordinary prose makes the app
 * useless for its main job, whereas a missed math reading only makes it
 * incomplete.
 */

export const UNICODE_CASES = [
  // --- the canonical BUILD.md example, with no LaTeX delimiters -----------
  {
    name: 'dispersion-index integral in loose unicode',
    input: '∫₀^∞ φ(u)du',
    expected: 'the integral from zero to infinity of phi of u, d u',
  },

  // --- superscripts and subscripts ---------------------------------------
  { name: 'unicode square', input: 'x²', expected: 'x squared' },
  { name: 'unicode cube', input: 'x³', expected: 'x cubed' },
  { name: 'unicode inverse', input: 'A⁻¹', expected: 'A inverse' },
  { name: 'unicode subscript', input: 'x₁', expected: 'x sub one' },
  { name: 'multi-digit subscript', input: 'a₁₂', expected: 'a sub 12' },
  {
    name: 'pythagorean theorem in unicode',
    input: 'x² + y² = z²',
    expected: 'x squared plus y squared equals z squared',
  },

  // --- greek letters ------------------------------------------------------
  { name: 'bare greek letter', input: 'σ', expected: 'sigma' },
  { name: 'greek with exponent', input: 'σ²', expected: 'sigma squared' },
  {
    name: 'variance over mean, loose',
    input: 'σ²/μ',
    expected: 'sigma squared divided by mu',
  },
  { name: 'capital greek', input: 'Ω', expected: 'capital omega' },

  // --- the sigma / summation ambiguity -----------------------------------
  {
    name: 'bare capital sigma is a letter',
    input: 'The Σ symbol',
    expected: 'The capital sigma symbol',
  },
  {
    name: 'capital sigma with limits is a summation',
    input: 'Σᵢ₌₁ⁿ xᵢ',
    expected: 'the sum from i equals one to n of x sub i',
  },
  {
    name: 'unambiguous summation sign',
    input: '∑ᵢ₌₁ⁿ xᵢ',
    expected: 'the sum from i equals one to n of x sub i',
  },

  // --- operators and relations -------------------------------------------
  { name: 'less than or equal', input: 'x ≤ 5', expected: 'x is less than or equal to five' },
  { name: 'not equal', input: 'a ≠ b', expected: 'a is not equal to b' },
  { name: 'approximately', input: 'π ≈ 3.14', expected: 'pi is approximately 3.14' },
  { name: 'plus or minus', input: '5 ± 2', expected: 'five plus or minus two' },
  { name: 'multiplication sign', input: '3 × 4', expected: 'three times four' },
  { name: 'element of the reals', input: 'x ∈ ℝ', expected: 'x is in the real numbers' },
  { name: 'infinity', input: 'n → ∞', expected: 'n goes to infinity' },
  { name: 'unicode minus sign', input: '5 − 3', expected: 'five minus three' },

  // --- roots --------------------------------------------------------------
  { name: 'square root of a number', input: '√2', expected: 'the square root of two' },
  { name: 'square root of a variable', input: '√x', expected: 'the square root of x' },
  {
    name: 'root takes only its atom, not the whole sum',
    input: '√2 + 1',
    expected: 'the square root of two plus one',
  },
  {
    name: 'root of a parenthesized group',
    input: '√(x + y)',
    expected: 'the square root of x plus y, end root',
  },
  { name: 'cube root', input: '∛8', expected: 'the cube root of eight' },

  // --- functions ----------------------------------------------------------
  { name: 'function name without parens', input: 'sin θ', expected: 'sin of theta' },
  { name: 'function name with parens', input: 'cos(θ)', expected: 'cos of theta' },
  { name: 'partial derivative', input: '∂u/∂t', expected: 'partial u divided by partial t' },

  // --- combining diacritics ----------------------------------------------
  // "θ̂" is two codepoints, not one. Statistics prose is full of these.
  { name: 'theta hat (combining circumflex)', input: 'θ̂', expected: 'theta hat' },
  { name: 'x bar (combining macron)', input: 'x̄', expected: 'x bar' },
  { name: 'v vector (combining arrow)', input: 'v⃗', expected: 'v vector' },
  {
    name: 'estimator converging, with accents mid-sentence',
    input: 'The estimator θ̂ converges to θ.',
    expected: 'The estimator theta hat converges to theta.',
  },
  {
    name: 'sum of squared deviations keeps parens balanced',
    input: 'Σᵢ₌₁ⁿ (xᵢ − x̄)²',
    expected: 'the sum from i equals one to n of open paren x sub i minus x bar close paren squared',
  },

  // --- prose integration --------------------------------------------------
  {
    name: 'math embedded mid-sentence',
    input: 'We know x² + 1 is positive.',
    expected: 'We know x squared plus one is positive.',
  },
  {
    name: 'greek mid-sentence keeps surrounding prose',
    input: 'The variance σ² is small.',
    expected: 'The variance sigma squared is small.',
  },
  {
    name: 'two separate math runs in one sentence',
    input: 'If x ≤ 5 and y ≥ 2 then done.',
    expected: 'If x is less than or equal to five and y is greater than or equal to two then done.',
  },
  {
    name: 'degrees',
    input: 'It is 30° today.',
    expected: 'It is 30 degrees today.',
  },
]

/**
 * Prose that must survive untouched.
 *
 * Each of these breaks under a naive rule — hyphens as minus signs, parentheses
 * as spoken delimiters, digits anchoring a run on their own.
 */
export const UNTOUCHED_CASES = [
  { name: 'hyphenated word', input: 'This is a well-known result.' },
  { name: 'parenthetical aside', input: 'The answer (see below) is clear.' },
  { name: 'plain arithmetic in prose', input: 'I have 5 apples and 3 oranges.' },
  { name: 'date range', input: 'The 1990-2000 period was quiet.' },
  { name: 'no math at all', input: 'The quick brown fox jumps over the lazy dog.' },
  { name: 'email-ish text', input: 'Contact me at first-last for details.' },
  { name: 'time of day', input: 'Meet me at 3:30 tomorrow.' },
  { name: 'sentence with x as a word', input: 'The letter x marks the spot.' },
  { name: 'currency and percent', input: 'It rose 5% to 100 dollars.' },
  { name: 'a lone equals sign in prose', input: 'The = sign is used here.' },
  { name: 'file path', input: 'Open src/ui/app.js and edit it.' },
  { name: 'decimal in prose', input: 'Version 3.14 was released.' },
]
