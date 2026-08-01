/**
 * AST -> spoken English, in the spirit of ClearSpeak.
 *
 * Two rules drive most of the decisions here:
 *
 * 1. Say the least that is still unambiguous. "x squared" beats "x to the
 *    power of two"; a fraction of two atoms is "a over b" with no bracketing
 *    words, while a nested one gets explicit "the fraction … end fraction"
 *    scaffolding so the listener can hear where it ends.
 * 2. Never drop anything. An unrecognized command reads as its own name rather
 *    than vanishing — a listener who hears "backslash foo" knows something was
 *    there, whereas silence is a lie.
 */

import {
  GREEK,
  GREEK_UNICODE,
  OPERATORS,
  COMMAND_SYMBOLS,
  BLACKBOARD,
  FUNCTIONS,
  BIG_OPERATORS,
  FUNCTION_LETTERS,
  ACCENTS,
  NAMED_SYMBOLS,
  isUnnamedMathSymbol,
  speakNumber,
} from './symbols.js'
import { parseLatex, flattenToString } from './latex-parser.js'

/** \frac{1}{2} is "one half", not "one over two". */
const NAMED_FRACTIONS = {
  '1/2': 'one half',
  '1/3': 'one third',
  '2/3': 'two thirds',
  '1/4': 'one quarter',
  '3/4': 'three quarters',
  '1/8': 'one eighth',
}

/** Ordinals for "to the n-th power" style readings. */
const POWER_WORDS = {
  2: 'squared',
  3: 'cubed',
}

/**
 * Convert a LaTeX math string to spoken English.
 *
 * @param {string} latex Contents of a math span, without delimiters.
 * @returns {string}
 */
export function latexToSpeech(latex) {
  const ast = parseLatex(latex)
  return tidy(renderNode(ast))
}

/** Collapse the whitespace and punctuation artifacts that rendering leaves. */
export function tidy(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,;.])/g, '$1')
    .replace(/([,;])\s*([,;])/g, '$1')
    .replace(/,\s*$/, '')
    .trim()
}

function renderNode(node) {
  if (!node) return ''

  switch (node.type) {
    case 'seq':
      return renderSequence(node.items)
    case 'group':
      return renderNode(node.body)
    case 'number':
      return speakNumber(node.value)
    case 'ident':
      return node.name
    case 'op':
      return OPERATORS[node.value] ?? node.value
    case 'char':
      return renderChar(node.value)
    case 'empty':
      return ''
    case 'colsep':
      return ','
    case 'cell':
      return renderSequence(node.items)
    case 'command':
      return renderCommand(node.name)
    case 'frac':
      return renderFraction(node)
    case 'binom':
      return `${renderNode(node.top)} choose ${renderNode(node.bottom)}`
    case 'sqrt':
      return renderRoot(node)
    case 'sup':
      return renderSuperscript(node)
    case 'sub':
      return renderSubscript(node)
    case 'subsup':
      return `${renderSubscript({ base: node.base, sub: node.sub })} ${renderSuperscriptTail(node.sup)}`
    case 'delim':
      return renderDelimited(node)
    case 'text':
      // \text{...} content is prose already — never spell out its letters.
      return node.raw ?? collectText(node.body)
    case 'styled':
      return renderStyled(node)
    case 'env':
      return renderEnvironment(node)
    case 'unknown':
      return node.value ?? ''
    default:
      return ''
  }
}

/**
 * Render a run of sibling nodes, applying the context-sensitive rules that
 * only make sense between neighbours: function application, implied
 * multiplication, and the rightward scope of big operators.
 */
function renderSequence(items) {
  if (!items?.length) return ''
  const parts = []

  for (let i = 0; i < items.length; i++) {
    const node = items[i]

    // A big operator's scope runs to the end of the enclosing sequence:
    // \int_0^1 f(x) dx  ->  "the integral from 0 to 1 of f of x, d x"
    const bigOp = asBigOperator(node)
    if (bigOp) {
      parts.push(renderBigOperator(bigOp, items.slice(i + 1)))
      break
    }

    const nextNode = items[i + 1]

    // Accents read postfix: \hat{x} is "x hat", which is how a person says it.
    if (node.type === 'command' && ACCENTS[node.name] && nextNode) {
      parts.push(`${renderNode(nextNode)} ${ACCENTS[node.name]}`)
      i++
      continue
    }

    // Function application: a name (or function-ish letter) followed by a
    // parenthesized group reads "of", everything else reads "times".
    // Brackets count too, because expectation is conventionally written
    // E[X] rather than E(X).
    const applied = nextNode?.type === 'delim' && (nextNode.open === '(' || nextNode.open === '[')
    if (applied && isFunctionLike(node)) {
      parts.push(`${renderNode(node)} of ${renderNode(nextNode.body)}`)
      i++
      continue
    }

    // A *named* function applied without parentheses: "sin θ" is "sin of theta".
    // Restricted to the named-function table on purpose — "sin x" has only one
    // reading, whereas "f x" is genuinely ambiguous and stays juxtaposed.
    if (node.type === 'command' && FUNCTIONS.has(node.name) && nextNode && isAtomic(nextNode)) {
      parts.push(`${renderCommand(node.name)} of ${renderNode(nextNode)}`)
      i++
      continue
    }

    parts.push(renderNode(node))
  }

  return parts.filter(Boolean).join(' ')
}

/** Is this node a big operator, with or without limits attached? */
function asBigOperator(node) {
  if (!node) return null

  if (node.type === 'command' && BIG_OPERATORS[node.name]) {
    return { op: BIG_OPERATORS[node.name], from: null, to: null }
  }

  if (['sub', 'sup', 'subsup'].includes(node.type)) {
    const base = node.base
    if (base?.type === 'command' && BIG_OPERATORS[base.name]) {
      return {
        op: BIG_OPERATORS[base.name],
        from: node.sub ?? null,
        to: node.sup ?? null,
      }
    }
  }

  return null
}

function renderBigOperator({ op, from, to }, rest) {
  const pieces = [op.speech]

  if (op.asLimit) {
    // \lim_{x \to 0} reads "the limit as x goes to 0 of …"
    if (from) pieces.push(`as ${renderNode(from)}`)
  } else {
    if (from) pieces.push(`from ${renderNode(from)}`)
    if (to) pieces.push(`to ${renderNode(to)}`)
  }

  const { body, differential } = splitDifferential(rest)
  const bodyText = renderSequence(body)
  if (bodyText) pieces.push(`of ${bodyText}`)

  let text = pieces.join(' ')
  // The differential gets its own comma-separated tail so "…of phi of u, d u"
  // has an audible break before it, the way a person reading aloud would pause.
  if (differential) text += `, ${differential}`
  return text
}

/**
 * Peel a trailing differential ("dx", "du", "d\theta") off an integral body.
 *
 * @returns {{body: Array<object>, differential: string|null}}
 */
function splitDifferential(items) {
  for (let i = items.length - 2; i >= 0; i--) {
    const node = items[i]
    const after = items[i + 1]
    const isD = node?.type === 'ident' && node.name === 'd'
    const isVariable =
      after?.type === 'ident' ||
      (after?.type === 'command' && GREEK[after.name])

    if (isD && isVariable && i + 1 === items.length - 1) {
      return {
        body: items.slice(0, i),
        differential: `d ${renderNode(after)}`,
      }
    }
  }
  return { body: items, differential: null }
}

function isFunctionLike(node) {
  if (node?.type === 'command') {
    return FUNCTIONS.has(node.name) || FUNCTION_LETTERS.has(node.name)
  }
  if (node?.type === 'ident') return FUNCTION_LETTERS.has(node.name)
  // \mathbb{E}[X], \mathbb{P}(A): operators dressed as blackboard-bold letters.
  if (node?.type === 'styled' && node.style === 'mathbb') {
    return ['E', 'P'].includes(flattenToString(node.body))
  }
  // f_1(x), \phi_n(u): the subscript does not change whether the base is a function
  if (['sub', 'sup', 'subsup'].includes(node?.type)) return isFunctionLike(node.base)
  return false
}

function renderFraction(node) {
  const numText = renderNode(node.num)
  const denText = renderNode(node.den)

  const named = NAMED_FRACTIONS[`${flattenToString(node.num)}/${flattenToString(node.den)}`]
  if (named) return named

  // Atomic over atomic is short enough that "a over b" cannot be misheard.
  if (isAtomic(node.num) && isAtomic(node.den)) return `${numText} over ${denText}`

  return `the fraction ${numText} over ${denText}, end fraction`
}

function renderRoot(node) {
  const inner = renderNode(node.radicand)
  if (node.index) {
    const index = flattenToString(node.index)
    if (index === '3') return `the cube root of ${inner}`
    return `the ${ordinal(index)} root of ${inner}`
  }
  if (isAtomic(node.radicand)) return `the square root of ${inner}`
  return `the square root of ${inner}, end root`
}

function renderSuperscript(node) {
  const baseText = renderNode(node.base)
  const tail = renderSuperscriptTail(node.sup)
  return baseText ? `${baseText} ${tail}` : tail
}

/** The spoken form of an exponent, without its base. */
function renderSuperscriptTail(sup) {
  const flat = flattenToString(sup)

  if (POWER_WORDS[flat]) return POWER_WORDS[flat]
  if (flat === '-1') return 'inverse'
  if (flat === 'T') return 'transpose'
  if (flat === '\\prime' || sup?.type === 'command' && sup.name === 'prime') return 'prime'
  if (flat === '*') return 'star'

  const text = renderNode(sup)
  // Negative exponents read "to the power of minus 2", which is clearer aloud
  // than "to the negative second power".
  return `to the power of ${text}`
}

function renderSubscript(node) {
  const baseText = renderNode(node.base)
  const subText = renderNode(node.sub)
  if (!baseText) return `sub ${subText}`
  return `${baseText} sub ${subText}`
}

function renderDelimited(node) {
  const inner = renderNode(node.body)
  if (!inner) return ''

  switch (node.open) {
    case '[':
      return `open bracket ${inner} close bracket`
    case '\\{':
    case '{':
      return `the set ${inner}`
    case '\\langle':
      return `the inner product ${inner}`
    case '|':
      return `the absolute value of ${inner}`
    case '\\|':
      return `the norm of ${inner}`
    default:
      // A single atom in parentheses needs no spoken parens at all —
      // "(x)" is just "x" to a listener.
      if (isAtomic(node.body)) return inner
      return `open paren ${inner} close paren`
  }
}

function renderStyled(node) {
  const flat = flattenToString(node.body)
  if (node.style === 'mathbb' && BLACKBOARD[flat]) return BLACKBOARD[flat]
  if (node.style === 'mathcal' || node.style === 'mathscr') return `script ${renderNode(node.body)}`
  if (node.style === 'mathbf') return `bold ${renderNode(node.body)}`
  if (node.style === 'mathfrak') return `fraktur ${renderNode(node.body)}`
  return renderNode(node.body)
}

function renderEnvironment(node) {
  const isCases = node.name === 'cases'
  const label = {
    pmatrix: 'matrix', bmatrix: 'matrix', vmatrix: 'determinant',
    Vmatrix: 'determinant', matrix: 'matrix', array: 'array',
    cases: 'cases', aligned: '', align: '', gathered: '', gather: '',
  }[node.name]

  const rows = node.rows.map((row, index) => {
    const cells = row.map(renderNode).filter(Boolean).join(', ')
    if (isCases) return cells
    return label ? `row ${index + 1}, ${cells}` : cells
  })

  if (!label) return rows.join('. ')
  if (isCases) return `${rows.join('; ')}`
  return `the ${rows.length} by ${node.rows[0]?.length ?? 1} ${label}, ${rows.join('; ')}, end ${label}`
}

function renderCommand(name) {
  if (GREEK[name]) return GREEK[name]
  if (BIG_OPERATORS[name]) return BIG_OPERATORS[name].speech
  if (FUNCTIONS.has(name)) return name === 'ln' ? 'natural log' : name
  if (name in COMMAND_SYMBOLS) {
    const value = COMMAND_SYMBOLS[name]
    return value === null ? '' : value
  }
  if (name === '\\') return '.'
  if (name === '%') return 'percent'
  if (name === '$') return 'dollar'
  if (ACCENTS[name]) return ACCENTS[name]

  // Unrecognized: read the name so the listener knows something was there.
  // Splitting camelCase keeps "\mathScr" from being read as one nonsense word.
  return name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
}

function renderChar(ch) {
  if (GREEK_UNICODE[ch]) return GREEK_UNICODE[ch]
  if (OPERATORS[ch]) return OPERATORS[ch]
  if (NAMED_SYMBOLS[ch]) return NAMED_SYMBOLS[ch]
  // A symbol from a math block with no name of its own: say that something was
  // there. Kokoro would otherwise render it as silence, which reads to the
  // listener as "nothing was written here" — the one failure mode we refuse.
  if (isUnnamedMathSymbol(ch)) return 'symbol'
  return ch
}

function collectText(node) {
  if (!node) return ''
  switch (node.type) {
    case 'seq':
      return node.items.map(collectText).join('')
    case 'group':
      return collectText(node.body)
    case 'ident':
      return node.name
    case 'number':
      return node.value
    case 'char':
      return node.value
    case 'op':
      return node.value
    case 'command':
      return node.name === ',' || node.name === ';' ? ' ' : ` ${renderCommand(node.name)} `
    default:
      return renderNode(node)
  }
}

/** An atom is a node short enough to need no audible bracketing. */
function isAtomic(node) {
  if (!node) return true
  switch (node.type) {
    case 'number':
    case 'ident':
    case 'char':
    case 'empty':
      return true
    case 'command':
      return true
    case 'group':
      return isAtomic(node.body)
    case 'seq':
      return node.items.length <= 1 && isAtomic(node.items[0])
    case 'styled':
    case 'text':
      return true
    // "x squared over y" needs no bracketing — a decorated atom is still short
    // enough to hear as one unit. Only genuinely branching nodes (fractions,
    // roots, sums) get "end fraction"-style scaffolding.
    case 'sup':
    case 'sub':
    case 'subsup':
      return isAtomic(node.base)
    default:
      return false
  }
}

const ORDINALS = {
  1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth',
  6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth',
}

function ordinal(value) {
  return ORDINALS[value] ?? `${value}th`
}
