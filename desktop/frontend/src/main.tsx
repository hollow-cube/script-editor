import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router'
import { routes } from '@generouted/react-router'
import { HotkeysProvider } from '@tanstack/react-hotkeys'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { QueryDevtoolsToggle } from '@hollowcube/common/dev'
import { createBrowserStorage, PlatformProvider } from '@hollowcube/common/platform'

import '@hollowcube/design-system/globals.css'
import './style.css'

const queryClient = new QueryClient()
const router = createHashRouter(routes)
const platform = { kind: 'desktop' as const, storage: createBrowserStorage() }

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <PlatformProvider platform={platform}>
            <QueryClientProvider client={queryClient}>
                <HotkeysProvider>
                    <RouterProvider router={router} />
                    {import.meta.env.DEV ? <QueryDevtoolsToggle /> : null}
                </HotkeysProvider>
            </QueryClientProvider>
        </PlatformProvider>
    </StrictMode>,
)
