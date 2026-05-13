import { RangeSetBuilder } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { Decoration, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import type { SemanticTokens } from 'vscode-languageserver-types'

import { type LspClient } from '../LspClient'

// Layer LSP semantic tokens above Shiki's syntax highlighting. The server
// returns relative-encoded (deltaLine, deltaStart, length, type, modifiers)
// tuples; we decode and apply Decoration marks keyed on `cm-tok-{type}`
// classes.

const REFRESH_DELAY = 400

function decode(view: EditorView, legend: { tokenTypes: string[] }, data: number[]): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>()
    const doc = view.state.doc
    let line = 0
    let char = 0
    for (let i = 0; i + 4 < data.length; i += 5) {
        const dLine = data[i] ?? 0
        const dStart = data[i + 1] ?? 0
        const length = data[i + 2] ?? 0
        const tokenType = data[i + 3] ?? 0
        if (dLine !== 0) {
            line += dLine
            char = dStart
        } else {
            char += dStart
        }
        if (line >= doc.lines) continue
        const typeName = legend.tokenTypes[tokenType] ?? 'unknown'
        const lineStart = doc.line(line + 1).from
        const lineLen = doc.line(line + 1).length
        const colStart = Math.min(char, lineLen)
        const colEnd = Math.min(char + length, lineLen)
        if (colEnd <= colStart) continue
        builder.add(
            lineStart + colStart,
            lineStart + colEnd,
            Decoration.mark({ class: `cm-tok cm-tok-${typeName}` }),
        )
    }
    return builder.finish()
}

export function lspSemanticTokens(client: LspClient, uri: string) {
    const legend = client.getCapabilities()?.semanticTokensProvider?.legend
    if (!legend) return []

    return ViewPlugin.fromClass(
        class {
            view: EditorView
            decorations: DecorationSet = Decoration.none
            timer: number | null = null
            cancelled = false

            constructor(view: EditorView) {
                this.view = view
                window.setTimeout(() => this.fetch(), 200)
            }

            update(update: ViewUpdate) {
                if (!update.docChanged) return
                if (this.timer) window.clearTimeout(this.timer)
                this.timer = window.setTimeout(() => this.fetch(), REFRESH_DELAY)
            }

            async fetch() {
                if (this.cancelled) return
                let result: SemanticTokens | null = null
                try {
                    result = await client.sendRequest<SemanticTokens | null>(
                        'textDocument/semanticTokens/full',
                        { textDocument: { uri } },
                    )
                } catch {
                    return
                }
                if (this.cancelled) return
                if (!result) return
                this.decorations = decode(this.view, legend, result.data)
                this.view.requestMeasure()
            }

            destroy() {
                this.cancelled = true
                if (this.timer) window.clearTimeout(this.timer)
            }
        },
        { decorations: (v) => v.decorations },
    )
}
