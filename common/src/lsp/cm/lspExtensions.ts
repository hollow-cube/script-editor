import { type EngineApiDoc } from '../../engine-api'
import { type LspClient } from '../LspClient'
import { lspCompletion } from './completion'
import {
    lspGotoDefinition,
    type DefinitionOpenHandler,
    type DefinitionResolver,
    type ReferencesShowHandler,
} from './definition'
import { lspDiagnostics } from './diagnostics'
import { lspDocumentLinks } from './documentLinks'
import { lspFolding } from './folding'
import { lspHover } from './hover'
import { lspInlayHints } from './inlayHints'
import { lspOnTypeFormatting } from './onTypeFormatting'
import { lspSemanticTokens } from './semanticTokens'
import { lspSignatureHelp } from './signatureHelp'

export type LspExtensionsOptions = {
    client: LspClient
    uri: string
    resolve: DefinitionResolver
    onDefinitionOpen: DefinitionOpenHandler
    /** Host's find-usages popup. When provided, clicking on a symbol's own
     *  declaration falls back to `textDocument/references` instead of moving
     *  the cursor in place. */
    onShowReferences?: ReferencesShowHandler
    /** Accessor for the loaded engine API doc. When it returns non-null, the
     *  hover override renders our own docs for engine symbols. */
    getEngineApiDoc: () => EngineApiDoc | null
}

// Compose the full set of LSP-driven CodeMirror extensions for one open
// document. Use only when `client` is non-null and the client is `running`.
// didOpen/didChange/didClose are NOT wired here — the buffer bridge owns
// document lifecycle so unmounting an editor (tab switch) doesn't drop LSP
// state for that document.
export function lspExtensions(opts: LspExtensionsOptions) {
    return [
        lspDiagnostics(opts.client, opts.uri),
        lspHover(opts.client, opts.uri, opts.resolve, opts.getEngineApiDoc),
        lspCompletion(opts.client, opts.uri),
        lspSignatureHelp(opts.client, opts.uri),
        lspGotoDefinition(
            opts.client,
            opts.uri,
            opts.resolve,
            opts.onDefinitionOpen,
            opts.onShowReferences,
        ),
        lspFolding(opts.client, opts.uri),
        lspSemanticTokens(opts.client, opts.uri),
        lspInlayHints(opts.client, opts.uri),
        lspOnTypeFormatting(opts.client, opts.uri),
        lspDocumentLinks(opts.client, opts.uri, opts.resolve, opts.onDefinitionOpen),
    ]
}
