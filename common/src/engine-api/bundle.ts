import { engineApiDocSchema, type EngineApiDoc } from './schema'

// Loads + parses the engine API bundle. Today it's a single static JSON served
// from `public/` (mirrors how the Luau WASM is fetched at a root path on both
// web and the Wails asset host). The future remote/permanently-cached download
// swaps only the fetch in `loadEngineApiBundle` — nothing downstream changes.

// Base-relative so it resolves under Vite's `base` (e.g. `/editor/`) instead
// of always hitting the server root, which a subpath deploy never serves.
const BUNDLE_URL = import.meta.env.BASE_URL + 'engine-api.editor.json'

/** Synthetic require-able module: didOpen'd against the LSP so
 *  `require('@mapmaker/...')` resolves and type-checks. */
export type EngineApiDocModule = {
    /** Display id, e.g. `@mapmaker/store` (bare `@mapmaker` is the package). */
    alias: string
    /** Virtual path the LSP uses; all modules share one dir so the generated
     *  files' relative `require("./init")` etc. resolve. */
    path: string
    content: string
}

/** Ambient `.d.luau` definition file (engine globals like `Text`/`runtime`). */
export type EngineApiDefinitionFile = {
    path: string
    alias: string
    content: string
}

export type EngineApiBundle = {
    doc: EngineApiDoc
    docModules: EngineApiDocModule[]
    /** `.luaurc`-shaped alias map (prefix with `@` + trailing `/`). */
    docModuleAliases: Record<string, string>
    /** Empty when the bundle has no globals (`types.global === ''`). */
    definitionFiles: EngineApiDefinitionFile[]
}

const MODULE_DIR = '/src/mapmaker/'
const MODULE_ALIASES: Record<string, string> = { '@mapmaker/': MODULE_DIR }

/** `@mapmaker` → `/src/mapmaker/init.lua`,
 *  `@mapmaker/player` → `/src/mapmaker/player.lua`.
 *  The `.lua` (not `.luau`) extension is deliberate: luau-lsp normalizes
 *  alias/relative requires to `.lua` before lookup, so the didOpen path must
 *  match or every `require("@mapmaker/...")` reports "Unknown require".
 *  `findDocModuleByPath` accepts either extension for go-to-def routing. */
function moduleKeyToPath(key: string): string {
    const rest = key === '@mapmaker' ? 'init' : key.slice('@mapmaker/'.length)
    return `${MODULE_DIR}${rest}.lua`
}

function buildDocModules(doc: EngineApiDoc): EngineApiDocModule[] {
    return Object.entries(doc.types.modules).map(([alias, content]) => ({
        alias,
        path: moduleKeyToPath(alias),
        content,
    }))
}

function buildDefinitionFiles(doc: EngineApiDoc): EngineApiDefinitionFile[] {
    if (doc.types.global.trim() === '') return []
    return [
        {
            path: '/definitions/global.d.luau',
            alias: 'global.d.luau',
            content: doc.types.global,
        },
    ]
}

function errMessage(e: unknown): string {
    return e instanceof Error ? e.message : String(e)
}

export async function loadEngineApiBundle(): Promise<EngineApiBundle> {
    let json: unknown
    try {
        const resp = await fetch(BUNDLE_URL)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        json = await resp.json()
    } catch (e) {
        throw new Error(`Failed to fetch engine API bundle from ${BUNDLE_URL}: ${errMessage(e)}`, {
            cause: e,
        })
    }

    const parsed = engineApiDocSchema.safeParse(json)
    if (!parsed.success) {
        throw new Error(`Engine API bundle failed schema validation: ${parsed.error.message}`, {
            cause: parsed.error,
        })
    }
    const doc = parsed.data

    return {
        doc,
        docModules: buildDocModules(doc),
        docModuleAliases: MODULE_ALIASES,
        definitionFiles: buildDefinitionFiles(doc),
    }
}
