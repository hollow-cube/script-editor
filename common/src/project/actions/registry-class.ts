// Pure-TypeScript ActionRegistry.
//
// Owns the map of registered actions and dispatches them. Does NOT depend on
// React — usable from `ProjectServices`, hotkey bridges, the search popup,
// the native-menu bridge, and from tests.
//
// A React adapter (`registry.tsx`) wraps an instance in a Context and exposes
// hooks (`useRegisterAction`, `useActions`, `useRunAction`) that subscribe via
// `subscribe()`. The registry has no awareness of React or any specific
// consumer.
//
// Context-tag filtering (`Action.contexts`) is intentionally NOT applied
// inside `run()`. Callers decide whether to consult a `ContextKeys` snapshot
// first — the hotkey bridge does, the imperative `services.actions.run(id)`
// path doesn't. This split matches the prior shape and lets future call
// sites opt in/out without an `if (!ignoreContexts)` flag everywhere.

import { type Action, type ActionRunContext } from './types'

export class ActionRegistry {
    private actions = new Map<string, Action>()
    private listeners = new Set<() => void>()
    private versionNum = 0

    register(action: Action): () => void {
        this.actions.set(action.id, action)
        this.bump()
        return () => {
            // Only delete if the currently-registered action under this id is
            // the same one we registered. Prevents racy re-registers from
            // erasing a newer registration when an earlier component unmounts.
            if (this.actions.get(action.id) === action) {
                this.actions.delete(action.id)
                this.bump()
            }
        }
    }

    unregister(id: string): void {
        if (this.actions.delete(id)) this.bump()
    }

    run(id: string, ctx: ActionRunContext): boolean {
        const action = this.actions.get(id)
        if (!action) return false
        if (action.when && !action.when()) return false
        if (action.disabled) return false
        try {
            void action.run(ctx)
        } catch (err) {
            console.error(`[action:${id}] threw synchronously`, err)
        }
        return true
    }

    list(): readonly Action[] {
        return Array.from(this.actions.values())
    }

    get(id: string): Action | undefined {
        return this.actions.get(id)
    }

    get version(): number {
        return this.versionNum
    }

    /** Subscribe to registration changes. Returns the unsubscribe handle. */
    subscribe(cb: () => void): () => void {
        this.listeners.add(cb)
        return () => {
            this.listeners.delete(cb)
        }
    }

    private bump(): void {
        this.versionNum++
        for (const cb of this.listeners) cb()
    }
}
