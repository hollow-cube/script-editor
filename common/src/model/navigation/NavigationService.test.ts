import { beforeEach, describe, expect, test } from 'bun:test'

import { createMemoryStorage } from '../../platform'
import type { EditorGroupNode, Tab, WorkspaceState } from '../../workspace/types'
import { ActionRegistry } from '../actions/ActionRegistry'
import { ContextService } from '../context/ContextService'
import { WorkspaceLayoutService } from '../workspace/WorkspaceLayoutService'
import { NavigationService } from './NavigationService'
import type { AnyEditorMetadata, ToolMetadata } from './types'

function leaf(id: string, tabs: Tab[] = [], activeId: string | null = null): EditorGroupNode {
    return { kind: 'leaf', id, tabs, activeId }
}

function makeInitial(centerLeafId = 'leaf-center'): WorkspaceState {
    return {
        columnSizes: [22, 78, 0],
        middleSizes: [100, 0],
        docksVisible: { left: true, right: false, bottom: false },
        left: { tabs: [], activeId: null },
        right: { tabs: [], activeId: null },
        bottom: { tabs: [], activeId: null },
        center: leaf(centerLeafId),
        focusedLeafId: centerLeafId,
    }
}

const TOOLS: ToolMetadata[] = [
    { kind: 'tool:files', title: 'Files', defaultLocation: 'left' },
    { kind: 'tool:problems', title: 'Problems', defaultLocation: 'bottom' },
]

const EDITORS: AnyEditorMetadata[] = [
    {
        kind: 'editor:welcome',
        mimeTypes: [],
        singleton: true,
        titleFor: () => 'Welcome',
    },
    {
        kind: 'editor:text',
        mimeTypes: ['text/*'],
        titleFor: (p) => ((p as { path?: string })?.path ?? 'Untitled').split('/').pop()!,
    },
    {
        kind: 'editor:docs',
        mimeTypes: ['application/x-docs'],
        titleFor: (p) => (p as { symbol?: string })?.symbol ?? 'Docs',
    },
]

function makeServices(initial?: WorkspaceState) {
    const storage = createMemoryStorage()
    const context = new ContextService()
    const actions = new ActionRegistry({ context })
    const layout = new WorkspaceLayoutService({
        storage,
        storageKey: 'test:nav',
        initialState: initial ?? makeInitial(),
        persistDebounceMs: 0,
        actions,
    })
    const nav = new NavigationService({
        actions,
        layout,
        tools: TOOLS,
        editors: EDITORS,
    })
    return { actions, layout, nav, context }
}

describe('NavigationService — openEditor', () => {
    let svc: ReturnType<typeof makeServices>
    beforeEach(() => {
        svc = makeServices()
    })

    test('creates a new tab in the focused leaf when nothing matches', () => {
        svc.actions.run('workspace.openEditor', {
            kind: 'editor:text',
            payload: { path: 'foo.txt' },
        })
        const center = svc.layout.center.peek()
        if (center.kind !== 'leaf') throw new Error('expected leaf')
        expect(center.tabs).toHaveLength(1)
        expect(center.tabs[0]!.kind).toBe('editor:text')
        expect(center.tabs[0]!.title).toBe('foo.txt')
    })

    test('uses titleFor to derive the title when not provided', () => {
        svc.nav.openEditor({ kind: 'editor:text', payload: { path: 'src/a.luau' } })
        const center = svc.layout.center.peek()
        if (center.kind !== 'leaf') throw new Error('expected leaf')
        expect(center.tabs[0]!.title).toBe('a.luau')
    })

    test('honors an explicit title over titleFor', () => {
        svc.nav.openEditor({
            kind: 'editor:text',
            payload: { path: 'x' },
            title: 'Custom',
        })
        const center = svc.layout.center.peek()
        if (center.kind !== 'leaf') throw new Error('expected leaf')
        expect(center.tabs[0]!.title).toBe('Custom')
    })

    test('singleton editors focus the existing instance instead of creating a duplicate', () => {
        svc.nav.openEditor({ kind: 'editor:welcome' })
        svc.nav.openEditor({ kind: 'editor:welcome' })
        const center = svc.layout.center.peek()
        if (center.kind !== 'leaf') throw new Error('expected leaf')
        expect(center.tabs).toHaveLength(1)
    })

    test('identityKey reuses a tab when the keyed payload field matches', () => {
        svc.nav.openEditor({
            kind: 'editor:text',
            payload: { path: 'foo.txt' },
            identityKey: 'path',
        })
        svc.nav.openEditor({
            kind: 'editor:text',
            payload: { path: 'foo.txt' },
            identityKey: 'path',
        })
        const center = svc.layout.center.peek()
        if (center.kind !== 'leaf') throw new Error('expected leaf')
        expect(center.tabs).toHaveLength(1)
    })

    test('identityKey creates a new tab when payload field differs', () => {
        svc.nav.openEditor({
            kind: 'editor:text',
            payload: { path: 'a.txt' },
            identityKey: 'path',
        })
        svc.nav.openEditor({
            kind: 'editor:text',
            payload: { path: 'b.txt' },
            identityKey: 'path',
        })
        const center = svc.layout.center.peek()
        if (center.kind !== 'leaf') throw new Error('expected leaf')
        expect(center.tabs).toHaveLength(2)
    })

    test('resolves by mimeType when kind is not provided', () => {
        svc.nav.openEditor({ mimeType: 'text/plain', payload: { path: 'a.txt' } })
        const center = svc.layout.center.peek()
        if (center.kind !== 'leaf') throw new Error('expected leaf')
        expect(center.tabs[0]!.kind).toBe('editor:text')
    })

    test('mimeType wildcard matches concrete types', () => {
        svc.nav.openEditor({ mimeType: 'text/luau', payload: { path: 'a.luau' } })
        const center = svc.layout.center.peek()
        if (center.kind !== 'leaf') throw new Error('expected leaf')
        expect(center.tabs[0]!.kind).toBe('editor:text')
    })

    test('no-op (just warns) when neither kind nor mime resolves', () => {
        svc.nav.openEditor({ kind: 'editor:nonexistent' })
        const center = svc.layout.center.peek()
        if (center.kind !== 'leaf') throw new Error('expected leaf')
        expect(center.tabs).toHaveLength(0)
    })

    test('opens via actions.run with payload coerced to args', () => {
        const ok = svc.actions.run('workspace.openEditor', {
            kind: 'editor:text',
            payload: { path: 'z.txt' },
        })
        expect(ok).toBe(true)
        const center = svc.layout.center.peek()
        if (center.kind !== 'leaf') throw new Error('expected leaf')
        expect(center.tabs[0]!.title).toBe('z.txt')
    })
})

describe('NavigationService — openTool', () => {
    let svc: ReturnType<typeof makeServices>
    beforeEach(() => {
        svc = makeServices()
    })

    test('opens a tool in its default dock when no dock specified', () => {
        svc.nav.openTool({ kind: 'tool:files' })
        const left = svc.layout.left.peek()
        expect(left.tabs).toHaveLength(1)
        expect(left.tabs[0]!.kind).toBe('tool:files')
    })

    test('opens a tool in the specified dock', () => {
        svc.nav.openTool({ kind: 'tool:files', dock: 'right' })
        const right = svc.layout.right.peek()
        expect(right.tabs).toHaveLength(1)
        expect(right.tabs[0]!.kind).toBe('tool:files')
    })

    test('focuses an existing tool tab when opened again in the same dock', () => {
        svc.nav.openTool({ kind: 'tool:files' })
        svc.nav.openTool({ kind: 'tool:files' })
        const left = svc.layout.left.peek()
        expect(left.tabs).toHaveLength(1)
    })

    test('moves a tool between docks when reopened with a different dock', () => {
        svc.nav.openTool({ kind: 'tool:files' })
        svc.nav.openTool({ kind: 'tool:files', dock: 'right' })
        expect(svc.layout.left.peek().tabs).toHaveLength(0)
        expect(svc.layout.right.peek().tabs).toHaveLength(1)
    })

    test('warns and no-ops for an unknown tool kind', () => {
        svc.nav.openTool({ kind: 'tool:doesnotexist' })
        expect(svc.layout.left.peek().tabs).toHaveLength(0)
        expect(svc.layout.right.peek().tabs).toHaveLength(0)
        expect(svc.layout.bottom.peek().tabs).toHaveLength(0)
    })

    test('dispatched via actions.run with kind in payload', () => {
        const ok = svc.actions.run('workspace.openTool', { kind: 'tool:problems' })
        expect(ok).toBe(true)
        expect(svc.layout.bottom.peek().tabs).toHaveLength(1)
    })

    test('dispatched via actions.run with empty payload is a no-op', () => {
        const ok = svc.actions.run('workspace.openTool', {})
        expect(ok).toBe(true)
        expect(svc.layout.left.peek().tabs).toHaveLength(0)
    })
})

describe('NavigationService — disposal', () => {
    test('unregisters its actions on dispose', () => {
        const svc = makeServices()
        expect(svc.actions.get('workspace.openEditor')).toBeTruthy()
        expect(svc.actions.get('workspace.openTool')).toBeTruthy()
        svc.nav.dispose()
        expect(svc.actions.get('workspace.openEditor')).toBeUndefined()
        expect(svc.actions.get('workspace.openTool')).toBeUndefined()
    })
})
