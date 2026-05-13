import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

import { definitionFiles } from './definitionFiles'
import { docModuleAliases, docModuleLspFiles } from './docModules'
import { LspClient, type LspState } from './LspClient'

export type LuauLspContextValue = {
    status: LspState
    client: LspClient | null
}

const LuauLspContext = createContext<LuauLspContextValue | null>(null)

const defaultWorkerFactory = (): Worker =>
    new Worker(new URL('./luau-lsp.worker.ts', import.meta.url), { type: 'module' })

export function LuauLspProvider({ children }: { children: ReactNode }) {
    const startedRef = useRef(false)
    const [status, setStatus] = useState<LspState>('starting')
    const [client, setClient] = useState<LspClient | null>(null)

    useEffect(() => {
        // React strict mode double-invokes effects in dev; guard so we don't
        // spawn a second worker on the immediate re-mount.
        if (startedRef.current) return
        startedRef.current = true

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
        const unsubscribe = instance.onStateChange(setStatus)
        setStatus(instance.getState())
        setClient(instance)

        const files = docModuleLspFiles()
        const defFilePaths = definitionFiles.map((f) => f.path)

        void instance
            .start({
                aliases: docModuleAliases,
                files,
                definitionFiles: defFilePaths,
                trace: 'off',
            })
            .catch((err) => {
                console.error('[luau-lsp] start failed', err)
            })

        return () => {
            unsubscribe()
            setClient(null)
            void instance.stop().finally(() => {
                worker.terminate()
            })
            startedRef.current = false
        }
    }, [])

    return <LuauLspContext.Provider value={{ status, client }}>{children}</LuauLspContext.Provider>
}

export function useLuauLsp(): LuauLspContextValue {
    const ctx = useContext(LuauLspContext)
    if (!ctx) throw new Error('useLuauLsp must be used within a LuauLspProvider')
    return ctx
}
