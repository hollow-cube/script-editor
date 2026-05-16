// Engine-defined library modules exposed to user scripts via aliases like
// `@mapmaker/store`. They are NOT part of the project tree — they are virtual
// files we didOpen against the LSP so `require('@mapmaker/store')` resolves
// and type-checks. Go-to-definition on a symbol from these modules is
// intercepted and routed to the docs editor instead of opening a file.
//
// The data is no longer hardcoded: `applyEngineApiModules(bundle)` populates
// these (and the definition files) from the loaded engine API bundle. The
// arrays/object identities are stable and mutated in place so the existing
// (non-React) call sites — `findDocModuleByPath`, `docModuleLspFiles`,
// `uriResolver` — keep working without threading the bundle through. This is
// safe because the LSP only starts (and the resolver only runs) *after* the
// bundle has loaded and `applyEngineApiModules` has been called.

import { type EngineApiBundle } from '../engine-api'
import { definitionFiles } from './definitionFiles'
import { type LspStartFile } from './LspClient'

export type DocModule = {
    /** Display name used in tabs / docs, e.g. `@mapmaker/store`. */
    alias: string
    /** Virtual path the LSP uses internally. luau-lsp resolves requires to
     *  `.lua` before lookup. */
    path: string
    /** Module source. Must parse as luau; types here flow into user scripts. */
    content: string
}

/** Populated by `applyEngineApiModules`. Empty until the bundle loads. */
export const docModules: DocModule[] = []

/**
 * `.luaurc`-shaped alias map: prefix (with `@` and trailing `/`) -> directory
 * path. The LSP worker strips `@` / trailing `/` before writing the virtual
 * `.luaurc`. Populated by `applyEngineApiModules`.
 */
export const docModuleAliases: Record<string, string> = {}

/** Replace the synthetic LSP modules / aliases / definition files in place
 *  with the loaded bundle's. Call once, before the LSP worker starts. */
export function applyEngineApiModules(bundle: EngineApiBundle): void {
    docModules.splice(0, docModules.length, ...bundle.docModules)

    for (const key of Object.keys(docModuleAliases)) delete docModuleAliases[key]
    Object.assign(docModuleAliases, bundle.docModuleAliases)

    definitionFiles.splice(0, definitionFiles.length, ...bundle.definitionFiles)
}

/**
 * Look up a doc module by URI path. luau-lsp may navigate to either `.lua`
 * (its preferred extension after require resolution) or `.luau`, so accept both.
 */
export function findDocModuleByPath(path: string): DocModule | undefined {
    return docModules.find((m) => m.path === path || swapLuaExt(m.path) === path)
}

function swapLuaExt(path: string): string {
    if (path.endsWith('.lua')) return path.slice(0, -4) + '.luau'
    if (path.endsWith('.luau')) return path.slice(0, -5) + '.lua'
    return path
}

/** Build the `LspStartFile[]` to didOpen for all doc modules. */
export function docModuleLspFiles(): LspStartFile[] {
    return docModules.map((m) => ({
        uri: 'file://' + m.path,
        languageId: 'luau',
        text: m.content,
    }))
}
