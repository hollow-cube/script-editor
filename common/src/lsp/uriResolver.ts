// Map an LSP-side URI back to a project file path, a doc-module, or the
// configurable definition file so the editor can decide whether to open a
// file tab or route to the docs editor. luau-lsp resolves
// `require('@alias/foo')` to a `.lua` path while user files use `.luau`; we
// accept both extensions when matching.

import { findDefinitionFileByPath, type DefinitionFile } from './definitionFiles'
import { findDocModuleByPath, type DocModule } from './docModules'

export function pathFromFileUri(uri: string): string {
    if (uri.startsWith('file://')) {
        const rest = uri.slice('file://'.length)
        return rest.startsWith('/') ? rest : '/' + rest
    }
    return uri
}

export function fileUriFromPath(path: string): string {
    const normalized = path.startsWith('/') ? path : '/' + path
    return 'file://' + normalized
}

export function withSwappedExtension(path: string): string | null {
    if (path.endsWith('.luau')) return path.slice(0, -5) + '.lua'
    if (path.endsWith('.lua')) return path.slice(0, -4) + '.luau'
    return null
}

export type ResolvedUri =
    | { kind: 'file'; path: string }
    | { kind: 'doc-module'; module: DocModule }
    | { kind: 'definition-file'; file: DefinitionFile }
    | { kind: 'unknown' }

/** Resolver that uses a set of known project file paths. The host (the text
 *  editor's file-tree integration) supplies the list since the workspace
 *  primitive doesn't model files. */
export function resolveUri(uri: string, knownPaths: Iterable<string>): ResolvedUri {
    const path = pathFromFileUri(uri)

    const docModule = findDocModuleByPath(path)
    if (docModule) return { kind: 'doc-module', module: docModule }

    const defFile = findDefinitionFileByPath(path)
    if (defFile) return { kind: 'definition-file', file: defFile }

    const swapped = withSwappedExtension(path)
    const knownSet = new Set(knownPaths)
    const candidatesWithLeadingSlash = [path, swapped].filter((p): p is string => Boolean(p))
    for (const candidate of candidatesWithLeadingSlash) {
        // Project file paths are stored without a leading slash (API form);
        // LSP URIs are absolute. Try both.
        const stripped = candidate.startsWith('/') ? candidate.slice(1) : candidate
        if (knownSet.has(stripped)) return { kind: 'file', path: stripped }
        if (knownSet.has(candidate)) return { kind: 'file', path: candidate }
    }

    return { kind: 'unknown' }
}
