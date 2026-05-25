import { useCallback } from 'react'

import { useProject } from '../../model'
import { type OpenEditorArgs, type OpenEditorTarget } from '../../model/navigation/types'
import type { DockId } from '../../workspace'

// Thin React wrapper over the model-layer `workspace.openEditor` and
// `workspace.openTool` actions. The real logic lives in `NavigationService`
// so it's reachable from any other path that exists in the codebase —
// command palette, hotkey bridge, native menu, tests — not just from
// inside React.

// Re-exported for back-compat with existing import sites.
export type { OpenEditorArgs, OpenEditorTarget }

export type ProjectActions = {
    openEditor: (args: OpenEditorArgs) => void
    openTool: (toolKind: string, opts?: { dock?: DockId }) => void
}

/** Hook variant kept for callers that prefer the typed `{ openEditor,
 *  openTool }` surface. New code can call `project.actions.run(...)`
 *  directly. */
export function useProjectActions(): ProjectActions {
    const actions = useProject().actions
    const openEditor = useCallback(
        (args: OpenEditorArgs) => {
            actions.run('workspace.openEditor', args as unknown as Record<string, unknown>)
        },
        [actions],
    )
    const openTool = useCallback(
        (toolKind: string, opts?: { dock?: DockId }) => {
            actions.run('workspace.openTool', {
                kind: toolKind,
                ...(opts?.dock ? { dock: opts.dock } : {}),
            })
        },
        [actions],
    )
    return { openEditor, openTool }
}
