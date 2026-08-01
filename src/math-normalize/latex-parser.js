/**
 * LaTeX math -> AST.
 *
 * Deliberately a *math-mode* parser, not a LaTeX implementation: no macro
 * definitions, no environments beyond matrices/cases, no error recovery beyond
 * "emit what you understood and keep going". The parser's contract is that it
 * never throws on garbage input — unparseable pieces come back as
 * `{type:'unknown'}` nodes so the speech layer can read them literally rather
 * than dropping them silently.
 */

const SINGLE_CHAR_OPS = new Set(['+', '-', '*', '/', '=', '<', '>', ',', ';', '!', ':', '|'])

/** Commands whose braced argument is prose, not math. */
const VERBATIM_COMMANDS = new Set(['text', 'textrm', 'textit', 'textbf', 'mbox'])

/**
 * Read a balanced `{...}` starting at `from`, skipping leading whitespace.
 *
 * @returns {{content: string, end: number}|null} null if there is no group here.
 */
function readBracedRaw(src, from) {
  let i = from
  while (i < src.length && /\s/.test(src[i])) i++
  if (src[i] !== '{') return null

  let depth = 0
  const start = i + 1
  for (; i < src.length; i++) {
    if (src[i] === '\\') { i++; continue }
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) return { content: src.slice(start, i), end: i + 1 }
    }
  }
  // Unterminated — take the rest rather than losing it.
  return { content: src.slice(start), end: src.length }
}

/**
 * Tokenize LaTeX math.
 *
 * @param {string} src
 * @returns {Array<{type: string, value: string}>}
 */
export function tokenize(src) {
  const tokens = []
  let i = 0

  while (i < src.length) {
    const ch = src[i]

    // whitespace is not significant in math mode
    if (/\s/.test(ch)) {
      i++
      continue
    }

    // control sequence: \alpha, \frac, \\, \{, \,
    if (ch === '\\') {
      const rest = src.slice(i + 1)
      const nameMatch = /^[a-zA-Z]+/.exec(rest)
      if (nameMatch) {
        const name = nameMatch[0]
        tokens.push({ type: 'command', value: name })
        i += 1 + name.length

        // \text{...} holds prose, where spaces carry meaning. Capture the
        // braced argument verbatim instead of letting the math tokenizer
        // discard its whitespace and spell out its letters.
        if (VERBATIM_COMMANDS.has(name)) {
          const braced = readBracedRaw(src, i)
          if (braced) {
            tokens.push({ type: 'rawtext', value: braced.content })
            i = braced.end
          }
        }
        continue
      }
      // escaped single char: \{ \} \, \; \! \\ \%
      const next = src[i + 1] ?? ''
      tokens.push({ type: 'command', value: next })
      i += 2
      continue
    }

    if (ch === '{') { tokens.push({ type: 'lbrace', value: '{' }); i++; continue }
    if (ch === '}') { tokens.push({ type: 'rbrace', value: '}' }); i++; continue }
    if (ch === '^') { tokens.push({ type: 'sup', value: '^' }); i++; continue }
    if (ch === '_') { tokens.push({ type: 'sub', value: '_' }); i++; continue }
    if (ch === '&') { tokens.push({ type: 'amp', value: '&' }); i++; continue }

    // numbers, including decimals — kept as one token so "3.14" is not read
    // as "three point one four" via three separate nodes
    const num = /^\d+(?:\.\d+)?/.exec(src.slice(i))
    if (num) {
      tokens.push({ type: 'number', value: num[0] })
      i += num[0].length
      continue
    }

    if (/[a-zA-Z]/.test(ch)) {
      tokens.push({ type: 'letter', value: ch })
      i++
      continue
    }

    if (SINGLE_CHAR_OPS.has(ch)) {
      tokens.push({ type: 'op', value: ch })
      i++
      continue
    }

    if (ch === '(' || ch === '[') { tokens.push({ type: 'open', value: ch }); i++; continue }
    if (ch === ')' || ch === ']') { tokens.push({ type: 'close', value: ch }); i++; continue }

    // Anything else (stray Unicode math, punctuation) becomes a char token and
    // is resolved later against the Unicode tables — never dropped.
    tokens.push({ type: 'char', value: ch })
    i++
  }

  return tokens
}

/**
 * Parse a token stream into an AST.
 *
 * @param {string} src LaTeX math source
 * @returns {{type: 'seq', items: Array<object>}}
 */
export function parseLatex(src) {
  const tokens = tokenize(src)
  let pos = 0

  const peek = (offset = 0) => tokens[pos + offset]
  const next = () => tokens[pos++]
  const atEnd = () => pos >= tokens.length

  /** Is there another '|' token ahead, so the current one can close? */
  function hasLaterBar() {
    for (let i = pos; i < tokens.length; i++) {
      if (tokens[i].type === 'op' && tokens[i].value === '|') return true
    }
    return false
  }

  /**
   * Parse a sequence until a terminator token type is hit (not consumed).
   *
   * @param {Set<string>} stopTypes
   * @param {Set<string>} stopCommands
   * @param {boolean} [stopAtBar] Stop at a '|' op token — used for |x|, where
   *   the closing bar is an operator token rather than a distinct close type.
   */
  function parseSequence(stopTypes = new Set(), stopCommands = new Set(), stopAtBar = false) {
    const items = []
    while (!atEnd()) {
      const token = peek()
      if (stopTypes.has(token.type)) break
      if (token.type === 'command' && stopCommands.has(token.value)) break
      if (stopAtBar && token.type === 'op' && token.value === '|') break
      const node = parseAtomWithScripts()
      if (node) items.push(node)
    }
    return items.length === 1 ? items[0] : { type: 'seq', items }
  }

  /**
   * Parse one atom, then attach any sub/superscripts.
   *
   * Both orders (x_i^2 and x^2_i) mean the same thing, and either may repeat,
   * so this loops rather than checking once.
   */
  function parseAtomWithScripts() {
    let base = parseAtom()
    if (!base) return null

    let sub = null
    let sup = null
    while (!atEnd() && (peek().type === 'sub' || peek().type === 'sup')) {
      const kind = next().type
      const script = parseAtom()
      if (kind === 'sub') sub = script
      else sup = script
    }

    if (sub && sup) return { type: 'subsup', base, sub, sup }
    if (sub) return { type: 'sub', base, sub }
    if (sup) return { type: 'sup', base, sup }
    return base
  }

  /** Parse a single atom: a group, a command, a number, a letter, an operator. */
  function parseAtom() {
    if (atEnd()) return null
    const token = next()

    switch (token.type) {
      case 'lbrace': {
        const body = parseSequence(new Set(['rbrace']))
        if (!atEnd() && peek().type === 'rbrace') next()
        return { type: 'group', body }
      }

      case 'number':
        return { type: 'number', value: token.value }

      case 'letter':
        return { type: 'ident', name: token.value }

      case 'op': {
        // A bar pairs with a later bar to form absolute value. If there is no
        // partner, it stays an operator — "P(A|B)" is "given", not a stray
        // delimiter, and guessing wrong there is worse than not guessing.
        if (token.value === '|' && hasLaterBar()) {
          const body = parseSequence(new Set(['rbrace']), new Set(), true)
          if (!atEnd() && peek().type === 'op' && peek().value === '|') next()
          return { type: 'delim', open: '|', close: '|', body }
        }
        return { type: 'op', value: token.value }
      }

      case 'rawtext':
        return { type: 'text', raw: token.value }

      case 'char':
        return { type: 'char', value: token.value }

      case 'open': {
        // Read to the matching close so the speech layer can decide whether
        // this is a function argument (say "of x") or a real grouping.
        const body = parseSequence(new Set(['close', 'rbrace']))
        let closer = ')'
        if (!atEnd() && peek().type === 'close') closer = next().value
        return { type: 'delim', open: token.value, close: closer, body }
      }

      case 'close':
        // Unbalanced closer — keep it rather than throwing.
        return { type: 'char', value: token.value }

      case 'sub':
      case 'sup':
        // Script with no base, e.g. "^2" at the start. Treat the script as an
        // atom attached to nothing; the renderer says "to the power of two".
        return { type: token.type, base: { type: 'empty' }, [token.type === 'sub' ? 'sub' : 'sup']: parseAtom() }

      case 'amp':
        return { type: 'colsep' }

      case 'command':
        return parseCommand(token.value)

      case 'rbrace':
        return null

      default:
        return { type: 'unknown', value: token.value }
    }
  }

  /** Grab the next atom as a required argument (for \frac, \sqrt, …). */
  function requireArg() {
    const arg = parseAtom()
    return arg ?? { type: 'empty' }
  }

  function parseCommand(name) {
    switch (name) {
      case 'frac':
      case 'dfrac':
      case 'tfrac':
      case 'cfrac': {
        const num = requireArg()
        const den = requireArg()
        return { type: 'frac', num, den }
      }

      case 'binom':
      case 'dbinom': {
        const top = requireArg()
        const bottom = requireArg()
        return { type: 'binom', top, bottom }
      }

      case 'sqrt': {
        // optional index: \sqrt[3]{x}
        let index = null
        if (!atEnd() && peek().type === 'open' && peek().value === '[') {
          next()
          index = parseSequence(new Set(['close']))
          if (!atEnd() && peek().type === 'close') next()
        }
        const radicand = requireArg()
        return { type: 'sqrt', index, radicand }
      }

      case 'text':
      case 'textrm':
      case 'textit':
      case 'textbf':
      case 'mbox': {
        // The tokenizer already captured the prose as a rawtext token.
        if (!atEnd() && peek().type === 'rawtext') return { type: 'text', raw: next().value }
        return { type: 'text', body: requireArg() }
      }

      case 'mathrm':
      case 'operatorname': {
        const body = requireArg()
        return { type: 'text', body }
      }

      case 'mathbb':
      case 'mathbf':
      case 'mathcal':
      case 'mathfrak':
      case 'mathscr': {
        const body = requireArg()
        return { type: 'styled', style: name, body }
      }

      case 'left': {
        const delim = readDelimiter()
        const body = parseSequence(new Set(), new Set(['right']))
        let close = ''
        if (!atEnd() && peek().type === 'command' && peek().value === 'right') {
          next()
          close = readDelimiter()
        }
        return { type: 'delim', open: delim, close, body, sized: true }
      }

      case 'right': {
        readDelimiter()
        return null
      }

      case 'begin':
        return parseEnvironment()

      case 'end': {
        requireArg()
        return null
      }

      default:
        return { type: 'command', name }
    }
  }

  /** After \left or \right, the delimiter may be a char or a command. */
  function readDelimiter() {
    if (atEnd()) return ''
    const token = next()
    if (token.type === 'command') return `\\${token.value}`
    return token.value
  }

  function parseEnvironment() {
    const nameNode = requireArg()
    const envName = flattenToString(nameNode)

    // Column alignment spec for array/tabular — consumed and discarded, since
    // alignment carries no meaning aloud.
    if (envName === 'array' || envName === 'tabular') requireArg()

    const rows = [[]]
    while (!atEnd()) {
      const token = peek()

      if (token.type === 'command' && token.value === 'end') {
        next()
        requireArg()
        break
      }
      if (token.type === 'command' && (token.value === '\\' || token.value === 'cr')) {
        next()
        rows.push([])
        continue
      }
      if (token.type === 'amp') {
        next()
        rows[rows.length - 1].push({ type: 'empty' })
        continue
      }

      const node = parseAtomWithScripts()
      if (node) {
        const row = rows[rows.length - 1]
        // Cells accumulate; a cell is everything between & separators.
        if (row.length === 0) row.push(node)
        else {
          const last = row[row.length - 1]
          if (last.type === 'cell') last.items.push(node)
          else row[row.length - 1] = { type: 'cell', items: [last, node] }
        }
      }
    }

    return { type: 'env', name: envName, rows: rows.filter((r) => r.length > 0) }
  }

  const body = parseSequence()
  return body.type === 'seq' ? body : { type: 'seq', items: [body] }
}

/** Best-effort plain-text flattening, used for environment names. */
export function flattenToString(node) {
  if (!node) return ''
  switch (node.type) {
    case 'ident':
    case 'char':
    case 'op':
      return node.name ?? node.value
    case 'number':
      return node.value
    case 'command':
      return node.name
    case 'group':
      return flattenToString(node.body)
    case 'text':
      return node.raw ?? flattenToString(node.body)
    case 'seq':
      return node.items.map(flattenToString).join('')
    default:
      return ''
  }
}
