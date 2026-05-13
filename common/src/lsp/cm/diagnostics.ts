import { linter, setDiagnostics, type Diagnostic as CmDiagnostic } from '@codemirror/lint'
import { ViewPlugin, type EditorView } from '@codemirror/view'
import type { Diagnostic } from 'vscode-languageserver-types'

import { type LspClient } from '../LspClient'
import { rangeToOffsets } from './lspUtils'

// Suppress @codemirror/lint's built-in hover tooltip — our lspHover extension
// merges diagnostics into a single richer tooltip, and CM's default popping
// up alongside it gives the double-tooltip the user reported.
const suppressDefaultLintTooltip = linter(null, { tooltipFilter: () => [] })

const SEVERITY: Record<number, CmDiagnostic['severity']> = {
    1: 'error',
    2: 'warning',
    3: 'info',
    4: 'hint',
}

function toCmDiagnostics(view: EditorView, diagnostics: Diagnostic[]): CmDiagnostic[] {
    return diagnostics
        .map((d): CmDiagnostic | null => {
            const { from, to } = rangeToOffsets(view.state.doc, d.range)
            const finalTo = from === to ? Math.min(to + 1, view.state.doc.length) : to
            if (finalTo < from) return null
            return {
                from,
                to: finalTo,
                severity: SEVERITY[d.severity ?? 1] ?? 'error',
                message: d.message,
                source: d.source ?? 'luau',
            }
        })
        .filter((d): d is CmDiagnostic => d !== null)
}

export function lspDiagnostics(client: LspClient, uri: string) {
    const plugin = ViewPlugin.define((view) => {
        const apply = (diags: Diagnostic[]) => {
            view.dispatch(setDiagnostics(view.state, toCmDiagnostics(view, diags)))
        }
        const unsubscribe = client.onDiagnostics((u, diags) => {
            if (u !== uri) return
            apply(diags)
        })
        return {
            destroy() {
                unsubscribe()
            },
        }
    })
    return [suppressDefaultLintTooltip, plugin]
}
