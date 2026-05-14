import { createContext, useContext, useMemo, useEffect, type ReactNode } from 'react'

import { ActionRegistryProvider } from './actions/registry'
import { ProjectServices } from './services'

const ProjectServicesContext = createContext<ProjectServices | null>(null)

/** Mounts a single `ProjectServices` instance for the lifetime of its subtree.
 *  Dispose runs on unmount so per-subsystem listeners are released even if the
 *  host swaps projects without a full app remount. */
export function ProjectServicesProvider({ children }: { children: ReactNode }) {
    const services = useMemo(() => new ProjectServices(), [])

    useEffect(() => {
        return () => {
            services.dispose()
        }
    }, [services])

    return (
        <ProjectServicesContext.Provider value={services}>
            {children}
        </ProjectServicesContext.Provider>
    )
}

export function useProjectServices(): ProjectServices {
    const ctx = useContext(ProjectServicesContext)
    if (!ctx) throw new Error('useProjectServices must be used within a ProjectServicesProvider')
    return ctx
}

/** Adapter that mounts `<ActionRegistryProvider>` backed by
 *  `services.actions`. The whole app then shares the same `ActionRegistry`
 *  instance — React consumers via the registry hooks, non-React consumers
 *  via `services.actions` directly. */
export function ServicesActionRegistryAdapter({ children }: { children: ReactNode }) {
    const services = useProjectServices()
    return <ActionRegistryProvider registry={services.actions}>{children}</ActionRegistryProvider>
}
