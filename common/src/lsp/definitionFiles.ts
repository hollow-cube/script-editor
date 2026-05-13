// Project-level definition file: a single synthetic .d.luau the LSP treats
// as ambient type definitions (like a TypeScript .d.ts). The file has no
// counterpart in the project filesystem — its content lives in memory and is
// pre-loaded into the worker's WASI filesystem before LSP traffic begins.
//
// Initial content mirrors @core/standard.d.luau so the mechanism is exercised
// end-to-end even before project-specific definitions exist.

import standardDluauContent from './standard.d.luau?raw'

export type DefinitionFile = {
    /** Virtual absolute path used by the LSP and routed back into the docs
     *  editor when go-to-def lands inside the definition file. */
    path: string
    /** Display name shown in the docs editor tab. */
    alias: string
    /** Content of the definition file. */
    content: string
}

export const projectDefinitionFile: DefinitionFile = {
    path: '/definitions/project.d.luau',
    alias: 'project.d.luau',
    content: standardDluauContent,
}

/** All synthetic definition files (currently just one). */
export const definitionFiles: DefinitionFile[] = [projectDefinitionFile]

export function findDefinitionFileByPath(path: string): DefinitionFile | undefined {
    return definitionFiles.find((f) => f.path === path)
}
