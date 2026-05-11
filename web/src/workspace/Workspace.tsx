import {
    DndContext,
    DragOverlay,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragOverEvent,
    type DragStartEvent,
} from '@dnd-kit/core'
import { cn } from '@hollowcube/design-system'
import * as React from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'

import { EditorGroup } from './EditorGroup'
import { ResizeHandle } from './ResizeHandle'
import { type WorkspaceStore } from './store'
import { ToolDock } from './ToolDock'
import {
    type DockId,
    type EditorGroupNode,
    type Tab,
    type TabRenderer,
    type ToolDockState,
} from './types'

type WorkspaceProps = {
    useStore: () => WorkspaceStore
    renderTab: TabRenderer
    className?: string
}

type ActiveDrag = {
    tab: Tab
    sourcePaneId: string
    sourceKind: 'tool' | 'editor'
    sourceLocator: { kind: 'tool'; dock: DockId } | { kind: 'editor'; leafId: string }
}

export function Workspace({ useStore, renderTab, className }: WorkspaceProps) {
    const state = useStore()
    const [activeDrag, setActiveDrag] = React.useState<ActiveDrag | null>(null)
    // Pane id currently under the dragged tab. "tool:left", "editor:<leafId>"
    // — derived from the dnd-kit over target so the ring shows for the OWNING
    // pane no matter which interior droppable (tab, content, body) is hovered.
    const [hoveredPaneId, setHoveredPaneId] = React.useState<string | null>(null)

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

    const [toggleAnim, setToggleAnim] = React.useState(false)
    const toggleAnimTimer = React.useRef<number | null>(null)
    const runToggleAnim = React.useCallback(() => {
        setToggleAnim(true)
        if (toggleAnimTimer.current) window.clearTimeout(toggleAnimTimer.current)
        toggleAnimTimer.current = window.setTimeout(() => setToggleAnim(false), 260)
    }, [])

    const onToggleDock = React.useCallback(
        (dock: DockId) => {
            runToggleAnim()
            state.toggleDock(dock)
        },
        [state, runToggleAnim],
    )

    const onDragStart = (e: DragStartEvent) => {
        const data = e.active.data.current as
            | { paneId?: string; tabId?: string; kind?: string }
            | undefined
        if (!data || data.kind !== 'tab' || !data.tabId || !data.paneId) return
        const located = locateTab(state, data.tabId)
        if (!located) return
        setActiveDrag({
            tab: located.tab,
            sourcePaneId: data.paneId,
            sourceKind: located.locator.kind === 'tool' ? 'tool' : 'editor',
            sourceLocator: located.locator,
        })
    }

    const onDragCancel = () => {
        setActiveDrag(null)
        setHoveredPaneId(null)
    }

    const onDragOver = (event: DragOverEvent) => {
        if (!event.over) {
            setHoveredPaneId(null)
            return
        }
        const overId = String(event.over.id)
        const overData = event.over.data.current as
            | { kind?: string; dockId?: DockId; leafId?: string; tabId?: string }
            | undefined
        // tab id → resolve via locator
        if (overData?.kind === 'tab') {
            const loc = locateTab(state, overId)
            if (!loc) return
            setHoveredPaneId(
                loc.locator.kind === 'tool'
                    ? `tool:${loc.locator.dock}`
                    : `editor:${loc.locator.leafId}`,
            )
            return
        }
        if (overData?.kind === 'tool-dock' && overData.dockId) {
            setHoveredPaneId(`tool:${overData.dockId}`)
            return
        }
        if (
            (overData?.kind === 'editor-leaf' || overData?.kind === 'split-edge') &&
            overData.leafId
        ) {
            setHoveredPaneId(`editor:${overData.leafId}`)
            return
        }
        setHoveredPaneId(null)
    }

    const onDragEnd = (event: DragEndEvent) => {
        const drag = activeDrag
        setActiveDrag(null)
        setHoveredPaneId(null)
        if (!drag || !event.over) return
        const overId = String(event.over.id)
        const overData = event.over.data.current as
            | { kind?: string; dockId?: DockId; leafId?: string; side?: string }
            | undefined

        if (overData === undefined || overData.kind === 'tab') {
            const overTabId = overId
            const overTab = locateTab(state, overTabId)
            if (!overTab) return
            if (overTab.locator.kind !== drag.sourceLocator.kind) return
            if (
                overTab.locator.kind === 'tool' &&
                drag.sourceLocator.kind === 'tool' &&
                overTab.locator.dock === drag.sourceLocator.dock
            ) {
                const tabs = state[overTab.locator.dock].tabs
                const fromIdx = tabs.findIndex((t) => t.id === drag.tab.id)
                const toIdx = tabs.findIndex((t) => t.id === overTabId)
                if (fromIdx !== -1 && toIdx !== -1) {
                    state.reorderTabs({ kind: 'tool', dock: overTab.locator.dock }, fromIdx, toIdx)
                }
                return
            }
            if (
                overTab.locator.kind === 'editor' &&
                drag.sourceLocator.kind === 'editor' &&
                overTab.locator.leafId === drag.sourceLocator.leafId
            ) {
                const leaf = findLeaf(state.center, overTab.locator.leafId)
                if (!leaf) return
                const fromIdx = leaf.tabs.findIndex((t) => t.id === drag.tab.id)
                const toIdx = leaf.tabs.findIndex((t) => t.id === overTabId)
                if (fromIdx !== -1 && toIdx !== -1) {
                    state.reorderTabs(
                        { kind: 'editor', leafId: overTab.locator.leafId },
                        fromIdx,
                        toIdx,
                    )
                }
                return
            }
            const targetIndex =
                overTab.locator.kind === 'tool'
                    ? state[overTab.locator.dock].tabs.findIndex((t) => t.id === overTabId)
                    : (findLeaf(state.center, overTab.locator.leafId)?.tabs.findIndex(
                          (t) => t.id === overTabId,
                      ) ?? 0)
            state.moveTab(drag.sourceLocator, overTab.locator, drag.tab.id, targetIndex)
            return
        }

        if (overData.kind === 'tool-dock' && drag.sourceKind === 'tool') {
            const dock = overData.dockId as DockId
            const targetIndex = state[dock].tabs.length
            state.moveTab(drag.sourceLocator, { kind: 'tool', dock }, drag.tab.id, targetIndex)
            return
        }

        if (overData.kind === 'editor-leaf' && drag.sourceKind === 'editor') {
            const leafId = overData.leafId as string
            const leaf = findLeaf(state.center, leafId)
            if (!leaf) return
            const targetIndex = leaf.tabs.length
            state.moveTab(drag.sourceLocator, { kind: 'editor', leafId }, drag.tab.id, targetIndex)
            return
        }

        if (overData.kind === 'split-edge' && drag.sourceKind === 'editor') {
            const leafId = overData.leafId as string
            const side = overData.side as 'left' | 'right' | 'top' | 'bottom'
            state.splitLeafWithTab(leafId, side, drag.sourceLocator, drag.tab.id)
        }
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
        >
            <div
                className={cn(
                    'flex h-full w-full min-w-0 flex-col bg-background',
                    toggleAnim && 'workspace-animating',
                    className,
                )}
                data-slot='workspace'
            >
                <Toolbar state={state} onToggleDock={onToggleDock} />
                <div className='min-h-0 flex-1 px-2 pb-2'>
                    <ShellLayout
                        state={state}
                        activeDragKind={activeDrag?.sourceKind ?? null}
                        hoveredPaneId={hoveredPaneId}
                        renderTab={renderTab}
                    />
                </div>
            </div>

            <DragOverlay dropAnimation={null}>
                {activeDrag ? (
                    <div className='border-primary bg-popover ring-primary/30 pointer-events-none flex items-center gap-1 rounded-md border px-3 py-1 text-[0.75rem] shadow-lg ring-1'>
                        <span>{activeDrag.tab.title}</span>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    )
}

type ShellLayoutProps = {
    state: WorkspaceStore
    activeDragKind: 'tool' | 'editor' | null
    hoveredPaneId: string | null
    renderTab: TabRenderer
}

function ShellLayout({ state, activeDragKind, hoveredPaneId, renderTab }: ShellLayoutProps) {
    // Remember the last non-zero sizes (per dock) so the group's defaultSize
    // restores roughly where the user left them when reopened.
    const lastSize = React.useRef({
        left: state.columnSizes[0] || 18,
        right: state.columnSizes[2] || 18,
        bottom: state.middleSizes[1] || 30,
    })

    const onColumnsChanged = (layout: Record<string, number>) => {
        const l = layout.left ?? 0
        const m = layout.middle ?? 100
        const r = layout.right ?? 0
        state.setColumnSizes([l, m, r])
        if (l > 1) lastSize.current.left = l
        if (r > 1) lastSize.current.right = r
    }
    const onMiddleChanged = (layout: Record<string, number>) => {
        const c = layout.center ?? 100
        const b = layout.bottom ?? 0
        state.setMiddleSizes([c, b])
        if (b > 1) lastSize.current.bottom = b
    }

    const { left: lVisible, right: rVisible, bottom: bVisible } = state.docksVisible
    // Key forces a Group remount when the set of visible docks changes so the
    // lib re-computes layout from defaultSize without us fighting its
    // imperative API.
    const columnsKey = `cols:${lVisible ? 1 : 0}:${rVisible ? 1 : 0}`
    const middleKey = `middle:${bVisible ? 1 : 0}`

    const leftSize = lVisible ? lastSize.current.left : 0
    const rightSize = rVisible ? lastSize.current.right : 0
    const middleSize = Math.max(20, 100 - leftSize - rightSize)
    const bottomSize = bVisible ? lastSize.current.bottom : 0
    const centerSize = Math.max(20, 100 - bottomSize)

    return (
        <Group
            key={columnsKey}
            orientation='horizontal'
            onLayoutChanged={onColumnsChanged}
            className='flex h-full w-full'
            style={{ display: 'flex' }}
        >
            {lVisible ? (
                <>
                    <Panel id='left' defaultSize={leftSize} minSize={6}>
                        <ToolDock
                            dockId='left'
                            state={state.left}
                            renderTab={renderTab}
                            highlightDrop={
                                activeDragKind === 'tool' && hoveredPaneId === 'tool:left'
                            }
                            onActivate={(id) =>
                                state.activateTab({ kind: 'tool', dock: 'left' }, id)
                            }
                            onClose={(id) => state.closeTab({ kind: 'tool', dock: 'left' }, id)}
                        />
                    </Panel>
                    <Separator>
                        <ResizeHandle orientation='horizontal' />
                    </Separator>
                </>
            ) : null}
            <Panel id='middle' defaultSize={middleSize} minSize={20}>
                <Group
                    key={middleKey}
                    orientation='vertical'
                    onLayoutChanged={onMiddleChanged}
                    className='flex h-full w-full flex-col'
                    style={{ display: 'flex' }}
                >
                    <Panel id='center' defaultSize={centerSize} minSize={20}>
                        <EditorGroup
                            node={state.center}
                            activeDragKind={activeDragKind}
                            hoveredPaneId={hoveredPaneId}
                            renderTab={renderTab}
                            onActivate={(leafId, tabId) =>
                                state.activateTab({ kind: 'editor', leafId }, tabId)
                            }
                            onClose={(leafId, tabId) =>
                                state.closeTab({ kind: 'editor', leafId }, tabId)
                            }
                            onSplitResize={state.setLeafSplitSizes}
                        />
                    </Panel>
                    {bVisible ? (
                        <>
                            <Separator>
                                <ResizeHandle orientation='vertical' />
                            </Separator>
                            <Panel id='bottom' defaultSize={bottomSize} minSize={6}>
                                <ToolDock
                                    dockId='bottom'
                                    state={state.bottom}
                                    renderTab={renderTab}
                                    highlightDrop={
                                        activeDragKind === 'tool' && hoveredPaneId === 'tool:bottom'
                                    }
                                    onActivate={(id) =>
                                        state.activateTab({ kind: 'tool', dock: 'bottom' }, id)
                                    }
                                    onClose={(id) =>
                                        state.closeTab({ kind: 'tool', dock: 'bottom' }, id)
                                    }
                                />
                            </Panel>
                        </>
                    ) : null}
                </Group>
            </Panel>
            {rVisible ? (
                <>
                    <Separator>
                        <ResizeHandle orientation='horizontal' />
                    </Separator>
                    <Panel id='right' defaultSize={rightSize} minSize={6}>
                        <ToolDock
                            dockId='right'
                            state={state.right}
                            renderTab={renderTab}
                            highlightDrop={
                                activeDragKind === 'tool' && hoveredPaneId === 'tool:right'
                            }
                            onActivate={(id) =>
                                state.activateTab({ kind: 'tool', dock: 'right' }, id)
                            }
                            onClose={(id) => state.closeTab({ kind: 'tool', dock: 'right' }, id)}
                        />
                    </Panel>
                </>
            ) : null}
        </Group>
    )
}

function Toolbar({
    state,
    onToggleDock,
}: {
    state: WorkspaceStore
    onToggleDock: (dock: DockId) => void
}) {
    return (
        <div className='flex items-center gap-2 px-2 py-2'>
            <ToggleButton
                active={state.docksVisible.left}
                onClick={() => onToggleDock('left')}
                label='Toggle left dock'
                glyph='L'
            />
            <ToggleButton
                active={state.docksVisible.bottom}
                onClick={() => onToggleDock('bottom')}
                label='Toggle bottom dock'
                glyph='B'
            />
            <ToggleButton
                active={state.docksVisible.right}
                onClick={() => onToggleDock('right')}
                label='Toggle right dock'
                glyph='R'
            />
            <div className='ml-auto flex items-center gap-2'>
                <button
                    type='button'
                    onClick={() => state.reset()}
                    className='border-border text-foreground hover:bg-muted rounded-md border bg-transparent px-2 py-0.5 text-[0.7rem]'
                >
                    Reset layout
                </button>
            </div>
        </div>
    )
}

function ToggleButton({
    active,
    onClick,
    label,
    glyph,
}: {
    active: boolean
    onClick: () => void
    label: string
    glyph: string
}) {
    return (
        <button
            type='button'
            onClick={onClick}
            aria-label={label}
            aria-pressed={active}
            className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-sm border text-[0.7rem] font-medium transition-colors',
                active
                    ? 'bg-secondary text-secondary-foreground border-transparent'
                    : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground bg-transparent',
            )}
        >
            {glyph}
        </button>
    )
}

function locateTab(
    state: WorkspaceStore,
    tabId: string,
): {
    tab: Tab
    locator: { kind: 'tool'; dock: DockId } | { kind: 'editor'; leafId: string }
} | null {
    for (const dock of ['left', 'right', 'bottom'] as const) {
        const found = (state[dock] as ToolDockState).tabs.find((t) => t.id === tabId)
        if (found) return { tab: found, locator: { kind: 'tool', dock } }
    }
    const found = findTabInTree(state.center, tabId)
    if (found) return { tab: found.tab, locator: { kind: 'editor', leafId: found.leafId } }
    return null
}

function findTabInTree(node: EditorGroupNode, tabId: string): { tab: Tab; leafId: string } | null {
    if (node.kind === 'leaf') {
        const t = node.tabs.find((x) => x.id === tabId)
        return t ? { tab: t, leafId: node.id } : null
    }
    return findTabInTree(node.children[0], tabId) ?? findTabInTree(node.children[1], tabId)
}

function findLeaf(
    node: EditorGroupNode,
    leafId: string,
): Extract<EditorGroupNode, { kind: 'leaf' }> | null {
    if (node.kind === 'leaf') return node.id === leafId ? node : null
    return findLeaf(node.children[0], leafId) ?? findLeaf(node.children[1], leafId)
}
