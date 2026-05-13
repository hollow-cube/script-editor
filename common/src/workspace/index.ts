import './workspace.css'

export { Workspace } from './Workspace'
export { useWorkspaceStore } from './use-workspace-store'
export {
    createWorkspaceStore,
    clearWorkspaceStorage,
    makeId,
    selectTabLocations,
    findLeaf,
    type WorkspaceStore,
    type TabLocation,
} from './store'
export type {
    DockId,
    EditorGroupNode,
    Tab,
    TabKind,
    TabRegistry,
    ToolDockState,
    WorkspaceState,
} from './types'
export { TOGGLE_ANIM_MS, EDGE_ZONE_PCT, DEFAULT_SPLIT_BIAS } from './constants'
export { type DragData, type DragSide } from './drag-data'
