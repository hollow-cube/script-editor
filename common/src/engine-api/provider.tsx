import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { loadEngineApiBundle, type EngineApiBundle } from './bundle'

// Loads the engine API bundle once for the app and exposes it via context.
// The bundle is the source for: the LSP synthetic modules / definition file
// (consumed by `LuauLspProvider`), the docs editor, the hover override, and
// the docs search source.

export type EngineApiState =
    | { status: 'loading'; bundle: null; error: null }
    | { status: 'ready'; bundle: EngineApiBundle; error: null }
    | { status: 'error'; bundle: null; error: Error }

const EngineApiContext = createContext<EngineApiState | null>(null)

// Module-level so the load survives React StrictMode's dev double-mount and
// any provider remount — and so it's the single in-memory cache (the seam
// where the future remote/persistent cache plugs in).
let bundlePromise: Promise<EngineApiBundle> | null = null
function getBundlePromise(): Promise<EngineApiBundle> {
    if (!bundlePromise) bundlePromise = loadEngineApiBundle()
    return bundlePromise
}

export function EngineApiProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<EngineApiState>({
        status: 'loading',
        bundle: null,
        error: null,
    })

    useEffect(() => {
        let cancelled = false
        getBundlePromise()
            .then((bundle) => {
                if (!cancelled) setState({ status: 'ready', bundle, error: null })
                return undefined
            })
            .catch((err: unknown) => {
                const e = err instanceof Error ? err : new Error(String(err))
                console.error('[engine-api] load failed', e)
                if (!cancelled) setState({ status: 'error', bundle: null, error: e })
            })
        return () => {
            cancelled = true
        }
    }, [])

    return <EngineApiContext.Provider value={state}>{children}</EngineApiContext.Provider>
}

export function useEngineApi(): EngineApiState {
    const ctx = useContext(EngineApiContext)
    if (!ctx) throw new Error('useEngineApi must be used within an EngineApiProvider')
    return ctx
}
