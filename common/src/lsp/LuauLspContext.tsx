import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'

import { useEngineApi } from '../engine-api'
import { useDocumentStore } from '../project/documents'
import { useProjectServices } from '../project/services-context'
import { createApplyWorkspaceEditHandler } from './applyWorkspaceEdit'
import { definitionFiles } from './definitionFiles'
import { applyEngineApiModules, docModuleAliases, docModuleLspFiles } from './docModules'
import { LspClient, type LspState } from './LspClient'
import { startWorkspaceDiagnosticPolling } from './workspaceDiagnostics'

export type LuauLspContextValue = {
    status: LspState
    client: LspClient | null
}

const defaultWorkerFactory = (): Worker =>
    new Worker(new URL('./luau-lsp.worker.ts', import.meta.url), { type: 'module' })

/** Owns the Luau LSP worker lifecycle. Constructs the `LspClient`, starts it,
 *  pushes it into `ProjectServices.lsp.luau`, and tears it down on unmount.
 *  Must be mounted inside a `ProjectServicesProvider`. */
export function LuauLspProvider({ children }: { children: ReactNode }) {
    const services = useProjectServices()
    const documentStore = useDocumentStore()
    const engineApi = useEngineApi()
    const startedRef = useRef(false)

    useEffect(() => {
        // The synthetic modules / definition file come from the engine API
        // bundle; don't start the worker until it's loaded. On error, skip the
        // LSP entirely — the editor stays usable, just without engine types.
        if (engineApi.status !== 'ready') return
        // React strict mode double-invokes effects in dev; guard so we don't
        // spawn a second worker on the immediate re-mount.
        if (startedRef.current) return
        startedRef.current = true

        applyEngineApiModules(engineApi.bundle)

        const worker = defaultWorkerFactory()

        // Strip the leading `@` and trailing `/` from alias keys — .luaurc
        // aliases are bare names.
        const luaurcAliases: Record<string, string> = {}
        for (const [key, target] of Object.entries(docModuleAliases)) {
            const cleanKey = key.replace(/^@/, '').replace(/\/$/, '')
            luaurcAliases[cleanKey] = target
        }

        const syntheticFiles = definitionFiles.map((f) => ({
            path: f.path,
            content: f.content,
        }))

        worker.postMessage({
            __configure: true,
            aliases: luaurcAliases,
            syntheticFiles,
        })

        const instance = new LspClient(worker)
        instance.setApplyWorkspaceEditHandler(createApplyWorkspaceEditHandler(documentStore))
        services.setLuauClient(instance)

        const files = docModuleLspFiles()
        const defFilePaths = definitionFiles.map((f) => f.path)

        let stopWorkspaceDiag: (() => void) | null = null
        void instance
            .start({
                aliases: docModuleAliases,
                files,
                definitionFiles: defFilePaths,
                trace: 'off',
            })
            .then(() => {
                if (instance.getState() === 'running') {
                    stopWorkspaceDiag = startWorkspaceDiagnosticPolling(instance)
                }
                return undefined
            })
            .catch((err) => {
                console.error('[luau-lsp] start failed', err)
            })

        return () => {
            services.setLuauClient(null)
            stopWorkspaceDiag?.()
            void instance.stop().finally(() => {
                worker.terminate()
            })
            startedRef.current = false
        }
    }, [documentStore, services, engineApi])

    return <>{children}</>
}

export function useLuauLsp(): LuauLspContextValue {
    const services = useProjectServices()
    return useSyncExternalStore(
        (cb) => services.subscribeLuauLsp(cb),
        () => services.getLuauLspSnapshot(),
        () => services.getLuauLspSnapshot(),
    )
}
