import { syntaxTree } from '@codemirror/language'
import type { EditorView } from '@codemirror/view'

// Resolve "the token at `pos`" for languages that have a Lezer parser AND a
// graceful fallback for languages that don't. Returns null when the cursor
// isn't on a meaningful token.
//
// Lezer path: walk the inner syntax node and accept string-literal-like
//             names (covers JSON's String/PropertyName, plus common labels
//             from other Lezer grammars).
// Fallback path: treat the cursor as a word boundary and grab the surrounding
//                identifier-ish run. Used by Shiki-only languages (e.g. Luau).
function isTokenLikeName(name: string): boolean {
    return name === 'String' || name === 'PropertyName' || name === 'Identifier'
}

export function stringTokenAt(
    view: EditorView,
    pos: number,
): { token: string; from: number; to: number } | null {
    const tree = syntaxTree(view.state)
    const node = tree.resolveInner(pos, 0)
    if (isTokenLikeName(node.name)) return extractStringRange(view, node.from, node.to)
    const left = tree.resolveInner(pos, -1)
    if (isTokenLikeName(left.name)) return extractStringRange(view, left.from, left.to)

    // Fallback for languages without a Lezer parser: grab the word-ish run
    // around `pos`. Skip when the cursor is on whitespace.
    return wordAt(view, pos)
}

function extractStringRange(view: EditorView, from: number, to: number) {
    const raw = view.state.doc.sliceString(from, to)
    if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
        return { token: raw.slice(1, -1), from: from + 1, to: to - 1 }
    }
    return { token: raw, from, to }
}

function isWordChar(c: string | undefined): boolean {
    return !!c && /[\w$]/.test(c)
}

function wordAt(view: EditorView, pos: number): { token: string; from: number; to: number } | null {
    const line = view.state.doc.lineAt(pos)
    const text = line.text
    const local = pos - line.from
    let start = local
    let end = local
    while (start > 0 && isWordChar(text[start - 1])) start--
    while (end < text.length && isWordChar(text[end])) end++
    if (start === end) return null
    return {
        token: text.slice(start, end),
        from: line.from + start,
        to: line.from + end,
    }
}
