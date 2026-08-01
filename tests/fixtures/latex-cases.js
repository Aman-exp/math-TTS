/**
 * LaTeX-delimited math test corpus.
 *
 * `expected` is matched exactly. Where a construct has several defensible
 * readings, changing the expected value is a real decision, not a test fix.
 */

export const LATEX_CASES = [
  // --- canonical example ---------------------------------------------------
  {
    name: 'dispersion-index integral (the canonical example)',
    input: '$\\int_0^\\infty \\phi(u) du$',
    expected: 'the integral from zero to infinity of phi of u, d u',
  },

  // --- basic arithmetic and relations ------------------------------------
  { name: 'simple sum', input: '$a + b$', expected: 'a plus b' },
  { name: 'equality', input: '$x = 5$', expected: 'x equals five' },
  { name: 'inequality', input: '$x \\leq 10$', expected: 'x is less than or equal to 10' },
  { name: 'plus or minus', input: '$a \\pm b$', expected: 'a plus or minus b' },
  { name: 'multiplication dot', input: '$3 \\cdot 4$', expected: 'three times four' },
  { name: 'decimal kept whole', input: '$3.14$', expected: '3.14' },

  // --- powers -------------------------------------------------------------
  { name: 'square', input: '$x^2$', expected: 'x squared' },
  { name: 'cube', input: '$x^3$', expected: 'x cubed' },
  { name: 'arbitrary power', input: '$x^n$', expected: 'x to the power of n' },
  { name: 'inverse', input: '$A^{-1}$', expected: 'A inverse' },
  { name: 'transpose', input: '$A^T$', expected: 'A transpose' },

  // --- subscripts ---------------------------------------------------------
  { name: 'subscript', input: '$x_1$', expected: 'x sub one' },
  { name: 'named subscript', input: '$a_n$', expected: 'a sub n' },
  { name: 'sub and superscript', input: '$x_i^2$', expected: 'x sub i squared' },
  { name: 'reversed script order', input: '$x^2_i$', expected: 'x sub i squared' },

  // --- fractions ----------------------------------------------------------
  { name: 'named fraction one half', input: '$\\frac{1}{2}$', expected: 'one half' },
  { name: 'named fraction three quarters', input: '$\\frac{3}{4}$', expected: 'three quarters' },
  { name: 'simple fraction', input: '$\\frac{a}{b}$', expected: 'a over b' },
  {
    name: 'complex fraction gets bracketing',
    input: '$\\frac{x + 1}{y - 2}$',
    expected: 'the fraction x plus one over y minus two, end fraction',
  },
  {
    name: 'variance over mean (dispersion index, as a fraction)',
    input: 'The dispersion index is $\\frac{\\sigma^2}{\\mu}$.',
    expected: 'The dispersion index is sigma squared over mu.',
  },

  // --- roots --------------------------------------------------------------
  { name: 'square root', input: '$\\sqrt{2}$', expected: 'the square root of two' },
  {
    name: 'square root of a sum',
    input: '$\\sqrt{x + y}$',
    expected: 'the square root of x plus y, end root',
  },
  { name: 'cube root', input: '$\\sqrt[3]{8}$', expected: 'the cube root of eight' },

  // --- big operators ------------------------------------------------------
  {
    name: 'sum with limits',
    input: '$\\sum_{i=1}^{n} x_i$',
    expected: 'the sum from i equals one to n of x sub i',
  },
  {
    name: 'product with limits',
    input: '$\\prod_{k=1}^{m} a_k$',
    expected: 'the product from k equals one to m of a sub k',
  },
  {
    name: 'limit',
    input: '$\\lim_{x \\to 0} f(x)$',
    expected: 'the limit as x goes to zero of f of x',
  },
  {
    name: 'definite integral',
    input: '$\\int_a^b f(x) dx$',
    expected: 'the integral from a to b of f of x, d x',
  },
  {
    name: 'integral with greek differential',
    input: '$\\int_0^{2\\pi} \\cos(\\theta) d\\theta$',
    expected: 'the integral from zero to two pi of cos of theta, d theta',
  },

  // --- functions ----------------------------------------------------------
  { name: 'named function', input: '$\\sin(x)$', expected: 'sin of x' },
  { name: 'natural log', input: '$\\ln(x)$', expected: 'natural log of x' },
  { name: 'function of a sum', input: '$f(x + 1)$', expected: 'f of x plus one' },
  {
    name: 'non-function letter reads as parenthesized product',
    input: '$a(b + c)$',
    expected: 'a open paren b plus c close paren',
  },

  // --- greek and sets -----------------------------------------------------
  { name: 'lowercase greek', input: '$\\alpha \\beta \\gamma$', expected: 'alpha beta gamma' },
  { name: 'capital greek', input: '$\\Omega$', expected: 'capital omega' },
  { name: 'blackboard reals', input: '$x \\in \\mathbb{R}$', expected: 'x is in the real numbers' },
  { name: 'infinity', input: '$\\infty$', expected: 'infinity' },
  { name: 'subset', input: '$A \\subseteq B$', expected: 'A is a subset of or equal to B' },

  // --- accents and decorations -------------------------------------------
  { name: 'hat', input: '$\\hat{\\theta}$', expected: 'theta hat' },
  { name: 'bar', input: '$\\bar{x}$', expected: 'x bar' },
  { name: 'vector', input: '$\\vec{v}$', expected: 'v vector' },

  // --- delimiters ---------------------------------------------------------
  { name: 'absolute value', input: '$|x|$', expected: 'the absolute value of x' },
  { name: 'redundant parens dropped', input: '$(x)$', expected: 'x' },
  {
    name: 'left-right sizing is transparent',
    input: '$\\left( \\frac{a}{b} \\right)$',
    expected: 'open paren a over b close paren',
  },

  // --- probability idioms -------------------------------------------------
  {
    name: 'conditional probability with \\mid',
    input: '$P(A \\mid B)$',
    expected: 'P of A given B',
  },
  {
    name: 'expectation uses brackets but still reads "of"',
    input: '$\\mathbb{E}[X]$',
    expected: 'the expectation of X',
  },
  {
    name: 'bayes theorem',
    input: '$P(A \\mid B) = \\frac{P(B \\mid A) P(A)}{P(B)}$',
    expected:
      'P of A given B equals the fraction P of B given A P of A over P of B, end fraction',
  },

  // --- prose integration --------------------------------------------------
  {
    name: 'inline math inside a sentence',
    input: 'We know that $x^2 + y^2 = z^2$ holds.',
    expected: 'We know that x squared plus y squared equals z squared holds.',
  },
  {
    name: 'display math gets pause commas',
    input: 'Consider $$E = mc^2$$ which is famous.',
    expected: 'Consider, E equals m c squared, which is famous.',
  },
  {
    name: 'paren-delimited inline math',
    input: 'Let \\(n \\to \\infty\\) here.',
    expected: 'Let n goes to infinity here.',
  },
  {
    name: 'bracket-delimited display math',
    input: 'Then \\[a^2 = b\\] follows.',
    expected: 'Then, a squared equals b, follows.',
  },
  {
    name: 'two math spans in one sentence',
    input: 'If $a > 0$ and $b > 0$ then the product is positive.',
    expected: 'If a is greater than zero and b is greater than zero then the product is positive.',
  },
  {
    name: 'text inside math is read as prose',
    input: '$x = 1 \\text{ if even}$',
    expected: 'x equals one if even',
  },

  // --- things that must NOT be treated as math ---------------------------
  {
    name: 'currency is left alone',
    input: 'It costs $5 and $10 more.',
    expected: 'It costs $5 and $10 more.',
  },
  {
    name: 'escaped dollar is literal',
    input: 'A \\$5 fee.',
    expected: 'A $5 fee.',
  },
  {
    name: 'unterminated delimiter does not swallow the document',
    input: 'A $ lonely dollar here.',
    expected: 'A $ lonely dollar here.',
  },
  {
    name: 'plain prose is untouched',
    input: 'No math at all in this sentence.',
    expected: 'No math at all in this sentence.',
  },

  // --- robustness ---------------------------------------------------------
  {
    name: 'unknown command is spoken, not dropped',
    input: '$\\foo{x}$',
    expected: 'foo x',
  },
  {
    name: 'unbalanced brace does not throw',
    input: '$\\frac{a}{$',
    expected: 'a over',
  },
]

/** Longer, realistic paste — the kind of thing a user actually drops in. */
export const PASSAGE_CASE = {
  name: 'realistic multi-sentence passage',
  input: [
    'The dispersion index $D$ is defined as $D = \\frac{\\sigma^2}{\\mu}$,',
    'where $\\sigma^2$ is the variance and $\\mu$ is the mean.',
    'For a Poisson process, $D = 1$.',
  ].join(' '),
  expected: [
    'The dispersion index D is defined as D equals sigma squared over mu,',
    'where sigma squared is the variance and mu is the mean.',
    'For a Poisson process, D equals one.',
  ].join(' '),
}
