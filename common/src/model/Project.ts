// `Project` — the per-open-project service container.
//
// Construction order is dependency order; `dispose()` runs in reverse so
// downstream services can still reach their deps while shutting down.
//
//   • Phase 1 — `context: ContextService`, `actions: ActionRegistry`
//   • Phase 2 — `layout: WorkspaceLayoutService`
//   • Phase 3 — `activeEditor`, `pendingFiles`, `fileTree`, `bootstrap`,
//               `textModels`
//   • Phase 4 — `lsp`, `engineApi`, `events`, `search`, `languages`

import type { HCClient } from '@hollowcube/api'

import type { Platform } from '../platform'
import type { WorkspaceState } from '../workspace/types'
import { ActionRegistry } from './actions/ActionRegistry'
import { ActiveEditorRegistry } from './active-editor/ActiveEditorRegistry'
import { ProjectBootstrap } from './bootstrap/ProjectBootstrap'
import { ContextService } from './context/ContextService'
import { FileTreeService } from './files/FileTreeService'
import { PendingFilesService } from './files/PendingFilesService'
import { TextModelService } from './text-models/TextModelService'
import { WorkspaceLayoutService } from './workspace/WorkspaceLayoutService'

export interface ProjectDeps {
    projectId: string
    platform: Platform
    client: HCClient
    /** Initial workspace layout used when no persisted blob exists (or it
     *  failed to load / failed validation). The caller owns the initial
     *  shape because tools and editors are registered host-side. */
    initialLayout: WorkspaceState
}

export class Project {
    readonly projectId: string
    readonly platform: Platform
    readonly client: HCClient
    readonly context: ContextService
    readonly actions: ActionRegistry
    readonly layout: WorkspaceLayoutService
    readonly activeEditor: ActiveEditorRegistry
    readonly pendingFiles: PendingFilesService
    readonly fileTree: FileTreeService
    readonly bootstrap: ProjectBootstrap
    readonly textModels: TextModelService

    constructor(deps: ProjectDeps) {
        this.projectId = deps.projectId
        this.platform = deps.platform
        this.client = deps.client
        this.context = new ContextService()
        this.actions = new ActionRegistry({ context: this.context })
        this.layout = new WorkspaceLayoutService({
            storage: deps.platform.storage,
            storageKey: `hc-project:${deps.projectId}`,
            initialState: deps.initialLayout,
        })
        this.activeEditor = new ActiveEditorRegistry()
        this.pendingFiles = new PendingFilesService()
        this.fileTree = new FileTreeService({
            projectId: deps.projectId,
            client: deps.client,
        })
        this.bootstrap = new ProjectBootstrap({
            projectId: deps.projectId,
            client: deps.client,
            platform: deps.platform,
            fileTree: this.fileTree,
        })
        this.textModels = new TextModelService({
            projectId: deps.projectId,
            client: deps.client,
            fileTree: this.fileTree,
            pendingFiles: this.pendingFiles,
        })
        // Kick off the bootstrap fetch.
        this.bootstrap.start()
    }

    dispose(): void {
        // Reverse construction order.
        this.textModels.dispose()
        this.bootstrap.dispose()
        this.fileTree.dispose()
        this.pendingFiles.dispose()
        this.activeEditor.dispose()
        this.layout.dispose()
        this.actions.dispose()
        this.context.dispose()
    }
}
