/// <reference lib="webworker" />
// Web Worker that boots the standalone luau-lsp wasm reactor and pipes
// JSON-RPC frames between the main thread (postMessage) and the wasm's C ABI
// (lsp_send_message / host_send_message).
//
// The wasm module exposes raw JSON-RPC — not a high-level JS API. Each
// main-thread postMessage is one LSP message object; we stringify, copy into
// wasm linear memory, and call lsp_send_message. The wasm replies via the
// imported host_send_message which we forward to the main thread.
//
// Aliases & .luaurc: luau-lsp's WorkspaceFileResolver reads `.luaurc` via
// Luau::FileUtils::readFile -> wasi-libc fopen. We mount a PreopenDirectory
// at "/" with a virtual filesystem so those reads succeed. The host supplies
// alias config and synthetic definition-file content via the `__configure`
// control message before sending any LSP traffic.

import {
    ConsoleStdout,
    Directory,
    File,
    type Inode,
    OpenFile,
    PreopenDirectory,
    WASI,
} from '@bjorn3/browser_wasi_shim'

import standardDluauContent from './standard.d.luau?raw'

const WASM_URL = '/Luau.LanguageServer.Wasm.wasm'

type WasmExports = {
    memory: WebAssembly.Memory
    lsp_init: () => void
    lsp_alloc: (n: number) => number
    lsp_free: (ptr: number) => void
    lsp_send_message: (ptr: number, len: number) => void
    lsp_set_definitions: (pkgPtr: number, pkgLen: number, srcPtr: number, srcLen: number) => void
    lsp_set_documentation: (ptr: number, len: number) => void
    lsp_shutdown: () => void
}

type SyntheticFile = { path: string; content: string }

export type WorkerConfigureMessage = {
    __configure: true
    /** Map of `aliasName` -> path. Written to a virtual `/.luaurc` before lsp_init. */
    aliases?: Record<string, string>
    /** Synthetic files written into the virtual filesystem at the given paths.
     *  Used for definition files set via lsp config — the LSP reads them via
     *  wasi-libc fopen. */
    syntheticFiles?: SyntheticFile[]
}

const decoder = new TextDecoder()
const encoder = new TextEncoder()

let exp: WasmExports

function memoryView(ptr: number, len: number): Uint8Array {
    return new Uint8Array(exp.memory.buffer, ptr, len)
}

function copyIn(s: string): { ptr: number; len: number } {
    const bytes = encoder.encode(s)
    const ptr = exp.lsp_alloc(bytes.length)
    memoryView(ptr, bytes.length).set(bytes)
    return { ptr, len: bytes.length }
}

let pendingConfig: WorkerConfigureMessage | null = null
let configReady: Promise<void>
{
    let resolveConfig!: () => void
    configReady = new Promise<void>((resolve) => {
        resolveConfig = resolve
    })
    setTimeout(() => resolveConfig(), 200)
    self.addEventListener('message', (event: MessageEvent) => {
        const data = event.data as { __configure?: true } | unknown
        if (data && typeof data === 'object' && (data as { __configure?: true }).__configure) {
            pendingConfig = data as WorkerConfigureMessage
            resolveConfig()
        }
    })
}

function buildLuaurcContent(aliases: Record<string, string> | undefined): string {
    return JSON.stringify({ aliases: aliases ?? {} }, null, 2)
}

/** Build a virtual root filesystem hierarchy and place each synthetic file
 *  at its absolute path. Intermediate directories are created on demand. */
function buildRootContents(luaurcBytes: Uint8Array, files: SyntheticFile[]): Map<string, Inode> {
    const root: Map<string, Inode> = new Map([['.luaurc', new File(luaurcBytes)]])
    for (const f of files) {
        const parts = f.path.split('/').filter((s) => s.length > 0)
        const last = parts.pop()
        if (!last) continue
        let dir = root
        for (const seg of parts) {
            const existing = dir.get(seg)
            if (existing instanceof Directory) {
                dir = existing.contents
            } else {
                const next = new Directory(new Map<string, Inode>())
                dir.set(seg, next)
                dir = next.contents
            }
        }
        dir.set(last, new File(encoder.encode(f.content)))
    }
    return root
}

async function bootstrap(): Promise<void> {
    await configReady

    const luaurcBytes = encoder.encode(buildLuaurcContent(pendingConfig?.aliases))
    const syntheticFiles = pendingConfig?.syntheticFiles ?? []

    const rootContents = buildRootContents(luaurcBytes, syntheticFiles)
    const rootDir = new PreopenDirectory('/', rootContents)

    const wasi = new WASI(
        [],
        [],
        [
            new OpenFile(new File([])),
            ConsoleStdout.lineBuffered((m) => console.log('[wasm stdout]', m)),
            ConsoleStdout.lineBuffered((m) => console.warn('[wasm stderr]', m)),
            rootDir,
        ],
        { debug: false },
    )

    const wasmResp = await fetch(WASM_URL)
    if (!wasmResp.ok)
        throw new Error(`failed to fetch wasm: ${wasmResp.status} ${wasmResp.statusText}`)

    const importObject: WebAssembly.Imports = {
        wasi_snapshot_preview1: wasi.wasiImport,
        env: {
            host_send_message: (ptr: number, len: number) => {
                const text = decoder.decode(memoryView(ptr, len))
                try {
                    self.postMessage(JSON.parse(text))
                } catch (err) {
                    console.error(
                        '[lsp-worker] failed to parse server->host JSON',
                        text.slice(0, 200),
                        err,
                    )
                }
            },
            host_log: (level: number, ptr: number, len: number) => {
                const message = decoder.decode(memoryView(ptr, len))
                const fn =
                    level >= 3
                        ? console.log
                        : level === 2
                          ? console.info
                          : level === 1
                            ? console.warn
                            : console.error
                fn(`[wasm L${level}]`, message)
            },
        },
    }

    const { instance } = await WebAssembly.instantiateStreaming(wasmResp, importObject)
    exp = instance.exports as unknown as WasmExports

    wasi.initialize(
        instance as unknown as {
            exports: { memory: WebAssembly.Memory; _initialize?: () => unknown }
        },
    )
    exp.lsp_init()

    // Standard luau definitions (@core) — bundled as a code asset and registered
    // via the dedicated definitions channel.
    try {
        const pkg = copyIn('@core')
        const src = copyIn(standardDluauContent)
        exp.lsp_set_definitions(pkg.ptr, pkg.len, src.ptr, src.len)
        exp.lsp_free(pkg.ptr)
        exp.lsp_free(src.ptr)
    } catch (err) {
        console.warn('[lsp-worker] failed to register standard definitions:', err)
    }
}

const ready = bootstrap().catch((err) => {
    console.error('[lsp-worker] bootstrap failed', err)
    throw err
})

self.addEventListener('message', async (event: MessageEvent) => {
    const data = event.data as { __configure?: true } | unknown
    if (data && typeof data === 'object' && (data as { __configure?: true }).__configure) return
    await ready
    const json = JSON.stringify(event.data)
    const slab = copyIn(json)
    try {
        exp.lsp_send_message(slab.ptr, slab.len)
    } finally {
        exp.lsp_free(slab.ptr)
    }
})
