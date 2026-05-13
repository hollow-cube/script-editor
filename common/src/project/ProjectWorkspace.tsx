import { useMemo } from 'react'

import { TooltipProvider } from '@hollowcube/design-system'

import { useWorkspaceStore, Workspace } from '../workspace'
import { ProjectProvider, type Project } from './context'
import { DockEmptyState } from './DockEmptyState'
import { welcomeEditor } from './editors/welcome'
import { createInitialWorkspaceState } from './initial-state'
import { ProjectTopBar } from './ProjectTopBar'
import { buildTabRegistry } from './registry'
import { filesTool } from './tools/files'

const DEMO_PROJECT: Project = { id: 'demo', name: 'my-demos' }

const STORAGE_KEY = 'hc-project:demo:workspace-v2'

const TOOLS = [filesTool]
const EDITORS = [welcomeEditor]

export function ProjectWorkspace() {
    const useStore = useWorkspaceStore({
        storageKey: STORAGE_KEY,
        initialState: createInitialWorkspaceState(),
    })

    const tabRegistry = useMemo(() => buildTabRegistry(TOOLS, EDITORS), [])

    return (
        <ProjectProvider project={DEMO_PROJECT}>
            <TooltipProvider>
                <div className='bg-background text-foreground flex h-svh w-full flex-col overflow-hidden'>
                    <ProjectTopBar useStore={useStore} />
                    <div className='min-h-0 flex-1'>
                        <Workspace
                            useStore={useStore}
                            tabRegistry={tabRegistry}
                            renderEmpty={() => <DockEmptyState />}
                        />
                    </div>
                </div>
            </TooltipProvider>
        </ProjectProvider>
    )
}
