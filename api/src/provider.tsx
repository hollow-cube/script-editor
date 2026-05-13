import { createContext, useContext, type ReactNode } from 'react'

import type { HCClient } from './client'

const hcClientContext = createContext<HCClient | null>(null)

type HCClientProviderProps = {
    client: HCClient
    children: ReactNode
}

export function HCClientProvider({ client, children }: HCClientProviderProps) {
    return <hcClientContext.Provider value={client}>{children}</hcClientContext.Provider>
}

// Resolve the client used by a hook. If `override` is provided, it wins.
// Otherwise the provider's client is used. Throws if neither is available.
export function useHCClient(override?: HCClient): HCClient {
    const ctx = useContext(hcClientContext)
    const client = override ?? ctx
    if (!client) {
        throw new Error(
            'useHCClient: no client available. Wrap your app in <HCClientProvider> or pass an explicit client.',
        )
    }
    return client
}
