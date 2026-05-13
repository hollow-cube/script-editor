// Engine-defined library modules exposed to user scripts via aliases like
// `@mapmaker/store`. They are NOT part of the project tree — they are virtual
// files we didOpen against the LSP so `require('@mapmaker/store')` resolves
// and type-checks. Go-to-definition on a symbol from these modules is
// intercepted and routed to the docs editor instead of opening a file.

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

const STORE_CONTENT = `--!strict
-- Persistent and ephemeral per-player state.

export type StateSchema = { [string]: string }

export type StateOptions<T> = {
    persistent: boolean,
    schema: StateSchema,
    default: () -> T,
}

export type State<T> = {
    get: (self: State<T>, player: any) -> T,
    set: (self: State<T>, player: any, value: T) -> (),
}

local store = {}

function store.defineState<T>(name: string, options: StateOptions<T>): State<T>
    return (nil :: any) :: State<T>
end

return store
`

const PLAYERS_CONTENT = `--!strict
-- Player lifecycle and interaction events.

export type Listener<T...> = {
    listen: (self: Listener<T...>, callback: (T...) -> ()) -> (),
}

local players = {
    onJoin = (nil :: any) :: Listener<any>,
    onLeave = (nil :: any) :: Listener<any>,
    onLand = (nil :: any) :: Listener<any>,
    onBlockInteract = (nil :: any) :: Listener<any, any>,
}

return players
`

const WORLD_CONTENT = `--!strict
-- World queries and mutations.

local world = {}

function world.getBlock(position: any): string
    return ''
end

function world.setBlock(position: any, block: string): ()
end

return world
`

export const docModules: DocModule[] = [
    { alias: '@mapmaker/store', path: '/src/mapmaker/store.lua', content: STORE_CONTENT },
    { alias: '@mapmaker/players', path: '/src/mapmaker/players.lua', content: PLAYERS_CONTENT },
    { alias: '@mapmaker/world', path: '/src/mapmaker/world.lua', content: WORLD_CONTENT },
]

/**
 * `.luaurc`-shaped alias map: prefix (with `@` and trailing `/`) -> directory
 * path. The LSP worker strips `@` / trailing `/` before writing the virtual
 * `.luaurc`.
 */
export const docModuleAliases: Record<string, string> = {
    '@mapmaker/': '/src/mapmaker/',
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
