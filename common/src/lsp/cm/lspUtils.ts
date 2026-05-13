import type { Text } from '@codemirror/state'
import type { Position, Range } from 'vscode-languageserver-types'

// Coordinate conversion between CodeMirror (linear offsets) and LSP
// ({ line, character }). LSP uses UTF-16 code units, which is what JS strings
// also use, so we can index directly.

export function offsetToPosition(doc: Text, offset: number): Position {
    const line = doc.lineAt(offset)
    return { line: line.number - 1, character: offset - line.from }
}

export function positionToOffset(doc: Text, pos: Position): number {
    if (pos.line < 0) return 0
    if (pos.line >= doc.lines) return doc.length
    const line = doc.line(pos.line + 1)
    return Math.min(line.from + Math.max(0, pos.character), line.to)
}

export function rangeToOffsets(doc: Text, range: Range): { from: number; to: number } {
    return {
        from: positionToOffset(doc, range.start),
        to: positionToOffset(doc, range.end),
    }
}
