// Shared text helpers: placeholder extraction and the CJK ranges the validators scan for.

// Placeholders found in a string, sorted so source and translation compare order-independently.
export const placeholders = (text) => {
  const out = []
  for (const m of text.matchAll(/\{\{\s*([\w.]+)\s*\}\}|\{([\w.]+)\}/g)) out.push(m[1] || m[2])
  return out.sort()
}

// Placeholders as one comparable string: sorted names joined with "|".
export const placeholderKey = (text) => placeholders(text).join('|')

// Replace every {...} and {{...}} run with a replacement string, keeping the rest of the text.
export const stripPlaceholders = (text, replacement = ' ') =>
  text.replace(/\{\{[^}]*\}\}|\{[^}]*\}/g, replacement)

// The two validators scan deliberately different CJK ranges, and both must stay exactly as they
// were before this module existed: CJK_VI (validate-vi.mjs) starts at U+3000 (CJK symbols and
// punctuation), while CJK_META (validate-meta.mjs) starts lower at U+2E80 (CJK radicals
// supplement), so it also rejects the radical-range characters below U+3000. Do not unify them.
export const CJK_VI = /[\u3000-\u9fff\uf900-\ufaff\uff00-\uffef]/
export const CJK_META = /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/
