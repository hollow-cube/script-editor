import { syntaxTree } from '@codemirror/language'
import type { EditorView } from '@codemirror/view'

// Looks at the syntax tree at `pos`; if the inner node is a string literal,
// returns the unquoted text + the inclusive char range of the string content
// (without the surrounding `"`). Used by the right-click menu, cmd-hover, and
// any other UI that wants "the string under the cursor".
export function stringTokenAt(
    view: EditorView,
    pos: number,
): { token: string; from: number; to: number } | null {
    const tree = syntaxTree(view.state)
    const node = tree.resolveInner(pos, 0)
    if (node.name !== 'String' && node.name !== 'PropertyName') {
        const left = tree.resolveInner(pos, -1)
        if (left.name !== 'String' && left.name !== 'PropertyName') return null
        return extractStringRange(view, left.from, left.to)
    }
    return extractStringRange(view, node.from, node.to)
}

function extractStringRange(view: EditorView, from: number, to: number) {
    const raw = view.state.doc.sliceString(from, to)
    if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
        return { token: raw.slice(1, -1), from: from + 1, to: to - 1 }
    }
    return { token: raw, from, to }
}
