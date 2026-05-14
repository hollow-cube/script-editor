import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useSyncExternalStore,
    type ReactNode,
} from 'react'

import { actionMatchesContext, useActionContextSnapshot } from './context'
import { ActionRegistry } from './registry-class'
import { type Action, type ActionRunContext } from './types'

// Thin React adapter over the plain-TS `ActionRegistry`. The class owns state
// and dispatch; this file exposes a Provider + hooks so consumers can subscribe
// to registration changes and run actions through the same instance.

const ActionRegistryContext = createContext<ActionRegistry | null>(null)

type ProviderProps = {
    children: ReactNode
    initialActions?: readonly Action[]
    /** Optional pre-built registry. When provided, the provider mounts it
     *  directly instead of constructing a fresh one. Lets the host hand in
     *  the `services.actions` instance so a single registry is shared across
     *  the app. */
    registry?: ActionRegistry
}

export function ActionRegistryProvider({ children, initialActions, registry }: ProviderProps) {
    const instance = useMemo(() => {
        const r = registry ?? new ActionRegistry()
        if (initialActions) {
            for (const a of initialActions) r.register(a)
        }
        return r
        // Constructing once: `initialActions` and `registry` are treated as
        // mount-time fixtures. Updates land via `register()` from children.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <ActionRegistryContext.Provider value={instance}>{children}</ActionRegistryContext.Provider>
    )
}

function useActionRegistry(): ActionRegistry {
    const ctx = useContext(ActionRegistryContext)
    if (!ctx) {
        throw new Error('useActionRegistry must be used inside <ActionRegistryProvider>')
    }
    return ctx
}

/** Register an action for the lifetime of the calling component. */
export function useRegisterAction(action: Action) {
    const registry = useActionRegistry()
    const registryRef = useRef(registry)
    registryRef.current = registry
    useEffect(() => {
        return registryRef.current.register(action)
    }, [action])
}

const EMPTY_ACTIONS: readonly Action[] = Object.freeze([])

/** Snapshot of all actions. Re-renders on each registration change. */
export function useActions(): readonly Action[] {
    const registry = useActionRegistry()
    const subscribe = useCallback((cb: () => void) => registry.subscribe(cb), [registry])
    // The class's `list()` builds a fresh array each call, so we cache by
    // version to give `useSyncExternalStore` a stable snapshot reference.
    const lastVersion = useRef(-1)
    const lastList = useRef<readonly Action[]>(EMPTY_ACTIONS)
    const getSnapshot = useCallback(() => {
        if (lastVersion.current !== registry.version) {
            lastVersion.current = registry.version
            lastList.current = registry.list()
        }
        return lastList.current
    }, [registry])
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** Run an action by id. Applies context-tag filtering so non-hotkey callers
 *  (search popup, native menu bridge) get the same availability behavior as
 *  the hotkey path. */
export function useRunAction(): (id: string, ctx: ActionRunContext) => boolean {
    const registry = useActionRegistry()
    const getContextSnapshot = useActionContextSnapshot()
    return useCallback(
        (id, ctx) => {
            const action = registry.get(id)
            if (!action) return false
            if (!actionMatchesContext(getContextSnapshot(), action.contexts)) return false
            return registry.run(id, ctx)
        },
        [registry, getContextSnapshot],
    )
}

/** Read-only handle to the raw registry instance. Reserved for non-React
 *  consumers (e.g. tests, future module-scope bootstrapping). UI code should
 *  use the hooks above. */
export function useActionRegistryInstance(): ActionRegistry {
    return useActionRegistry()
}

export { ActionRegistry }
