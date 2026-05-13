import { create, type StoreApi, type UseBoundStore } from 'zustand'

import { type Storage } from '@hollowcube/common/platform'

import { DEFAULT_SPLIT_BIAS } from './constants'
import { type DockId, type EditorGroupNode, type Tab, type WorkspaceState } from './types'

type Actions = {
    // Layout sizing
    setColumnSizes: (sizes: [number, number, number]) => void
    setMiddleSizes: (sizes: [number, number]) => void
    setLeafSplitSizes: (splitId: string, sizes: [number, number]) => void

    // Tab membership
    activateTab: (location: TabLocation, tabId: string) => void
    closeTab: (location: TabLocation, tabId: string) => void
    reorderTabs: (location: TabLocation, fromIdx: number, toIdx: number) => void
    moveTab: (from: TabLocation, to: TabLocation, tabId: string, targetIndex: number) => void
    /** Split a leaf into a new sibling, placing the tab on `side`. */
    splitLeafWithTab: (
        leafId: string,
        side: 'left' | 'right' | 'top' | 'bottom',
        from: TabLocation,
        tabId: string,
    ) => void

    // Dock visibility
    toggleDock: (dock: DockId) => void
    setDockVisible: (dock: DockId, visible: boolean) => void

    // Persistence helpers
    reset: () => void
}

export type TabLocation = { kind: 'tool'; dock: DockId } | { kind: 'editor'; leafId: string }

export type WorkspaceStore = WorkspaceState & Actions

type CreateOpts = {
    storageKey: string
    initialState: WorkspaceState
    storage: Storage
}

const STORAGE_VERSION = 2
type Persisted = { version: number; state: WorkspaceState }

function readPersisted(storage: Storage, key: string): WorkspaceState | null {
    const raw = storage.get(key)
    if (!raw) return null
    try {
        const parsed = JSON.parse(raw) as Persisted
        if (parsed.version !== STORAGE_VERSION) return null
        return parsed.state
    } catch {
        return null
    }
}

function writePersisted(storage: Storage, key: string, state: WorkspaceState) {
    const payload: Persisted = { version: STORAGE_VERSION, state }
    storage.set(key, JSON.stringify(payload))
}

export function createWorkspaceStore(opts: CreateOpts): UseBoundStore<StoreApi<WorkspaceStore>> {
    const restored = readPersisted(opts.storage, opts.storageKey)
    const initial = restored ?? opts.initialState

    return create<WorkspaceStore>()((set, get) => {
        const persist = () => {
            const { reset: _r, ...state } = get()
            void _r
            writePersisted(opts.storage, opts.storageKey, state as WorkspaceState)
        }

        return {
            ...initial,

            setColumnSizes: (sizes) => {
                set({ columnSizes: sizes })
                persist()
            },
            setMiddleSizes: (sizes) => {
                set({ middleSizes: sizes })
                persist()
            },
            setLeafSplitSizes: (splitId, sizes) => {
                set((s) => ({ center: updateSplitSizes(s.center, splitId, sizes) }))
                persist()
            },

            activateTab: (loc, tabId) => {
                set((s) => updateDockOrLeaf(s, loc, (d) => ({ ...d, activeId: tabId })))
                persist()
            },

            closeTab: (loc, tabId) => {
                set((s) => {
                    const next = updateDockOrLeaf(s, loc, (d) => {
                        const tabs = d.tabs.filter((t) => t.id !== tabId)
                        const activeId =
                            d.activeId === tabId
                                ? (tabs[Math.max(0, d.tabs.findIndex((t) => t.id === tabId) - 1)]
                                      ?.id ?? null)
                                : d.activeId
                        return { ...d, tabs, activeId }
                    })
                    return loc.kind === 'editor' ? pruneEmptyLeaves(next) : next
                })
                persist()
            },

            reorderTabs: (loc, fromIdx, toIdx) => {
                set((s) =>
                    updateDockOrLeaf(s, loc, (d) => {
                        const tabs = d.tabs.slice()
                        const [moved] = tabs.splice(fromIdx, 1)
                        if (moved) tabs.splice(toIdx, 0, moved)
                        return { ...d, tabs }
                    }),
                )
                persist()
            },

            moveTab: (from, to, tabId, targetIndex) => {
                set((s) => {
                    let movedTab: Tab | null = null
                    const removed = updateDockOrLeaf(s, from, (d) => {
                        const idx = d.tabs.findIndex((t) => t.id === tabId)
                        if (idx === -1) return d
                        movedTab = d.tabs[idx] ?? null
                        const tabs = d.tabs.toSpliced(idx, 1)
                        const activeId =
                            d.activeId === tabId
                                ? (tabs[Math.max(0, idx - 1)]?.id ?? null)
                                : d.activeId
                        return { ...d, tabs, activeId }
                    })
                    if (!movedTab) return s

                    const inserted = updateDockOrLeaf(removed, to, (d) => {
                        const tabs = d.tabs.slice()
                        const idx = Math.max(0, Math.min(targetIndex, tabs.length))
                        tabs.splice(idx, 0, movedTab!)
                        return { ...d, tabs, activeId: movedTab!.id }
                    })

                    return to.kind === 'editor' ? pruneEmptyLeaves(inserted) : inserted
                })
                persist()
            },

            splitLeafWithTab: (leafId, side, from, tabId) => {
                set((s) => {
                    let movedTab: Tab | null = null
                    let next = updateDockOrLeaf(s, from, (d) => {
                        const idx = d.tabs.findIndex((t) => t.id === tabId)
                        if (idx === -1) return d
                        movedTab = d.tabs[idx] ?? null
                        const tabs = d.tabs.toSpliced(idx, 1)
                        const activeId =
                            d.activeId === tabId
                                ? (tabs[Math.max(0, idx - 1)]?.id ?? null)
                                : d.activeId
                        return { ...d, tabs, activeId }
                    })
                    if (!movedTab) return s

                    next = {
                        ...next,
                        center: splitLeafInTree(next.center, leafId, side, movedTab),
                    }
                    return pruneEmptyLeaves(next)
                })
                persist()
            },

            toggleDock: (dock) => {
                set((s) => ({
                    docksVisible: { ...s.docksVisible, [dock]: !s.docksVisible[dock] },
                }))
                persist()
            },
            setDockVisible: (dock, visible) => {
                set((s) => ({ docksVisible: { ...s.docksVisible, [dock]: visible } }))
                persist()
            },

            reset: () => {
                opts.storage.remove(opts.storageKey)
                set({ ...opts.initialState })
            },
        }
    })
}

export function clearWorkspaceStorage(storage: Storage, key: string) {
    storage.remove(key)
}

// ---------- selectors ----------

/** Build a `tabId → location` map so drag handlers don't re-walk the tree on
 *  every onDragOver tick. Callers should memoize on the relevant slices
 *  (left/right/bottom tabs and the center tree). */
export function selectTabLocations(state: WorkspaceState): Map<string, TabLocation> {
    const map = new Map<string, TabLocation>()
    for (const dock of ['left', 'right', 'bottom'] as const) {
        for (const tab of state[dock].tabs) {
            map.set(tab.id, { kind: 'tool', dock })
        }
    }
    walkLeaves(state.center, (leaf) => {
        for (const tab of leaf.tabs) {
            map.set(tab.id, { kind: 'editor', leafId: leaf.id })
        }
    })
    return map
}

function walkLeaves(
    node: EditorGroupNode,
    visit: (leaf: Extract<EditorGroupNode, { kind: 'leaf' }>) => void,
): void {
    if (node.kind === 'leaf') {
        visit(node)
        return
    }
    walkLeaves(node.children[0], visit)
    walkLeaves(node.children[1], visit)
}

export function findLeaf(
    node: EditorGroupNode,
    leafId: string,
): Extract<EditorGroupNode, { kind: 'leaf' }> | null {
    if (node.kind === 'leaf') return node.id === leafId ? node : null
    return findLeaf(node.children[0], leafId) ?? findLeaf(node.children[1], leafId)
}

// ---------- pure tree helpers ----------

function updateDockOrLeaf(
    state: WorkspaceState,
    loc: TabLocation,
    update: <T extends { tabs: Tab[]; activeId: string | null }>(d: T) => T,
): WorkspaceState {
    if (loc.kind === 'tool') {
        return { ...state, [loc.dock]: update(state[loc.dock]) } as WorkspaceState
    }
    return { ...state, center: mapLeaf(state.center, loc.leafId, update) }
}

function mapLeaf(
    node: EditorGroupNode,
    leafId: string,
    update: (
        leaf: Extract<EditorGroupNode, { kind: 'leaf' }>,
    ) => Extract<EditorGroupNode, { kind: 'leaf' }>,
): EditorGroupNode {
    if (node.kind === 'leaf') {
        if (node.id !== leafId) return node
        return update(node)
    }
    return {
        ...node,
        children: [
            mapLeaf(node.children[0], leafId, update),
            mapLeaf(node.children[1], leafId, update),
        ],
    }
}

function updateSplitSizes(
    node: EditorGroupNode,
    splitId: string,
    sizes: [number, number],
): EditorGroupNode {
    if (node.kind === 'leaf') return node
    if (node.id === splitId) return { ...node, sizes }
    return {
        ...node,
        children: [
            updateSplitSizes(node.children[0], splitId, sizes),
            updateSplitSizes(node.children[1], splitId, sizes),
        ],
    }
}

function splitLeafInTree(
    node: EditorGroupNode,
    leafId: string,
    side: 'left' | 'right' | 'top' | 'bottom',
    tab: Tab,
): EditorGroupNode {
    if (node.kind === 'split') {
        return {
            ...node,
            children: [
                splitLeafInTree(node.children[0], leafId, side, tab),
                splitLeafInTree(node.children[1], leafId, side, tab),
            ],
        }
    }
    if (node.id !== leafId) return node

    const newLeaf: EditorGroupNode = {
        kind: 'leaf',
        id: makeId('leaf'),
        tabs: [tab],
        activeId: tab.id,
    }

    const orientation = side === 'left' || side === 'right' ? 'horizontal' : 'vertical'
    const before = side === 'left' || side === 'top'

    return {
        kind: 'split',
        id: makeId('split'),
        orientation,
        sizes: [DEFAULT_SPLIT_BIAS[0], DEFAULT_SPLIT_BIAS[1]],
        children: before ? [newLeaf, node] : [node, newLeaf],
    }
}

/** Collapse any empty `leaf` nodes by replacing their parent split with the
 *  remaining sibling. Keeps at least one leaf at the root. */
function pruneEmptyLeaves(state: WorkspaceState): WorkspaceState {
    const next = walkPrune(state.center)
    return { ...state, center: next ?? makeEmptyLeaf() }
}

function walkPrune(node: EditorGroupNode): EditorGroupNode | null {
    if (node.kind === 'leaf') return node.tabs.length > 0 ? node : null
    const left = walkPrune(node.children[0])
    const right = walkPrune(node.children[1])
    if (left && right) return { ...node, children: [left, right] }
    return left ?? right ?? null
}

function makeEmptyLeaf(): EditorGroupNode {
    return { kind: 'leaf', id: makeId('leaf'), tabs: [], activeId: null }
}

export function makeId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`
}
