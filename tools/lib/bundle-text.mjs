// Shared reader for the language maps that sit inside the installed build's JavaScript bundles.
//
// The extraction scripts scan DSH bundles for literals the Web GUI resolves through
// `ctx.locale.resolveText`: package display text and Host copy such as approval prompts. Reading
// those literals needs a tokenizer that survives minified source — comments, strings, template
// literals, regexes and balanced brackets — which is why it lives in one shared module instead of
// being copied into each script.
//
// Plain `node:` builtins only; nothing runs at import time.

/** A language map carries a handful of languages, never a whole dictionary. */
export const MAX_LANGUAGES = 5

const PUNCT = new Set([
  '{',
  '}',
  '[',
  ']',
  '(',
  ')',
  ':',
  ',',
  ';',
  '?',
  '.',
  '=',
  '<',
  '>',
  '+',
  '-',
  '*',
  '/',
  '%',
  '!',
  '&',
  '|',
  '^',
  '~',
])

/**
 * Split bundle source into the tokens the object reader needs.
 *
 * Strings and template literals carry their decoded text (interpolated identifiers become
 * `{name}` placeholders), comments are dropped, and regex literals become one opaque token so
 * their braces can never open an object.
 *
 * @param text - bundle source
 * @returns token list; strings have `value`, templates have `value` and `params`
 */
export function tokenize(text) {
  const tokens = []
  let i = 0
  while (i < text.length) {
    const code = text.charCodeAt(i)
    // whitespace: space, tab, LF, CR
    if (code === 32 || code === 9 || code === 10 || code === 13) {
      i++
      continue
    }
    if (code === 47 && text.charCodeAt(i + 1) === 47) {
      const nl = text.indexOf('\n', i)
      i = nl < 0 ? text.length : nl
      continue
    }
    if (code === 47 && text.charCodeAt(i + 1) === 42) {
      const end = text.indexOf('*/', i + 2)
      i = end < 0 ? text.length : end + 2
      continue
    }
    if (code === 34 || code === 39) {
      const read = readQuoted(text, i)
      tokens.push({ type: 'string', value: read.value })
      i = read.end
      continue
    }
    if (code === 96) {
      const read = readTemplate(text, i)
      tokens.push({ type: 'template', value: read.value, params: read.params })
      i = read.end
      continue
    }
    if (code === 47 && regexAllowed(tokens[tokens.length - 1])) {
      i = skipRegex(text, i)
      tokens.push({ type: 'regex' })
      continue
    }
    // identifier start: A-Z a-z $ _
    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 36 || code === 95) {
      let end = i
      while (end < text.length) {
        const c = text.charCodeAt(end)
        if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 36 || c === 95) end++
        else break
      }
      tokens.push({ type: 'ident', value: text.slice(i, end) })
      i = end
      continue
    }
    if (code >= 48 && code <= 57) {
      let end = i
      while (end < text.length) {
        const c = text.charCodeAt(end)
        if ((c >= 48 && c <= 57) || c === 46 || (c >= 65 && c <= 90) || (c >= 97 && c <= 122)) end++
        else break
      }
      tokens.push({ type: 'number', value: text.slice(i, end) })
      i = end
      continue
    }
    const c = text[i]
    if (PUNCT.has(c)) {
      tokens.push({ type: 'punct', value: c })
      i++
      continue
    }
    tokens.push({ type: 'other' })
    i++
  }
  return tokens
}

/** A regex literal is only possible where an expression may start. */
function regexAllowed(previous) {
  if (!previous) return true
  if (previous.type === 'punct') {
    return ['(', ',', ':', '=', '[', '?', '!'].includes(previous.value)
  }
  if (previous.type === 'ident') return /^(return|typeof|instanceof|in|of|new|delete|void|case)$/.test(previous.value)
  return false
}

/** Skip one regex literal starting at `start`; returns the index after its flags. */
function skipRegex(text, start) {
  let i = start + 1
  let inClass = false
  while (i < text.length) {
    const c = text[i]
    if (c === '\\') {
      i += 2
      continue
    }
    if (c === '[') inClass = true
    else if (c === ']') inClass = false
    else if (c === '/' && !inClass) {
      i++
      while (i < text.length && /[a-z]/i.test(text[i])) i++
      return i
    } else if (c === '\n') {
      return start + 1
    }
    i++
  }
  return text.length
}

/** Read one quoted string; returns its decoded value and the index after the closing quote. */
function readQuoted(text, start) {
  const quote = text[start]
  let i = start + 1
  let value = ''
  while (i < text.length) {
    const c = text[i]
    if (c === '\\') {
      value += decodeEscape(text[i + 1])
      i += 2
      continue
    }
    if (c === quote) return { value, end: i + 1 }
    value += c
    i++
  }
  return { value, end: text.length }
}

/** Decode the escape sequence that follows a backslash. */
function decodeEscape(c) {
  if (c === 'n') return '\n'
  if (c === 't') return '\t'
  if (c === 'r') return '\r'
  return c ?? ''
}

/** Read one template literal; interpolated identifiers become `{name}` placeholders. */
function readTemplate(text, start) {
  let i = start + 1
  let value = ''
  const params = []
  while (i < text.length) {
    const c = text[i]
    if (c === '\\') {
      value += decodeEscape(text[i + 1])
      i += 2
      continue
    }
    if (c === '`') return { value, params, end: i + 1 }
    if (c === '$' && text[i + 1] === '{') {
      let depth = 1
      let j = i + 2
      let expression = ''
      while (j < text.length && depth > 0) {
        const d = text[j]
        if (d === '{') depth++
        else if (d === '}') depth--
        else if (d === '"' || d === "'") {
          const read = readQuoted(text, j)
          expression += read.value
          j = read.end
          continue
        } else if (d === '`') {
          const read = readTemplate(text, j)
          expression += read.value
          j = read.end
          continue
        }
        if (depth > 0) expression += d
        j++
      }
      const name = expression.trim()
      if (/^[A-Za-z_$][\w$]*$/.test(name)) {
        params.push(name)
        value += `{${name}}`
      } else {
        // A computed interpolation cannot be a stable placeholder: keep it visible as `${…}` so the
        // entry is reported as untranslatable instead of shipped with a wrong translation.
        value += `\${${name}}`
      }
      i = j
      continue
    }
    value += c
    i++
  }
  return { value, params, end: text.length }
}

/**
 * Match every opening brace/bracket/paren token to its closing token in one pass, so a stray
 * unbalanced brace cannot make the reader run to the end of the file.
 *
 * @returns {Map<number, number>} opening token index → closing token index
 */
export function matchBrackets(tokens) {
  const stack = []
  const matches = new Map()
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.type !== 'punct') continue
    if (token.value === '{' || token.value === '[' || token.value === '(') stack.push(i)
    else if (token.value === '}' || token.value === ']' || token.value === ')') {
      const open = stack.pop()
      if (open !== undefined) matches.set(open, i)
    }
  }
  return matches
}

/** Skip one balanced value in a single step. */
function jump(tokens, i, matches) {
  const close = matches.get(i)
  return { end: close === undefined ? i + 1 : close + 1, kind: 'other' }
}

/**
 * Read one literal value starting at token `i`.
 *
 * @param tokens - tokenized bundle
 * @param i - index of the value's first token
 * @param matches - bracket matcher
 * @param limit - exclusive index the value must stay before
 * @param deep - parse nested object/array values instead of skipping them with one bracket jump
 * @returns {{ end: number, kind: 'string'|'template'|'object'|'array'|'other', value?: any, params?: string[] }}
 */
function readValue(tokens, i, matches, limit, deep) {
  const token = tokens[i]
  if (!token || i >= limit) return { end: i, kind: 'other' }
  if (token.type === 'string') return { end: i + 1, kind: 'string', value: token.value }
  if (token.type === 'template') return { end: i + 1, kind: 'template', value: token.value, params: token.params }
  if (token.type === 'punct' && token.value === '{') return deep ? readObject(tokens, i, matches, limit, { deep: true }) : jump(tokens, i, matches)
  if (token.type === 'punct' && token.value === '[') return deep ? readArray(tokens, i, matches, limit, { deep: true }) : jump(tokens, i, matches)
  if (token.type === 'punct') return jump(tokens, i, matches)
  // Any other expression runs to the next separator at this level; nested brackets are skipped in
  // one step through the bracket matcher, so a long function body costs a single jump.
  let j = i
  while (j < limit) {
    const t = tokens[j]
    if (t.type === 'punct' && (t.value === '{' || t.value === '[' || t.value === '(')) {
      const close = matches.get(j)
      j = close === undefined ? j + 1 : close + 1
      continue
    }
    if (t.type === 'punct' && (t.value === '}' || t.value === ']' || t.value === ')' || t.value === ',' || t.value === ';')) {
      break
    }
    j++
  }
  return { end: j, kind: 'other' }
}

/**
 * Read one object literal starting at token `i` (which must be `{`).
 *
 * Handles quoted and plain keys, spreads, shorthand properties and computed keys. Parsing stops as
 * soon as the object holds more than `maxEntries` keys: a language map is small, so a large object
 * is not a candidate and never needs a full walk.
 *
 * @returns {{ end: number, kind: 'object', entries: [string, any][] }}
 */
function readObject(tokens, i, matches, limit, { maxEntries = MAX_LANGUAGES, deep = false } = {}) {
  const entries = []
  let j = i + 1
  while (j < limit) {
    const token = tokens[j]
    if (token.type === 'punct' && token.value === '}') return { end: j + 1, kind: 'object', entries }
    if (token.type === 'punct' && token.value === ',') {
      j++
      continue
    }
    if (token.type === 'punct' && token.value === '.') {
      // spread: `...expr`
      j = readValue(tokens, j + 1, matches, limit, deep).end
      continue
    }
    let key
    if (token.type === 'string' || token.type === 'ident' || token.type === 'number') {
      key = token.value
      j++
    } else if (token.type === 'punct' && token.value === '[') {
      // computed key: skipped, its value is skipped too
      j = readValue(tokens, j, matches, limit, deep).end
      continue
    } else {
      // Not a key: step over the token instead of scanning for a value.
      j++
      continue
    }
    const next = tokens[j]
    if (next?.type === 'punct' && next.value === ':') {
      const value = readValue(tokens, j + 1, matches, limit, deep)
      if (key !== undefined) entries.push([key, value])
      if (entries.length > maxEntries) return { end: value.end, kind: 'object', entries }
      j = value.end
      continue
    }
    // shorthand property
    j = readValue(tokens, j, matches, limit, deep).end
  }
  return { end: j, kind: 'object', entries }
}

/** Read one array literal starting at token `i` (which must be `[`). */
function readArray(tokens, i, matches, limit, { deep = true } = {}) {
  const items = []
  let j = i + 1
  while (j < limit) {
    const token = tokens[j]
    if (token.type === 'punct' && token.value === ']') return { end: j + 1, kind: 'array', items }
    if (token.type === 'punct' && token.value === ',') {
      j++
      continue
    }
    const value = readValue(tokens, j, matches, limit, deep)
    items.push(value)
    j = value.end
  }
  return { end: j, kind: 'array', items }
}

/**
 * Read the value bound to `const NAME = …` in a bundle.
 *
 * @returns the value, or undefined when the binding is absent or unparseable
 */
export function readBinding(text, name) {
  const tokens = tokenize(text)
  const matches = matchBrackets(tokens)
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.type !== 'ident' || token.value !== name) continue
    const next = tokens[i + 1]
    if (next?.type !== 'punct' || next.value !== '=') continue
    return readValue(tokens, i + 2, matches, tokens.length, true)
  }
  return undefined
}

/**
 * Every language map a bundle defines as a property value: an object literal of at most
 * `MAX_LANGUAGES` string/template values that includes `en`.
 *
 * One forward pass keeps the enclosing object open, so a map that sits behind a ternary
 * (`displayReason: condition ? { en, zh } : { en, zh }`) still reports the property that holds it.
 *
 * @param text - bundle source
 * @returns maps with the enclosing property name, the `en` value and the entry count
 */
export function languageMaps(text) {
  const tokens = tokenize(text)
  const matches = matchBrackets(tokens)
  const maps = []
  // Innermost open object first: the property name the open object's values are assigned to.
  const stack = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.type === 'punct' && token.value === '}') {
      stack.pop()
      continue
    }
    if ((token.type === 'ident' || token.type === 'string') && tokens[i + 1]?.type === 'punct' && tokens[i + 1].value === ':') {
      if (stack.length > 0) stack[stack.length - 1].property = token.value
      continue
    }
    if (token.type !== 'punct' || token.value !== '{') continue
    const close = matches.get(i)
    if (close === undefined) continue
    const property = stack.length > 0 ? stack[stack.length - 1].property : undefined
    const object = readObject(tokens, i, matches, close + 1, { deep: false })
    const values = object.entries.map(([, value]) => value)
    if (
      object.entries.length > 0 &&
      object.entries.length <= MAX_LANGUAGES &&
      values.every((value) => value.kind === 'string' || value.kind === 'template')
    ) {
      const enIndex = object.entries.findIndex(([key]) => key === 'en')
      if (enIndex >= 0) maps.push({ property, english: values[enIndex], languages: values.length })
    }
    stack.push({ property: undefined })
  }
  return maps
}
