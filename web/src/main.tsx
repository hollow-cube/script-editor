import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { routes } from '@generouted/react-router'

import { AppRoot } from '@hollowcube/common'
import { createHashLaunchCodeSource } from '@hollowcube/common/auth'
import { createBrowserStorage } from '@hollowcube/common/platform'

import { resolveApiBaseUrl } from './api-base'

import '@hollowcube/design-system/globals.css'

// Browser-history routing here, so the launch-code fragment (#code=…) doesn't
// collide with the router. Desktop omits this (hash routing + Phase 2 handoff).
//
// `apiBaseUrl` is resolved at runtime from the page hostname (web/src/api-base.ts),
// not baked in at build time, so one artifact serves prod / per-PR previews /
// the localhost-backend deployment. It is still always an absolute URL,
// cross-origin in prod (editor on hollowcube.net, API on api.hollowcube.net)
// and localhost in dev — there is no same-origin fallback, and an unrecognized
// host throws at load rather than guessing.
// Resolved once here at load — referentially stable for the page lifetime
// (the AuthProvider's HCClient useMemo depends on this not changing).
const apiBaseUrl = resolveApiBaseUrl(window.location.hostname)

const platform = {
    kind: 'web' as const,
    storage: createBrowserStorage(),
    apiBaseUrl,
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
