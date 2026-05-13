import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Routes } from '@generouted/react-router'
import { HotkeysProvider } from '@tanstack/react-hotkeys'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { QueryDevtoolsToggle } from '@hollowcube/common/dev'
import { createBrowserStorage, PlatformProvider } from '@hollowcube/common/platform'

import '@hollowcube/design-system/globals.css'

const queryClient = new QueryClient()
const platform = { kind: 'web' as const, storage: createBrowserStorage() }

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <PlatformProvider platform={platform}>
            <QueryClientProvider client={queryClient}>
                <HotkeysProvider>
                    <Routes />
                    {import.meta.env.DEV ? <QueryDevtoolsToggle /> : null}
                </HotkeysProvider>
            </QueryClientProvider>
        </PlatformProvider>
    </StrictMode>,
)
