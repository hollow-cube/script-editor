import { StrictMode, useEffect, useRef, useState, type ReactNode } from 'react'
import { HotkeysProvider } from '@tanstack/react-hotkeys'

import { AuthProvider, useAuth } from './auth'
import { AppProvider, EditorApp } from './model'
import { PlatformProvider, usePlatform, type Platform } from './platform'
import { AppErrorBoundary } from './project'

// Shared provider tree for both the web SPA shell and the Wails desktop
// frontend. Each shell calls `<AppRoot>` once at the very top of its tree;
// everything below (routing, page components) is identical across platforms.
//
// Platform-specific concerns enter through:
//
//   • `platform` — concrete Platform impl (web/desktop). The shell builds it
//     and hands it in.
//   • `children` — the platform's routing root (e.g. <Routes /> on web,
//     <RouterProvider router={...} /> on desktop).

type AppRootProps = {
    platform: Platform
    children: ReactNode
    /** Compat-only — historically gated the React Query devtools toggle,
     *  which has been removed. Phase 3 of the architecture migration
     *  dropped TanStack Query in favor of services that own their own
     *  fetching. Accepted but unused so older shell call sites compile. */
    devTools?: boolean
}

export function AppRoot({ platform, children }: AppRootProps) {
    return (
        <StrictMode>
            <AppErrorBoundary>
                <PlatformProvider platform={platform}>
                    <AuthProvider>
                        <AppBridge>
                            <HotkeysProvider>{children}</HotkeysProvider>
                        </AppBridge>
                    </AuthProvider>
                </PlatformProvider>
            </AppErrorBoundary>
        </StrictMode>
    )
}

// Phase 1 of the model migration: construct the `EditorApp` once auth has
// produced an HCClient and expose it via `<AppProvider>`. Phase 5 will
// collapse this bridge: AppProvider moves above AuthProvider and
// AuthService is lifted onto EditorApp.
function AppBridge({ children }: { children: ReactNode }) {
    const platform = usePlatform()
    const { client } = useAuth()
    const appRef = useRef<EditorApp | null>(null)
    const [, forceRender] = useState(0)

    useEffect(() => {
        const app = new EditorApp({ platform, client })
        appRef.current = app
        forceRender((n) => n + 1)
        return () => {
            app.dispose()
            if (appRef.current === app) appRef.current = null
        }
    }, [platform, client])

    const app = appRef.current
    if (!app) return null
    return <AppProvider app={app}>{children}</AppProvider>
}
