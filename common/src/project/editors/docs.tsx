import { definitionFiles, docModules } from '../../lsp'
import { type EditorDefinition } from '../registry'
import { DOCS_EDITOR_KIND } from './docs-kind'

// Read-only "documentation" editor for synthetic LSP-known modules: engine
// library modules (e.g. `@mapmaker/store`) and the configurable definition
// file. The tab is keyed by `moduleId` so a second go-to-def to the same
// synthetic target hops to the existing tab. v1 renders a placeholder; the
// real docs UI will replace `<DocsTab>` later.

// Re-export for existing import sites (the canonical home is `./docs-kind`).
export { DOCS_EDITOR_KIND }

export type DocsEditorPayload = {
    /** Stable identifier for the synthetic module. Matches the doc-module
     *  alias (e.g. `@mapmaker/store`) for library modules, or the definition
     *  file's `alias` field. */
    moduleId: string
    /** Optional kind discriminator (`library` | `definition-file`) carried
     *  through opens so the renderer can vary its message. */
    kind?: 'library' | 'definition-file'
}

function parsePayload(raw: unknown): DocsEditorPayload {
    if (!raw || typeof raw !== 'object') return { moduleId: '' }
    const obj = raw as Record<string, unknown>
    const out: DocsEditorPayload = {
        moduleId: typeof obj.moduleId === 'string' ? obj.moduleId : '',
    }
    if (obj.kind === 'library' || obj.kind === 'definition-file') out.kind = obj.kind
    return out
}

function DocsTab({ payload }: { payload: DocsEditorPayload }) {
    const moduleId = payload.moduleId
    const kind = payload.kind
    const subtitle =
        kind === 'definition-file'
            ? 'Project type-definition file'
            : kind === 'library'
              ? 'Engine library module'
              : 'Documentation'

    // Best-effort title fallback for cases where only a path was passed.
    const lib = docModules.find((m) => m.alias === moduleId || m.path === moduleId)
    const def = definitionFiles.find((d) => d.alias === moduleId || d.path === moduleId)
    const displayId = lib?.alias ?? def?.alias ?? moduleId

    return (
        <div className='flex h-full flex-col items-center justify-center gap-2 p-6'>
            <p className='text-muted-foreground text-xs uppercase tracking-wide'>{subtitle}</p>
            <h1 className='text-xl font-mono'>{displayId}</h1>
            <p className='text-muted-foreground max-w-md text-center text-sm'>
                Documentation for this module isn&apos;t available yet. Inline rendering will land
                in a follow-up change.
            </p>
        </div>
    )
}

export const docsEditor: EditorDefinition = {
    kind: DOCS_EDITOR_KIND,
    mimeTypes: [],
    parsePayload: (raw) => parsePayload(raw),
    titleFor: (payload) => (payload as DocsEditorPayload).moduleId || 'Documentation',
    render: ({ payload }) => <DocsTab payload={payload as DocsEditorPayload} />,
}
