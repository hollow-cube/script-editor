import {
    codeFolding,
    foldable,
    foldedRanges,
    foldEffect,
    foldService,
    unfoldEffect,
} from '@codemirror/language'
import { StateEffect, StateField } from '@codemirror/state'
import { EditorView, gutter, GutterMarker, ViewPlugin } from '@codemirror/view'
import type { FoldingRange } from 'vscode-languageserver-types'

import { type LspClient } from '../LspClient'

const setFoldRanges = StateEffect.define<FoldingRange[]>()

const foldRangesField = StateField.define<FoldingRange[]>({
    create: () => [],
    update(value, tr) {
        for (const e of tr.effects) if (e.is(setFoldRanges)) return e.value
        return value
    },
})

const REFRESH_DELAY = 500
// luau-lsp returns `[]` for `foldingRange` until the document's full parse
// completes — retry on a short backoff until we see a non-empty response.
const RETRY_DELAYS_MS = [300, 800, 2000, 5000]

// === Click-to-fold gutter that watches our state field ===
//
// CodeMirror's built-in `foldGutter()` only rebuilds its markers when one of
// `docChanged`, `viewportChanged`, the `language` facet, the internal fold
// state, or `syntaxTree` changes. Our async-LSP-driven state field updates
// don't trip any of those, so the default gutter never refreshes once new
// fold ranges arrive. Instead we use the low-level `gutter()` API and provide
// `lineMarkerChange` ourselves, returning true on every transaction that
// updates our state field.

function buildFoldMarker(isOpen: boolean): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-foldMarker'
    span.dataset.state = isOpen ? 'open' : 'closed'
    span.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="m6 9 6 6 6-6"/>' +
        '</svg>'
    return span
}

class FoldMarkerWidget extends GutterMarker {
    constructor(
        readonly open: boolean,
        readonly from: number,
        readonly to: number,
    ) {
        super()
    }
    override eq(other: GutterMarker): boolean {
        return (
            other instanceof FoldMarkerWidget &&
            this.open === other.open &&
            this.from === other.from &&
            this.to === other.to
        )
    }
    override toDOM(): HTMLElement {
        return buildFoldMarker(this.open)
    }
}

const foldGutterTheme = EditorView.theme({
    '.cm-foldGutter': {
        width: '22px',
    },
    '.cm-foldGutter .cm-gutterElement': {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0',
        cursor: 'pointer',
        color: 'var(--muted-foreground)',
        transition: 'color 80ms ease',
    },
    '.cm-foldGutter .cm-gutterElement:hover': {
        color: 'var(--foreground)',
    },
    '.cm-foldMarker': {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '16px',
        height: '16px',
        transition: 'transform 80ms ease',
    },
    '.cm-foldMarker[data-state="closed"]': {
        transform: 'rotate(-90deg)',
    },
})

function lspFoldGutterExtension() {
    return [
        // `codeFolding()` installs the internal fold-state field that
        // `foldEffect` / `unfoldEffect` write into and that decorates folded
        // regions with collapse widgets. CM's `foldGutter()` adds this
        // implicitly; since we suppress foldGutter for Luau, we add it here
        // ourselves so click-to-fold actually does something.
        codeFolding(),
        foldGutterTheme,
        gutter({
            class: 'cm-foldGutter',
            lineMarker(view, line) {
                const range = foldable(view.state, line.from, line.to)
                if (!range) return null
                const folded = isFolded(view, range.from, range.to)
                return new FoldMarkerWidget(!folded, range.from, range.to)
            },
            // The state field changes → tell the gutter line markers must be
            // re-evaluated. Also re-run on doc changes (line numbers shift)
            // and viewport scrolls (new lines come into view).
            lineMarkerChange(update) {
                if (update.docChanged || update.viewportChanged) return true
                const before = update.startState.field(foldRangesField, false)
                const after = update.state.field(foldRangesField, false)
                if (before !== after) return true
                // Folded-set changed too (so we flip open/closed markers).
                const beforeFolds = foldedRanges(update.startState)
                const afterFolds = foldedRanges(update.state)
                return beforeFolds !== afterFolds
            },
            domEventHandlers: {
                click(view, line) {
                    const range = foldable(view.state, line.from, line.to)
                    if (!range) return false
                    const folded = isFolded(view, range.from, range.to)
                    view.dispatch({
                        effects: folded
                            ? unfoldEffect.of({ from: range.from, to: range.to })
                            : foldEffect.of({ from: range.from, to: range.to }),
                    })
                    return true
                },
            },
        }),
    ]
}

function isFolded(view: EditorView, from: number, to: number): boolean {
    let folded = false
    foldedRanges(view.state).between(from, to, (f, t) => {
        if (f === from && t === to) {
            folded = true
            return false
        }
        return undefined
    })
    return folded
}

export function lspFolding(client: LspClient, uri: string) {
    const fetchPlugin = ViewPlugin.define((view) => {
        let editTimer: number | null = null
        let retryTimer: number | null = null
        let retryIndex = 0
        let seenNonEmpty = false
        let cancelled = false

        const fetch = async () => {
            try {
                const result = await client.sendRequest<FoldingRange[] | null>(
                    'textDocument/foldingRange',
                    { textDocument: { uri } },
                )
                if (cancelled) return
                const ranges = result ?? []
                if (ranges.length > 0) seenNonEmpty = true
                view.dispatch({ effects: setFoldRanges.of(ranges) })
                if (!seenNonEmpty) scheduleNextRetry()
            } catch {
                if (!seenNonEmpty) scheduleNextRetry()
            }
        }

        const scheduleNextRetry = () => {
            if (cancelled) return
            const delay = RETRY_DELAYS_MS[retryIndex]
            if (delay === undefined) return
            retryIndex++
            retryTimer = window.setTimeout(fetch, delay)
        }

        retryTimer = window.setTimeout(fetch, RETRY_DELAYS_MS[0] ?? 300)
        retryIndex = 1

        const onEdit = () => {
            if (editTimer) window.clearTimeout(editTimer)
            editTimer = window.setTimeout(fetch, REFRESH_DELAY)
        }

        const unsubDiags = client.onDiagnostics((u) => {
            if (u !== uri) return
            if (seenNonEmpty) return
            retryIndex = 0
            if (retryTimer) window.clearTimeout(retryTimer)
            retryTimer = window.setTimeout(fetch, 50)
        })

        return {
            update(update) {
                if (!update.docChanged) return
                onEdit()
            },
            destroy() {
                cancelled = true
                if (editTimer) window.clearTimeout(editTimer)
                if (retryTimer) window.clearTimeout(retryTimer)
                unsubDiags()
            },
        }
    })

    const fold = foldService.of((state, lineStart) => {
        const ranges = state.field(foldRangesField, false) ?? []
        const lineNum = state.doc.lineAt(lineStart).number - 1
        for (const r of ranges) {
            if (r.startLine !== lineNum) continue
            // luau-lsp ignores our `lineFoldingOnly: true` hint and returns
            // character-level ranges (e.g. for string literals). Those have
            // start === end on the same line and aren't foldable by a line
            // gutter; skip them.
            if (r.endLine <= r.startLine) continue
            const startLine = state.doc.line(r.startLine + 1)
            const endLineNum = Math.min(r.endLine + 1, state.doc.lines)
            const endLine = state.doc.line(endLineNum)
            if (endLine.to <= startLine.to) continue
            return { from: startLine.to, to: endLine.to }
        }
        return null
    })

    return [foldRangesField, fetchPlugin, fold, lspFoldGutterExtension()]
}
