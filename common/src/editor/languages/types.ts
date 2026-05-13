import { type Extension } from '@codemirror/state'

// Lightweight registration for a language: CodeMirror extension factory plus
// optional formatter. LSP integration is a separate layer composed on top
// (see common/src/lsp/cm); the language registry only knows about the
// language-level concerns that apply to every editor instance.

export type FormatResult = { ok: true; text: string } | { ok: false; error: string }

export type LanguageDefinition = {
    /** Stable identifier (e.g. 'json', 'luau'). Used to look up by id. */
    id: string
    /** Mime patterns accepted (supports `<type>/*` wildcards). */
    mimeTypes: readonly string[]
    /** Lower-cased file extensions including the dot, e.g. ['.json'] or ['.luau', '.lua']. */
    extensions: readonly string[]
    /** Factory for the CodeMirror language/highlighting extension. Called once
     *  per editor mount. */
    cmExtension: () => Extension
    /** Optional formatter. Returns the formatted text or an error message. */
    formatter?: (text: string) => FormatResult
}
