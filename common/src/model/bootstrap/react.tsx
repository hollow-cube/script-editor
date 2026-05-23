import { type ReactNode } from 'react'

import { useSignal } from '../foundation/react'
import { useProject } from '../foundation/react'
import type { BootstrapStatus } from './ProjectBootstrap'

export function useBootstrapStatus(): BootstrapStatus {
    return useSignal(useProject().bootstrap.status)
}

export function useProjectMetadata() {
    return useSignal(useProject().bootstrap.project)
}

export function useProjectBootstrap() {
    return useProject().bootstrap
}

/** Render different content per bootstrap state. Useful for the page
 *  shell to gate the main workspace on bootstrap completion. */
export function ProjectGate({
    loading,
    errored,
    children,
}: {
    loading?: ReactNode
    errored?: (error: unknown) => ReactNode
    children: ReactNode
}) {
    const status = useBootstrapStatus()
    if (status.kind === 'idle' || status.kind === 'loading') return loading ?? null
    if (status.kind === 'error') return errored?.(status.error) ?? null
    return children
}
