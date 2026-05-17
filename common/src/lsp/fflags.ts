// Luau FFlag loading, mirroring the official luau-lsp VS Code extension
// (editors/code/src/extension.ts). The new type solver (`LuauSolverV2`) is
// gated behind a large set of interdependent `Luau*` FFlags; enabling just
// `LuauSolverV2` against the WASM's compiled-in defaults is not enough and
// misbehaves. The extension fetches the current upstream values for every
// `*Luau*` flag from Roblox's client-settings CDN and passes the whole set;
// we do the same, then force the new solver on.

const CURRENT_FFLAGS =
    'https://clientsettingscdn.roblox.com/v1/settings/application?applicationName=PCStudioApp'

const FFLAG_KINDS = ['FFlag', 'FInt', 'DFFlag', 'DFInt'] as const

type FFlags = Record<string, string>
type FFlagsEndpoint = { applicationSettings: FFlags }

/** Fetch upstream Luau FFlag values and force the new solver on. Falls back
 *  to just enabling the new solver if the network/CDN is unavailable (the
 *  WASM is offline-first; this is best-effort like the extension's `sync`). */
export async function loadLuauFFlags(): Promise<FFlags> {
    const flags: FFlags = {}

    try {
        const resp = await fetch(CURRENT_FFLAGS)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const body = (await resp.json()) as FFlagsEndpoint
        const upstream = body.applicationSettings ?? {}
        for (const [name, value] of Object.entries(upstream)) {
            for (const kind of FFLAG_KINDS) {
                // e.g. `FFlagLuauSolverV2` -> `LuauSolverV2`
                if (name.startsWith(`${kind}Luau`)) {
                    flags[name.slice(kind.length)] = value
                }
            }
        }
    } catch (err) {
        console.warn('[luau-lsp] failed to fetch upstream Luau FFlags; using solver-only set', err)
    }

    // Enable Luau's new type solver (extension's `fflags.enableNewSolver`).
    // The engine type files use read-only / write-only (`read` / `write`)
    // property syntax, which the old solver's parser rejects.
    flags.LuauSolverV2 = 'true'

    return flags
}
