import { describe, expect, test } from 'bun:test'

import { runMigrations, STORAGE_VERSION, type AnyPersisted } from './migrations'
import { type EditorGroupNode } from './types'

const leaf = (id: string): EditorGroupNode => ({
    kind: 'leaf',
    id,
    tabs: [],
    activeId: null,
})

const v2State = {
    columnSizes: [20, 80, 0],
    middleSizes: [100, 0],
    docksVisible: { left: true, right: false, bottom: false },
    left: { tabs: [], activeId: null },
    right: { tabs: [], activeId: null },
    bottom: { tabs: [], activeId: null },
    center: leaf('leaf-a'),
}

describe('runMigrations', () => {
    test('v2 → v3 adds focusedLeafId pointing at the first leaf', () => {
        const persisted: AnyPersisted = { version: 2, state: v2State }
        const result = runMigrations(persisted)
        expect(result).not.toBeNull()
        expect(result!.focusedLeafId).toBe('leaf-a')
    })

    test('v2 → v3 walks splits to find the first leaf', () => {
        const v2WithSplit = {
            ...v2State,
            center: {
                kind: 'split' as const,
                id: 'split-1',
                orientation: 'horizontal' as const,
                sizes: [50, 50] as [number, number],
                children: [leaf('leaf-left'), leaf('leaf-right')] as [
                    EditorGroupNode,
                    EditorGroupNode,
                ],
            },
        }
        const result = runMigrations({ version: 2, state: v2WithSplit })
        expect(result!.focusedLeafId).toBe('leaf-left')
    })

    test('current-version persisted state passes through unchanged', () => {
        const currentState = { ...v2State, focusedLeafId: 'leaf-a' }
        const result = runMigrations({ version: STORAGE_VERSION, state: currentState })
        expect(result).toEqual(currentState as never)
    })

    test('returns null for future versions to force a reset', () => {
        const result = runMigrations({ version: STORAGE_VERSION + 1, state: v2State })
        expect(result).toBeNull()
    })

    test('returns null when an intermediate migration is missing', () => {
        // version 0 → STORAGE_VERSION should fail because we only have v3.
        const result = runMigrations({ version: 0, state: v2State })
        expect(result).toBeNull()
    })
})
