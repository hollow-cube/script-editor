import { type ReactNode } from 'react'

import { Button } from '@hollowcube/design-system'

import { usePlatform } from '../platform'
import { getActiveProjectId } from './active-project'
import { useAuth } from './context'
import { IndexedDbUnavailableError } from './idb'
import { Launcher } from './launcher'

function Centered({ children }: { children: ReactNode }) {
    return (
        <div className='bg-background text-muted-foreground flex h-svh w-full flex-col items-center justify-center gap-3 p-6 text-center text-sm'>
            {children}
        </div>
    )
}

function formatError(error: unknown): string {
    if (error instanceof Error) return error.message
    return String(error)
}

// Shown both when there is no session at all and when there is a session but
// no project to open (no fresh grant, grant carried no project, or a stale
// tab on the resume path). The only way in is a fresh in-game launch.
function OpenFromGame() {
    const platform = usePlatform()
    return (
        <Centered>
            <span className='text-foreground text-base font-medium'>
                Open the editor from in-game
            </span>
            <span>
                {platform.kind === 'desktop'
                    ? 'Launch the editor from the in-game menu to sign in. No accounts are saved on this device yet.'
                    : 'Join the server and open the editor with the in-game command to sign in.'}
            </span>
        </Centered>
    )
}

// Blocks the workspace until an authenticated session is reachable. Scope is
// the `/` workspace only — demo/dev routes never mount this. Phase 1 stops at
// the authenticated state and renders the workspace children; there is no
// project/file work here.
export function AuthGate({ children }: { children: ReactNode }) {
    const { status, redeemFromLaunch } = useAuth()

    switch (status.kind) {
        case 'initializing':
            return <Centered>Starting up…</Centered>
        case 'redeeming':
            return <Centered>Signing you in…</Centered>
        case 'picking':
            return <Launcher />
        case 'authenticated':
            // An authenticated session alone is not enough — the workspace
            // needs a project to open. No granted project (resume path, grant
            // had none) falls back to the launcher screen, never a stale
            // project.
            return getActiveProjectId() ? children : <OpenFromGame />
        case 'error':
            // IndexedDB-unavailable deterministically re-fails, so "Try
            // again" (re-run redeem) is a dead end — offer a reload after the
            // user fixes their browser settings instead.
            if (status.error instanceof IndexedDbUnavailableError) {
                return (
                    <Centered>
                        <span className='text-destructive'>{status.error.message}</span>
                        <Button
                            variant='outline'
                            size='sm'
                            onClick={() => window.location.reload()}
                        >
                            Reload
                        </Button>
                    </Centered>
                )
            }
            return (
                <Centered>
                    <span className='text-destructive'>
                        Sign-in failed: {formatError(status.error)}
                    </span>
                    <Button variant='outline' size='sm' onClick={redeemFromLaunch}>
                        Try again
                    </Button>
                </Centered>
            )
        case 'unauthenticated':
            return <OpenFromGame />
    }
}
