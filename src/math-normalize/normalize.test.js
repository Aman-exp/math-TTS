import { describe, it, expect } from 'vitest'
import { normalize } from './normalize.js'
import { detectSegments } from './detect.js'
import { latexToSpeech } from './latex-to-speech.js'
import { parseLatex } from './latex-parser.js'
import { normalizeUnicodeMath, findMathRuns, transliterate } from './unicode-math-rules.js'
import { LATEX_CASES, PASSAGE_CASE } from '../../tests/fixtures/latex-cases.js'
import { UNICODE_CASES, UNTOUCHED_CASES } from '../../tests/fixtures/unicode-cases.js'

describe('normalize — LaTeX corpus', () => {
  for (const { name, input, expected } of LATEX_CASES) {
    it(name, () => {
      expect(normalize(input)).toBe(expected)
    })
  }

  it(PASSAGE_CASE.name, () => {
    expect(normalize(PASSAGE_CASE.input)).toBe(PASSAGE_CASE.expected)
  })
})

describe('normalize — loose Unicode corpus', () => {
  for (const { name, input, expected } of UNICODE_CASES) {
    it(name, () => {
      expect(normalize(input)).toBe(expected)
    })
  }
})

describe('normalize — prose that must not be touched', () => {
  for (const { name, input } of UNTOUCHED_CASES) {
    it(name, () => {
      expect(normalize(input)).toBe(input)
    })
  }

  it('finds no runs in plain prose', () => {
    for (const { input } of UNTOUCHED_CASES) {
      expect(findMathRuns(input)).toEqual([])
    }
  })
})

describe('unicode/LaTeX interaction', () => {
  it('leaves unicode inside a LaTeX span to the LaTeX path', () => {
    expect(normalize('$x^2$ and y²')).toBe('x squared and y squared')
  })

  it('can be switched off for strict LaTeX-only behaviour', () => {
    expect(normalize('x²', { unicodeMath: false })).toBe('x²')
  })

  it('handles unicode math and LaTeX math in one input', () => {
    expect(normalize('Both σ² and $\\mu$ matter.')).toBe('Both sigma squared and mu matter.')
  })
})

describe('styled-unicode folding (PDF paste)', () => {
  const cases = [
    { name: 'italic latin letters', input: '\u{1D465}²', expected: 'x squared' },
    { name: 'italic greek', input: 'The variance \u{1D70E}²', expected: 'The variance sigma squared' },
    { name: 'italic capital greek', input: '\u{1D6E4}(\u{1D45B})', expected: 'capital gamma of n' },
    { name: 'bold latin', input: '\u{1D400}\u{1D401}²', expected: 'AB squared' },
    { name: 'double-struck folds to plain', input: 'Set \u{1D538}²', expected: 'Set A squared' },
    { name: 'bold digits', input: '\u{1D7CE}\u{1D7CF}²', expected: '01 squared' },
    { name: 'letterlike script', input: 'ℒ²', expected: 'L squared' },
  ]

  for (const { name, input, expected } of cases) {
    it(name, () => {
      expect(normalize(input)).toBe(expected)
    })
  }

  it('keeps expectation notation rather than folding it to a bare E', () => {
    expect(normalize('\u{1D53C}[\u{1D44B}]')).toBe('the expectation of X')
  })

  it('folds styled letters even when no math run forms', () => {
    expect(normalize('\u{1D465} is a variable')).toBe('x is a variable')
  })
})

describe('unrecognized symbol fallback', () => {
  it('names a known-but-uncommon symbol', () => {
    expect(normalize('We have ⊨ semantics.')).toContain('models')
  })

  it('gives an unmapped math-block symbol a spoken placeholder', () => {
    expect(normalize('The ⨁ operator.')).toContain('symbol')
  })

  it('leaves ordinary typography alone', () => {
    const prose = 'Run it — it “just works” today.'
    expect(normalize(prose)).toBe(prose)
  })

  it('does not name emoji or CJK as symbols', () => {
    expect(normalize('Ship it \u{1F680} now')).toBe('Ship it \u{1F680} now')
  })
})

describe('transliterate', () => {
  it('maps unicode scripts to LaTeX scripts', () => {
    expect(transliterate('x²')).toBe('x^{2}')
    expect(transliterate('x₁')).toBe('x_{1}')
  })

  it('collapses a run of superscripts into one exponent', () => {
    expect(transliterate('A⁻¹')).toBe('A^{-1}')
  })

  it('wraps a root operand in braces', () => {
    expect(transliterate('√2')).toBe('\\sqrt{2}')
  })
})

describe('detectSegments', () => {
  it('splits prose from math', () => {
    expect(detectSegments('a $x$ b')).toEqual([
      { type: 'text', content: 'a ' },
      { type: 'math', content: 'x', display: false, raw: '$x$' },
      { type: 'text', content: ' b' },
    ])
  })

  it('prefers $$ over $ for display math', () => {
    const [segment] = detectSegments('$$x^2$$')
    expect(segment).toMatchObject({ type: 'math', content: 'x^2', display: true })
  })

  it('returns an empty list for empty input', () => {
    expect(detectSegments('')).toEqual([])
  })
})

describe('robustness', () => {
  const nasty = [
    '',
    '$',
    '$$',
    '$$$',
    '\\frac',
    '$\\frac{}{}$',
    '${{{{$',
    '$}}}}$',
    '$\\left($',
    '$\\begin{pmatrix}$',
    '$x_$',
    '$^$',
    '$_{}^{}$',
    '$\\\\$',
    '$\\int_$',
    '$a^^b$',
    '$\\sqrt[$',
    '$\\text{$',
    '$'.repeat(50),
    '\\('.repeat(20),
  ]

  for (const input of nasty) {
    it(`does not throw on ${JSON.stringify(input)}`, () => {
      expect(() => normalize(input)).not.toThrow()
      expect(typeof normalize(input)).toBe('string')
    })
  }

  it('never returns undefined or null', () => {
    for (const input of nasty) {
      expect(normalize(input)).not.toBeUndefined()
      expect(normalize(input)).not.toBeNull()
    }
  })
})

describe('parseLatex', () => {
  it('always returns a seq node', () => {
    expect(parseLatex('x').type).toBe('seq')
    expect(parseLatex('').type).toBe('seq')
  })

  it('parses nested fractions without losing structure', () => {
    const ast = parseLatex('\\frac{\\frac{a}{b}}{c}')
    expect(ast.items[0].type).toBe('frac')
    expect(ast.items[0].num.body.type).toBe('frac')
  })
})

describe('latexToSpeech', () => {
  it('speaks nested fractions with audible bracketing', () => {
    expect(latexToSpeech('\\frac{\\frac{a}{b}}{c}')).toBe(
      'the fraction a over b over c, end fraction'
    )
  })

  it('handles a sum of fractions', () => {
    expect(latexToSpeech('\\sum_{i=1}^{n} \\frac{1}{i}')).toBe(
      'the sum from i equals one to n of one over i'
    )
  })

  it('reads a matrix with its dimensions first', () => {
    expect(latexToSpeech('\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}')).toContain('matrix')
  })

  it('returns an empty string for empty math', () => {
    expect(latexToSpeech('')).toBe('')
  })
})
