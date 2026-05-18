import { hoverTooltip, tooltips, type EditorView } from '@codemirror/view'
import type { Diagnostic as LspDiagnostic, Hover } from 'vscode-languageserver-types'

import {
    findDocNode,
    findMember,
    memberDescription,
    memberSignature,
    type EngineApiDoc,
} from '../../engine-api'
import { type LspClient } from '../LspClient'
import { markdownFromContents } from '../protocol'
import { probeDefinition, type DefinitionResolver } from './definition'
import { offsetToPosition, rangeToOffsets } from './lspUtils'

// LSP hover tooltip. Renders any diagnostics that overlap the cursor above
// the type info with a separator between, then the hover body.
//
// For engine symbols (anything that resolves into a synthetic `@mapmaker/*`
// module or the globals definition file) we render OUR docs from the bundle
// instead of the LSP's type string. User-defined symbols fall through to the
// LSP hover unchanged. Styling lives in editor/extensions/theme.ts.

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

// CM6 clamps tooltips to this rect. Default is the full viewport, which lets
// hover popovers sit flush against the right/bottom edge. Inset a few pixels
// so the popover keeps breathing room from the window edge.
const TOOLTIP_VIEWPORT_INSET = 12

function insetTooltipSpace(view: EditorView) {
    const doc = view.dom.ownerDocument.documentElement
    return {
        top: TOOLTIP_VIEWPORT_INSET,
        bottom: doc.clientHeight - TOOLTIP_VIEWPORT_INSET,
        left: TOOLTIP_VIEWPORT_INSET,
        right: doc.clientWidth - TOOLTIP_VIEWPORT_INSET,
    }
}

function isWordChar(c: string | undefined): boolean {
    return !!c && /[A-Za-z0-9_]/u.test(c)
}

/** The bare `[A-Za-z0-9_]` identifier under `pos` (the member name, without
 *  any `.`/`:` qualifier). */
function identifierAt(view: EditorView, pos: number): string {
    const line = view.state.doc.lineAt(pos)
    const text = line.text
    let s = pos - line.from
    let e = pos - line.from
    while (s > 0 && isWordChar(text[s - 1])) s--
    while (e < text.length && isWordChar(text[e])) e++
    return text.slice(s, e)
}

/** Build engine-doc hover blocks for `symbol`, or `null` if nothing matched.
 *  Resolves both library modules (`@mapmaker/...`) and the globals definition
 *  file (where `symbol` is a global name or a member of one). */
function engineHoverBlocks(
    doc: EngineApiDoc,
    target: ReturnType<DefinitionResolver>,
    symbol: string,
): string[] | null {
    if (target.kind === 'doc-module') {
        const node = findDocNode(doc, target.module.alias)
        if (!node) return null
        const member = symbol ? findMember(node, symbol) : undefined
        if (member) {
            return [
                '```\n' + memberSignature(member) + '\n```',
                memberDescription(member) ?? '',
            ].filter(Boolean)
        }
        return node.description
            ? ['```\n' + node.moduleName + '\n```', node.description]
            : ['```\n' + node.moduleName + '\n```']
    }

    if (target.kind === 'definition-file') {
        if (!symbol) return null
        const global = doc.globals.find((g) => g.moduleName === symbol)
        if (global) {
            return global.description
                ? ['```\n' + global.moduleName + '\n```', global.description]
                : ['```\n' + global.moduleName + '\n```']
        }
        for (const g of doc.globals) {
            const member = findMember(g, symbol)
            if (member) {
                return [
                    '```\n' + memberSignature(member) + '\n```',
                    memberDescription(member) ?? '',
                ].filter(Boolean)
            }
        }
    }
    return null
}

export function lspHover(
    client: LspClient,
    uri: string,
    resolve: DefinitionResolver,
    getEngineApiDoc: () => EngineApiDoc | null,
) {
    const hover = hoverTooltip(async (view, pos) => {
        const lineInfo = view.state.doc.lineAt(pos)
        const lineText = lineInfo.text
        let start = pos
        let end = pos
        while (start > lineInfo.from && /[\w.:]/u.test(lineText[start - lineInfo.from - 1] ?? ''))
            start--
        while (end < lineInfo.to && /[\w.:]/u.test(lineText[end - lineInfo.from] ?? '')) end++

        const lspPos = offsetToPosition(view.state.doc, pos)
        const diagnostics = relevantDiagnostics(
            client.getDiagnostics(uri),
            lspPos.line,
            lspPos.character,
        )

        // Probe the symbol's origin and request the LSP hover in parallel so
        // engine-symbol detection doesn't add a serial round-trip.
        const probePromise = start !== end ? probeDefinition(view, client, uri, pos) : null
        const lspHoverPromise =
            start !== end
                ? client
                      .sendRequest<Hover | null>('textDocument/hover', {
                          textDocument: { uri },
                          position: lspPos,
                      })
                      .catch(() => null)
                : null

        // Engine override: if the symbol resolves into a synthetic module /
        // the globals definition file, render our own docs.
        const doc = getEngineApiDoc()
        if (probePromise && doc) {
            const probe = await probePromise
            if (probe) {
                const resolved = resolve(probe.uri)
                if (resolved.kind === 'doc-module' || resolved.kind === 'definition-file') {
                    const blocks = engineHoverBlocks(doc, resolved, identifierAt(view, pos))
                    if (blocks && (blocks.length > 0 || diagnostics.length > 0)) {
                        return {
                            pos: start === end ? pos : start,
                            end: start === end ? pos + 1 : end,
                            above: false,
                            strictSide: true,
                            create() {
                                return { dom: buildHoverDom(diagnostics, blocks) }
                            },
                        }
                    }
                }
            }
        }

        // Fall back to the LSP hover for user-defined symbols.
        const result = lspHoverPromise ? await lspHoverPromise : null
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
    return [hover, tooltips({ tooltipSpace: insetTooltipSpace })]
}
