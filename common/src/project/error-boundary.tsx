import { Component, type ErrorInfo, type ReactNode } from 'react'

import { reportDiagnostic } from '@hollowcube/api'

// React error boundaries are still class-only as of React 19. Three flavors
// live here:
//
//  • <AppErrorBoundary>  — top-level fallback. Renders a centered apology +
//    a "Reload" button. Used to wrap the whole app in main.tsx.
//
//  • <ProjectErrorBoundary> — wraps the project provider subtree (LSP worker
//    init, engine-api parse, project hydration) so one failing bootstrap
//    dependency degrades gracefully instead of nuking the editor and
//    crash-looping through the same init on reload.
//
//  • <PaneErrorBoundary> — wraps each editor/tool render so a single bad tab
//    can't crash the rest of the workspace. Surfaces the error inline with a
//    "Close tab" action provided by the consumer.
//
// PaneErrorBoundary resets on `resetKey` change so callers can recover by
// remounting (e.g. the user closes the offending tab and the boundary
// re-tries on the new tab).

type AppBoundaryProps = {
    children: ReactNode
    /** Optional custom fallback. Receives the captured error and a reset fn. */
    fallback?: (error: Error, reset: () => void) => ReactNode
}

type State = { error: Error | null }

// Drop every persisted workspace layout, then hard-reload. The escape hatch
// for a *deterministic* render crash: a plain reload re-reads the same poison
// and loops forever, so BLK-1's parse-time guard isn't enough on its own —
// this is the net for any crash class it doesn't catch (a bad tab payload, a
// future poison shape, a wedged store).
//
// This boundary sits above <PlatformProvider>, so it can't reach
// `platform.storage` — both shells back storage with `localStorage`, so a
// direct prefix sweep is the pragmatic equivalent. The `hc-project:` prefix
// (no version suffix) clears layout for every project and stays correct if
// the storage key's `-vN` suffix is later dropped.
function resetWorkspaceAndReload() {
    try {
        const ls = window.localStorage
        const stale: string[] = []
        for (let i = 0; i < ls.length; i++) {
            const key = ls.key(i)
            if (key?.startsWith('hc-project:')) stale.push(key)
        }
        for (const key of stale) ls.removeItem(key)
    } catch {
        // localStorage disabled/unavailable — nothing to clear; reload anyway.
    }
    window.location.reload()
}

export class AppErrorBoundary extends Component<AppBoundaryProps, State> {
    override state: State = { error: null }

    static getDerivedStateFromError(error: Error): State {
        return { error }
    }

    override componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[AppErrorBoundary]', error, info.componentStack)
    }

    private reset = () => this.setState({ error: null })

    override render() {
        if (!this.state.error) return this.props.children
        if (this.props.fallback) return this.props.fallback(this.state.error, this.reset)
        return (
            <div className='bg-background text-foreground flex h-svh w-full flex-col items-center justify-center gap-4 p-6 text-center'>
                <div className='flex flex-col gap-1'>
                    <h1 className='text-lg font-medium'>Something went wrong.</h1>
                    <p className='text-muted-foreground text-sm'>{this.state.error.message}</p>
                </div>
                <div className='flex gap-2'>
                    <button
                        type='button'
                        onClick={() => window.location.reload()}
                        className='bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1.5 text-sm font-medium'
                    >
                        Reload
                    </button>
                    <button
                        type='button'
                        onClick={resetWorkspaceAndReload}
                        className='bg-muted text-foreground hover:bg-muted/80 rounded-md px-3 py-1.5 text-sm font-medium'
                    >
                        Reset workspace &amp; reload
                    </button>
                </div>
            </div>
        )
    }
}

type ProjectBoundaryProps = { children: ReactNode }

export class ProjectErrorBoundary extends Component<ProjectBoundaryProps, State> {
    override state: State = { error: null }

    static getDerivedStateFromError(error: Error): State {
        return { error }
    }

    override componentDidCatch(error: Error, info: ErrorInfo) {
        reportDiagnostic({
            scope: 'project-boundary',
            message: 'project provider subtree crashed',
            error,
            context: { componentStack: info.componentStack ?? undefined },
        })
    }

    // Retry remounts the subtree, re-running project/LSP/engine-api init —
    // recovers from a transient bootstrap failure without a full reload.
    private reset = () => this.setState({ error: null })

    override render() {
        if (!this.state.error) return this.props.children
        return (
            <div className='bg-background text-foreground flex h-svh w-full flex-col items-center justify-center gap-4 p-6 text-center'>
                <div className='flex flex-col gap-1'>
                    <h1 className='text-lg font-medium'>The project failed to load.</h1>
                    <p className='text-muted-foreground text-sm'>{this.state.error.message}</p>
                </div>
                <div className='flex gap-2'>
                    <button
                        type='button'
                        onClick={this.reset}
                        className='bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1.5 text-sm font-medium'
                    >
                        Retry
                    </button>
                    <button
                        type='button'
                        onClick={resetWorkspaceAndReload}
                        className='bg-muted text-foreground hover:bg-muted/80 rounded-md px-3 py-1.5 text-sm font-medium'
                    >
                        Reset workspace &amp; reload
                    </button>
                </div>
            </div>
        )
    }
}

type PaneBoundaryProps = {
    children: ReactNode
    /** Identifier used to auto-reset when the wrapped tab changes. */
    resetKey: string
    /** Label for the action that lets the user dismiss the failing pane. */
    onClose?: () => void
}

type PaneState = { error: Error | null; resetKey: string }

export class PaneErrorBoundary extends Component<PaneBoundaryProps, PaneState> {
    override state: PaneState = { error: null, resetKey: this.props.resetKey }

    static getDerivedStateFromError(error: Error): Partial<PaneState> {
        return { error }
    }

    static getDerivedStateFromProps(props: PaneBoundaryProps, state: PaneState): PaneState | null {
        // Auto-reset when the wrapped tab swaps in.
        if (props.resetKey !== state.resetKey) {
            return { error: null, resetKey: props.resetKey }
        }
        return null
    }

    override componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[PaneErrorBoundary]', this.props.resetKey, error, info.componentStack)
    }

    private reset = () => this.setState({ error: null, resetKey: this.props.resetKey })

    override render() {
        if (!this.state.error) return this.props.children
        return (
            <div className='text-muted-foreground flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-xs'>
                <div className='flex flex-col gap-1'>
                    <div className='text-foreground text-sm font-medium'>This pane crashed.</div>
                    <code className='text-[0.7rem] break-all'>{this.state.error.message}</code>
                </div>
                <div className='flex gap-2'>
                    <button
                        type='button'
                        onClick={this.reset}
                        className='bg-muted hover:bg-muted/80 rounded-md px-2 py-1 text-xs'
                    >
                        Retry
                    </button>
                    {this.props.onClose ? (
                        <button
                            type='button'
                            onClick={this.props.onClose}
                            className='bg-muted hover:bg-muted/80 rounded-md px-2 py-1 text-xs'
                        >
                            Close tab
                        </button>
                    ) : null}
                </div>
            </div>
        )
    }
}
