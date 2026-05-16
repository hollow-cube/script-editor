// Project-level definition file(s): synthetic `.d.luau` files the LSP treats
// as ambient type definitions (like TypeScript `.d.ts`). They have no
// counterpart in the project filesystem — content lives in memory and is
// pre-loaded into the worker's WASI filesystem before LSP traffic begins.
//
// Content comes from the engine API bundle (`types.global`): the array is
// populated in place by `applyEngineApiModules` in `docModules.ts`. It is
// empty when the bundle has no globals (`types.global === ''`).

export type DefinitionFile = {
    /** Virtual absolute path used by the LSP and routed back into the docs
     *  editor when go-to-def lands inside the definition file. */
    path: string
    /** Display name shown in the docs editor tab. */
    alias: string
    /** Content of the definition file. */
    content: string
}

/** Populated by `applyEngineApiModules`. Empty until the bundle loads (and
 *  stays empty when the bundle declares no globals). */
export const definitionFiles: DefinitionFile[] = []

export function findDefinitionFileByPath(path: string): DefinitionFile | undefined {
    return definitionFiles.find((f) => f.path === path)
}
