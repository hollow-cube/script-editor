import { RangeSetBuilder } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { Decoration, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import type { Highlighter } from 'shiki'

// CodeMirror view plugin that colors tokens using Shiki's TextMate tokenizer.
// We don't have a Lezer parser for Luau; Shiki gives us the same tokenization
// the prior-art project validated. Tokenization is whole-document on each
// doc change — fine for files at this scale.

type Loader = () => Promise<Highlighter>

const colorClassCache = new Map<string, string>()
let injectedStylesheet: HTMLStyleElement | null = null

function classForColor(color: string): string {
    let cls = colorClassCache.get(color)
    if (cls) return cls
    cls = 'cm-shiki-' + colorClassCache.size.toString(36)
    colorClassCache.set(color, cls)
    if (typeof document !== 'undefined') {
        if (!injectedStylesheet) {
            injectedStylesheet = document.createElement('style')
            injectedStylesheet.dataset.source = 'shiki-cm'
            document.head.append(injectedStylesheet)
        }
        injectedStylesheet.textContent =
            (injectedStylesheet.textContent ?? '') + `.${cls}{color:${color}}`
    }
    return cls
}

function buildDecorations(
    view: EditorView,
    highlighter: Highlighter,
    lang: string,
    theme: string,
): DecorationSet {
    const doc = view.state.doc
    const code = doc.toString()
    let lines: ReturnType<Highlighter['codeToTokensBase']>
    try {
        // Shiki's types want union literals; we register at runtime so the
        // strings are valid even though TS can't see it.
        lines = highlighter.codeToTokensBase(code, {
            lang: lang as Parameters<Highlighter['codeToTokensBase']>[1] extends infer P
                ? P extends { lang: infer L }
                    ? L
                    : never
                : never,
            theme: theme as Parameters<Highlighter['codeToTokensBase']>[1] extends infer P
                ? P extends { theme: infer T }
                    ? T
                    : never
                : never,
        })
    } catch {
        return Decoration.none
    }

    const builder = new RangeSetBuilder<Decoration>()
    const docLen = doc.length

    for (const line of lines) {
        for (const token of line) {
            if (!token.color) continue
            const from = token.offset
            const to = from + token.content.length
            if (to <= from || from >= docLen) continue
            builder.add(
                from,
                Math.min(to, docLen),
                Decoration.mark({ class: classForColor(token.color) }),
            )
        }
    }
    return builder.finish()
}

export function shikiHighlight(lang: string, theme: string, loader: Loader) {
    return ViewPlugin.fromClass(
        class {
            view: EditorView
            decorations: DecorationSet = Decoration.none
            highlighter: Highlighter | null = null
            disposed = false

            constructor(view: EditorView) {
                this.view = view
                void loader().then((h) => {
                    if (this.disposed) return undefined
                    this.highlighter = h
                    this.decorations = buildDecorations(view, h, lang, theme)
                    view.dispatch({})
                    return undefined
                })
            }

            update(update: ViewUpdate) {
                if (!this.highlighter) return
                if (update.docChanged || update.viewportChanged) {
                    this.decorations = buildDecorations(update.view, this.highlighter, lang, theme)
                }
            }

            destroy() {
                this.disposed = true
            }
        },
        { decorations: (v) => v.decorations },
    )
}
