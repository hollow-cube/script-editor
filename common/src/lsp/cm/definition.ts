import { EditorView } from '@codemirror/view'
import type { Location, LocationLink, Range as LspRange } from 'vscode-languageserver-types'

import { setFlashHighlight } from '../../editor/extensions/flashHighlight'
import { type LspClient } from '../LspClient'
import { type ResolvedUri } from '../uriResolver'
import { offsetToPosition, rangeToOffsets } from './lspUtils'

export type DefinitionResolver = (uri: string) => ResolvedUri

/** Handler invoked when go-to-def lands somewhere outside the current file.
 *  Implementations route based on `resolved.kind`. */
/** Called when goto-definition lands somewhere outside the current file.
 *  `targetRange` is the LSP `Range` of the target (line/character pairs);
 *  pass it to the new editor so it can flash-highlight the landing spot.
 *  `symbol` is the engine identifier the target lands on (for the docs
 *  editor); `null` when the target is the module itself (e.g. the `require`
 *  call) or no identifier could be derived. */
export type DefinitionOpenHandler = (
    resolved: ResolvedUri,
    targetRange?: LspRange,
    symbol?: string | null,
) => void

// Keywords/structural tokens that mean "you landed on the module, not a
// member" (clicking the `require` itself, the trailing `return`, etc.).
const NON_SYMBOL_TOKENS = new Set([
    'return',
    'local',
    'function',
    'export',
    'type',
    'end',
    'require',
    'nil',
    'true',
    'false',
])

function isWordChar(c: string | undefined): boolean {
    return !!c && /[A-Za-z0-9_]/.test(c)
}

function identifierAtRange(content: string, range: LspRange): string | null {
    const line = content.split('\n')[range.start.line]
    if (line === undefined) return null

    if (range.start.line === range.end.line) {
        const slice = line.slice(range.start.character, range.end.character)
        if (/^[A-Za-z_]\w*$/.test(slice) && !NON_SYMBOL_TOKENS.has(slice)) return slice
    }
    let s = range.start.character
    let e = range.start.character
    while (s > 0 && isWordChar(line[s - 1])) s--
    while (e < line.length && isWordChar(line[e])) e++
    const word = line.slice(s, e)
    if (/^[A-Za-z_]\w*$/.test(word) && !NON_SYMBOL_TOKENS.has(word)) return word
    return null
}

/** Derive the engine symbol a cross-file target lands on, for the docs editor.
 *  Only engine targets (synthetic modules / definition files) carry content
 *  we can read here; project files don't need a symbol. */
function symbolForResolved(resolved: ResolvedUri, targetRange?: LspRange): string | null {
    if (!targetRange) return null
    if (resolved.kind === 'doc-module') {
        return identifierAtRange(resolved.module.content, targetRange)
    }
    if (resolved.kind === 'definition-file') {
        return identifierAtRange(resolved.file.content, targetRange)
    }
    return null
}

/** Match the structure of the inline find-usages popup so the host can render
 *  references as if they came from the local string-scan path. The host owns
 *  the popup; we just collect the data. */
export type ReferenceMatch = {
    /** 1-based line within the current file. */
    line: number
    /** 1-based column within the line. */
    col: number
    /** Document offsets in the current file (start / end). */
    from: number
    to: number
    /** The full line text the match lives on. */
    snippet: string
}

/** Called when the LSP returns references for "find usages" because the user
 *  clicked the symbol's own declaration. Receives matches inside the current
 *  file. Cross-file references are dropped here — Luau's references include
 *  the declaration plus same-file usages, which is what JetBrains shows. */
export type ReferencesShowHandler = (
    matches: ReferenceMatch[],
    anchorPos: number,
    sourceRange: { from: number; to: number },
) => void

type DefResult = Location | Location[] | LocationLink[] | null

function asLocations(result: DefResult): (Location | LocationLink)[] {
    if (!result) return []
    return Array.isArray(result) ? (result as (Location | LocationLink)[]) : [result]
}

function targetUriOf(loc: Location | LocationLink): string {
    return 'targetUri' in loc ? loc.targetUri : loc.uri
}

function targetRangeOf(loc: Location | LocationLink) {
    return 'targetUri' in loc ? loc.targetSelectionRange : loc.range
}

/** The cross-file target a symbol resolves to, if any. Shared by go-to-def
 *  and the hover override so both detect engine symbols identically. */
export type ProbeTarget = { uri: string; range: LspRange }

async function requestFirstLocation(
    view: EditorView,
    client: LspClient,
    method: 'textDocument/definition' | 'textDocument/typeDefinition',
    uri: string,
    pos: number,
): Promise<ProbeTarget | null> {
    let result: DefResult = null
    try {
        result = await client.sendRequest<DefResult>(method, {
            textDocument: { uri },
            position: offsetToPosition(view.state.doc, pos),
        })
    } catch {
        return null
    }
    const first = asLocations(result)[0]
    if (!first) return null
    return { uri: targetUriOf(first), range: targetRangeOf(first) }
}

/** Resolve the symbol at `pos` to its cross-file definition/type target
 *  without navigating. Returns `null` for same-file results (locals / the
 *  clicked declaration) — only cross-file targets are interesting for the
 *  hover override. */
export async function probeDefinition(
    view: EditorView,
    client: LspClient,
    uri: string,
    pos: number,
): Promise<ProbeTarget | null> {
    const target =
        (await requestFirstLocation(view, client, 'textDocument/definition', uri, pos)) ??
        (await requestFirstLocation(view, client, 'textDocument/typeDefinition', uri, pos))
    if (!target || target.uri === uri) return null
    return target
}

/** Run a JetBrains-style goto navigation chain at `pos`. Behavior:
 *
 *   1. `textDocument/definition` — primary "go to declaration" lookup.
 *   2. If that returned nothing useful (empty, or it points back at the same
 *      range we clicked), try `textDocument/typeDefinition`. For locals bound
 *      to a module via `require(...)`, the type definition resolves to the
 *      module file, which is what users intuitively expect from a cmd+click.
 *   3. If that also returned nothing useful, fall back to
 *      `textDocument/references` and surface usages in the popup — the
 *      classic "you clicked on the symbol's own declaration" outcome.
 *
 *   A "useful" result is one that lands somewhere *other* than the clicked
 *   range. Same-file results outside the click range simply move the cursor;
 *   cross-file results route through `onOpen` (file tab, docs editor, etc.).
 *
 *   `showReferences` is the find-usages-popup callback the host supplies;
 *   when it's null step 3 is skipped.
 */
export async function runGotoDefinitionAtPos(
    view: EditorView,
    client: LspClient,
    uri: string,
    pos: number,
    resolve: DefinitionResolver,
    onOpen: DefinitionOpenHandler,
    showReferences?: ReferencesShowHandler | null,
): Promise<void> {
    if (await tryNavigate(view, client, 'textDocument/definition', uri, pos, resolve, onOpen)) {
        return
    }
    if (await tryNavigate(view, client, 'textDocument/typeDefinition', uri, pos, resolve, onOpen)) {
        return
    }
    if (showReferences) {
        await runFindReferencesAtPos(view, client, uri, pos, showReferences)
    }
}

/** Issue a goto-style LSP request and act on the first usable target. Returns
 *  `true` when the request consumed the click (navigated or moved cursor),
 *  `false` when the caller should try the next link in the chain. */
async function tryNavigate(
    view: EditorView,
    client: LspClient,
    method: 'textDocument/definition' | 'textDocument/typeDefinition',
    uri: string,
    pos: number,
    resolve: DefinitionResolver,
    onOpen: DefinitionOpenHandler,
): Promise<boolean> {
    let result: DefResult = null
    try {
        result = await client.sendRequest<DefResult>(method, {
            textDocument: { uri },
            position: offsetToPosition(view.state.doc, pos),
        })
    } catch {
        return false
    }
    const arr = asLocations(result)
    const first = arr[0]
    if (!first) return false
    const targetUri = targetUriOf(first)
    const targetRange = targetRangeOf(first)

    if (targetUri === uri) {
        const { from, to } = rangeToOffsets(view.state.doc, targetRange)
        const clickInsideTarget = pos >= from && pos <= to
        if (clickInsideTarget) {
            // The "target" is the clicked symbol's own declaration — no real
            // navigation to do. Let the next link in the chain handle it.
            return false
        }
        view.dispatch({
            selection: { anchor: from },
            scrollIntoView: true,
            effects: setFlashHighlight.of({ from, to }),
        })
        return true
    }

    const resolved = resolve(targetUri)
    onOpen(resolved, targetRange, symbolForResolved(resolved, targetRange))
    return true
}

/** Issue `textDocument/references` and pipe the matches into the host's
 *  find-usages-popup handler. Cross-file matches are skipped — the popup
 *  renders relative to the current file. */
async function runFindReferencesAtPos(
    view: EditorView,
    client: LspClient,
    uri: string,
    pos: number,
    show: ReferencesShowHandler,
): Promise<void> {
    let refs: Location[] | null = null
    try {
        refs = await client.sendRequest<Location[] | null>('textDocument/references', {
            textDocument: { uri },
            position: offsetToPosition(view.state.doc, pos),
            // Exclude the declaration itself — when the user cmd-clicks on a
            // symbol's declaration we want to surface its *usages*. Echoing
            // the declaration back as a single "1 match" hit is noise.
            context: { includeDeclaration: false },
        })
    } catch {
        return
    }
    if (!refs || refs.length === 0) return

    const matches: ReferenceMatch[] = []
    const doc = view.state.doc
    let declarationFrom: number | null = null
    let declarationTo: number | null = null
    for (const r of refs) {
        if (r.uri !== uri) continue
        const { from, to } = rangeToOffsets(doc, r.range)
        // luau-lsp ignores the `includeDeclaration: false` hint and returns
        // the declaration even when we asked to exclude it. Recognize the
        // declaration as the entry that contains the clicked position and
        // drop it from the popup — clicking a symbol's declaration should
        // show its usages, not echo the declaration back.
        if (pos >= from && pos <= to) {
            declarationFrom = from
            declarationTo = to
            continue
        }
        const line = doc.lineAt(from)
        matches.push({
            line: line.number,
            col: from - line.from + 1,
            from,
            to,
            snippet: line.text,
        })
    }
    if (matches.length === 0) return

    // Anchor the popup on the clicked declaration when we recognized it;
    // otherwise on the first usage.
    const anchorFrom = declarationFrom ?? matches[0]?.from ?? pos
    const anchorTo = declarationTo ?? matches[0]?.to ?? pos
    show(matches, anchorFrom, { from: anchorFrom, to: anchorTo })
}

export function lspGotoDefinition(
    client: LspClient,
    uri: string,
    resolve: DefinitionResolver,
    onOpen: DefinitionOpenHandler,
    showReferences?: ReferencesShowHandler | null,
) {
    return EditorView.domEventHandlers({
        mousedown(event, view) {
            if (!event.metaKey && !event.ctrlKey) return false
            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
            if (pos === null) return false
            void runGotoDefinitionAtPos(view, client, uri, pos, resolve, onOpen, showReferences)
            return false
        },
    })
}
