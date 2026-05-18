import { type EditorGroupNode, type Tab, type ToolDockState, type WorkspaceState } from './types'

// Structural guard for a persisted `WorkspaceState`. `runMigrations` only
// versions the blob — it does no shape checking and ends in `state as
// WorkspaceState`. A blob that JSON-parses but is structurally wrong/partial
// ({}, a half-written value, future state after a downgrade) would otherwise
// be spread into the store and crash on first render; a reload re-reads the
// same poison, bricking the app. This guard is the gate that turns "crash
// loop" into "fall back to the default layout".
//
// Hand-rolled rather than zod so `workspace/` stays dependency-free (the rest
// of the directory is). Keep it in sync with `types.ts`.

function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isNumberTuple(v: unknown, len: number): boolean {
    return (
        Array.isArray(v) &&
        v.length === len &&
        v.every((n) => typeof n === 'number' && Number.isFinite(n))
    )
}

function isNullableString(v: unknown): boolean {
    return v === null || typeof v === 'string'
}

function isTab(v: unknown): v is Tab {
    if (!isObject(v)) return false
    if (typeof v.id !== 'string' || typeof v.kind !== 'string' || typeof v.title !== 'string') {
        return false
    }
    if (v.payload !== undefined && !isObject(v.payload)) return false
    return true
}

function isTabArray(v: unknown): v is Tab[] {
    return Array.isArray(v) && v.every(isTab)
}

function isToolDockState(v: unknown): v is ToolDockState {
    return isObject(v) && isTabArray(v.tabs) && isNullableString(v.activeId)
}

function isEditorGroupNode(v: unknown): v is EditorGroupNode {
    if (!isObject(v)) return false
    if (v.kind === 'leaf') {
        return typeof v.id === 'string' && isTabArray(v.tabs) && isNullableString(v.activeId)
    }
    if (v.kind === 'split') {
        if (typeof v.id !== 'string') return false
        if (v.orientation !== 'horizontal' && v.orientation !== 'vertical') return false
        if (!isNumberTuple(v.sizes, 2)) return false
        if (!Array.isArray(v.children) || v.children.length !== 2) return false
        return isEditorGroupNode(v.children[0]) && isEditorGroupNode(v.children[1])
    }
    return false
}

export function isWorkspaceState(v: unknown): v is WorkspaceState {
    if (!isObject(v)) return false
    if (!isNumberTuple(v.columnSizes, 3)) return false
    if (!isNumberTuple(v.middleSizes, 2)) return false
    if (!isObject(v.docksVisible)) return false
    const dv = v.docksVisible
    if (
        typeof dv.left !== 'boolean' ||
        typeof dv.right !== 'boolean' ||
        typeof dv.bottom !== 'boolean'
    ) {
        return false
    }
    if (!isToolDockState(v.left) || !isToolDockState(v.right) || !isToolDockState(v.bottom)) {
        return false
    }
    if (!isEditorGroupNode(v.center)) return false
    if (!isNullableString(v.focusedLeafId)) return false
    return true
}
