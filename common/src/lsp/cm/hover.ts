import { hoverTooltip } from '@codemirror/view'
import type { Diagnostic as LspDiagnostic, Hover } from 'vscode-languageserver-types'

import { type LspClient } from '../LspClient'
import { markdownFromContents } from '../protocol'
import { offsetToPosition, rangeToOffsets } from './lspUtils'

// LSP hover tooltip. Renders any diagnostics that overlap the cursor above
// the type info with a separator between, then the LSP hover markdown.
// Styling lives in editor/extensions/theme.ts so it tracks the app's popover
// tokens (background, border, shadow, radius).

type Severity = 'error' | 'warning' | 'info' | 'hint'

const SEVERITY_BY_NUMBER: Record<number, Severity> = {
    1: 'error',
    2: 'warning',
    3: 'info',
    4: 'hint',
}

function severityLabel(s: Severity): string {
    switch (s) {
        case 'error':
            return 'Error'
        case 'warning':
            return 'Warning'
        case 'info':
            return 'Info'
        case 'hint':
            return 'Hint'
    }
}

function relevantDiagnostics(
    diagnostics: readonly LspDiagnostic[],
    line: number,
    character: number,
): LspDiagnostic[] {
    return diagnostics.filter((d) => {
        const startBefore =
            d.range.start.line < line ||
            (d.range.start.line === line && d.range.start.character <= character)
        const endAfter =
            d.range.end.line > line ||
            (d.range.end.line === line && d.range.end.character >= character)
        return startBefore && endAfter
    })
}

function renderDiagnosticBlock(d: LspDiagnostic): HTMLElement {
    const severity = SEVERITY_BY_NUMBER[d.severity ?? 1] ?? 'error'
    const row = document.createElement('div')
    row.className = `cm-hc-hover-diagnostic cm-hc-hover-diagnostic-${severity}`

    const tag = document.createElement('span')
    tag.className = `cm-hc-hover-diagnostic-tag cm-hc-hover-diagnostic-tag-${severity}`
    tag.textContent = severityLabel(severity)
    row.append(tag)

    const msg = document.createElement('span')
    msg.className = 'cm-hc-hover-diagnostic-msg'
    msg.textContent = d.message
    row.append(msg)

    return row
}

function renderMarkdownBlock(block: string): HTMLElement {
    if (block.startsWith('```')) {
        const code = document.createElement('pre')
        code.className = 'cm-hc-hover-code'
        const body = block.split('\n').slice(1, -1).join('\n')
        code.textContent = body
        return code
    }
    const p = document.createElement('div')
    p.className = 'cm-hc-hover-text'
    p.textContent = block
    return p
}

function buildHoverDom(diagnostics: LspDiagnostic[], markdownBlocks: string[]): HTMLElement {
    const dom = document.createElement('div')
    dom.className = 'cm-hc-hover'

    if (diagnostics.length > 0) {
        const diagSection = document.createElement('div')
        diagSection.className = 'cm-hc-hover-section cm-hc-hover-diagnostics'
        for (const d of diagnostics) diagSection.append(renderDiagnosticBlock(d))
        dom.append(diagSection)

        if (markdownBlocks.length > 0) {
            const divider = document.createElement('div')
            divider.className = 'cm-hc-hover-divider'
            dom.append(divider)
        }
    }

    if (markdownBlocks.length > 0) {
        const mdSection = document.createElement('div')
        mdSection.className = 'cm-hc-hover-section cm-hc-hover-markdown'
        for (const block of markdownBlocks) mdSection.append(renderMarkdownBlock(block))
        dom.append(mdSection)
    }

    return dom
}

export function lspHover(client: LspClient, uri: string) {
    return hoverTooltip(async (view, pos) => {
        const lineInfo = view.state.doc.lineAt(pos)
        const lineText = lineInfo.text
        let start = pos
        let end = pos
        while (start > lineInfo.from && /[\w.:]/.test(lineText[start - lineInfo.from - 1] ?? ''))
            start--
        while (end < lineInfo.to && /[\w.:]/.test(lineText[end - lineInfo.from] ?? '')) end++

        const lspPos = offsetToPosition(view.state.doc, pos)
        const diagnostics = relevantDiagnostics(
            client.getDiagnostics(uri),
            lspPos.line,
            lspPos.character,
        )

        let result: Hover | null = null
        if (start !== end) {
            try {
                result = await client.sendRequest<Hover | null>('textDocument/hover', {
                    textDocument: { uri },
                    position: lspPos,
                })
            } catch {
                result = null
            }
        }

        const md = result?.contents ? markdownFromContents(result.contents) : []
        if (diagnostics.length === 0 && md.length === 0) return null

        const range = result?.range
            ? rangeToOffsets(view.state.doc, result.range)
            : { from: start === end ? pos : start, to: start === end ? pos + 1 : end }

        return {
            pos: range.from,
            end: range.to,
            above: false,
            strictSide: true,
            create() {
                return { dom: buildHoverDom(diagnostics, md) }
            },
        }
    })
}
