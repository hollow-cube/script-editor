import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { routes } from '@generouted/react-router'

import { AppRoot } from '@hollowcube/common'
import { createHashLaunchCodeSource } from '@hollowcube/common/auth'
import { createBrowserStorage } from '@hollowcube/common/platform'

import { env } from './env'

import '@hollowcube/design-system/globals.css'

// Browser-history routing here, so the launch-code fragment (#code=…) doesn't
// collide with the router. Desktop omits this (hash routing + Phase 2 handoff).
//
// `apiBaseUrl` is always an absolute, validated URL (web/src/env.ts). It is
// cross-origin in prod (editor on hollowcube.net, API on api.hollowcube.net)
// and points at Envoy directly in dev so the request origin == the DPoP `htu`
// the backend reconstructs — there is no same-origin fallback.
const platform = {
    kind: 'web' as const,
    storage: createBrowserStorage(),
    apiBaseUrl: env.VITE_API_BASE_URL,
    launchCode: createHashLaunchCodeSource(),
}

// generouted's <Routes> builds its own browser router with no basename, so it
// ignores Vite's `base`. Build the router ourselves from its exported route
// tree so client navigation works under the `/editor` subpath.
const basename = import.meta.env.BASE_URL.replace(/\/$/u, '') || '/'
const router = createBrowserRouter(routes, { basename })

createRoot(document.getElementById('root')!).render(
    <AppRoot platform={platform} devTools={import.meta.env.DEV}>
        <RouterProvider router={router} />
    </AppRoot>,
)
