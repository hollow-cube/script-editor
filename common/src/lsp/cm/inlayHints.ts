import { RangeSetBuilder } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import {
    Decoration,
    ViewPlugin,
    WidgetType,
    type DecorationSet,
    type ViewUpdate,
} from '@codemirror/view'
import type { InlayHint } from 'vscode-languageserver-types'

import { type LspClient } from '../LspClient'
import { positionToOffset } from './lspUtils'

const REFRESH_DELAY = 400

class InlayHintWidget extends WidgetType {
    text: string
    kindName: 'type' | 'param'
    paddingLeft?: boolean
    paddingRight?: boolean
    constructor(
        text: string,
        kindName: 'type' | 'param',
        paddingLeft?: boolean,
        paddingRight?: boolean,
    ) {
        super()
        this.text = text
        this.kindName = kindName
        this.paddingLeft = paddingLeft
        this.paddingRight = paddingRight
    }
    override eq(other: InlayHintWidget) {
        return (
            this.text === other.text &&
            this.kindName === other.kindName &&
            this.paddingLeft === other.paddingLeft &&
            this.paddingRight === other.paddingRight
        )
    }
    override toDOM() {
        const span = document.createElement('span')
        span.className = `cm-inlay-hint cm-inlay-hint-${this.kindName}`
        if (this.paddingLeft) span.style.marginLeft = '0.25ch'
        if (this.paddingRight) span.style.marginRight = '0.25ch'
        span.textContent = this.text
        return span
    }
    override ignoreEvent() {
        return true
    }
}

export function lspInlayHints(client: LspClient, uri: string) {
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
                const doc = this.view.state.doc
                const lastLine = doc.line(doc.lines)
                const range = {
                    start: { line: 0, character: 0 },
                    end: { line: doc.lines - 1, character: lastLine.length },
                }
                let result: InlayHint[] | null = null
                try {
                    result = await client.sendRequest<InlayHint[] | null>(
                        'textDocument/inlayHint',
                        { textDocument: { uri }, range },
                    )
                } catch {
                    return
                }
                if (this.cancelled) return
                if (!result) {
                    this.decorations = Decoration.none
                    this.view.requestMeasure()
                    return
                }
                const sorted = [...result].toSorted((a, b) =>
                    a.position.line === b.position.line
                        ? a.position.character - b.position.character
                        : a.position.line - b.position.line,
                )
                const builder = new RangeSetBuilder<Decoration>()
                for (const hint of sorted) {
                    const offset = positionToOffset(this.view.state.doc, hint.position)
                    const text =
                        typeof hint.label === 'string'
                            ? hint.label
                            : hint.label.map((l) => l.value).join('')
                    const kindName = hint.kind === 1 ? 'type' : 'param'
                    builder.add(
                        offset,
                        offset,
                        Decoration.widget({
                            widget: new InlayHintWidget(
                                text,
                                kindName,
                                hint.paddingLeft,
                                hint.paddingRight,
                            ),
                            side: 1,
                        }),
                    )
                }
                this.decorations = builder.finish()
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
