import { describe, expect, test } from 'bun:test'

import { type WorkspaceState } from './types'
import { isWorkspaceState } from './validate'

const valid: WorkspaceState = {
    columnSizes: [22, 78, 0],
    middleSizes: [100, 0],
    docksVisible: { left: true, right: false, bottom: false },
    left: { tabs: [], activeId: null },
    right: { tabs: [], activeId: null },
    bottom: { tabs: [], activeId: null },
    center: { kind: 'leaf', id: 'leaf-a', tabs: [], activeId: null },
    focusedLeafId: 'leaf-a',
}

describe('isWorkspaceState', () => {
    test('accepts a well-formed default state', () => {
        expect(isWorkspaceState(valid)).toBe(true)
    })

    test('accepts a nested split tree with tabs', () => {
        const state: WorkspaceState = {
            ...valid,
            left: {
                tabs: [{ id: 't1', kind: 'tool:files', title: 'Files' }],
                activeId: 't1',
            },
            center: {
                kind: 'split',
                id: 'split-1',
                orientation: 'horizontal',
                sizes: [50, 50],
                children: [
                    { kind: 'leaf', id: 'leaf-l', tabs: [], activeId: null },
                    {
                        kind: 'leaf',
                        id: 'leaf-r',
                        tabs: [
                            {
                                id: 't2',
                                kind: 'editor:text',
                                title: 'a.lua',
                                payload: { path: '/a.lua' },
                            },
                        ],
                        activeId: 't2',
                    },
                ],
            },
            focusedLeafId: 'leaf-r',
        }
        expect(isWorkspaceState(state)).toBe(true)
    })

    test('accepts focusedLeafId of null', () => {
        expect(isWorkspaceState({ ...valid, focusedLeafId: null })).toBe(true)
    })

    test.each([
        ['not an object', 'nope'],
        ['null', null],
        ['array', []],
        ['empty object', {}],
        ['partial — missing center', { ...structuredClone(valid), center: undefined }],
        ['columnSizes wrong arity', { ...structuredClone(valid), columnSizes: [1, 2] }],
        ['columnSizes non-finite', { ...structuredClone(valid), columnSizes: [1, 2, NaN] }],
        ['middleSizes wrong arity', { ...structuredClone(valid), middleSizes: [1, 2, 3] }],
        [
            'docksVisible missing a flag',
            { ...structuredClone(valid), docksVisible: { left: true, right: false } },
        ],
        [
            'docksVisible non-boolean',
            {
                ...structuredClone(valid),
                docksVisible: { left: 'yes', right: false, bottom: false },
            },
        ],
        ['dock state not an object', { ...structuredClone(valid), left: null }],
        [
            'dock activeId wrong type',
            { ...structuredClone(valid), left: { tabs: [], activeId: 5 } },
        ],
        [
            'tab missing title',
            {
                ...structuredClone(valid),
                left: { tabs: [{ id: 'x', kind: 'tool:files' }], activeId: null },
            },
        ],
        [
            'tab payload not an object',
            {
                ...structuredClone(valid),
                left: {
                    tabs: [{ id: 'x', kind: 'tool:files', title: 'F', payload: 'bad' }],
                    activeId: null,
                },
            },
        ],
        ['center unknown kind', { ...structuredClone(valid), center: { kind: 'frame', id: 'z' } }],
        [
            'split missing a child',
            {
                ...structuredClone(valid),
                center: {
                    kind: 'split',
                    id: 's',
                    orientation: 'horizontal',
                    sizes: [50, 50],
                    children: [{ kind: 'leaf', id: 'l', tabs: [], activeId: null }],
                },
            },
        ],
        [
            'split bad orientation',
            {
                ...structuredClone(valid),
                center: {
                    kind: 'split',
                    id: 's',
                    orientation: 'diagonal',
                    sizes: [50, 50],
                    children: [
                        { kind: 'leaf', id: 'l', tabs: [], activeId: null },
                        { kind: 'leaf', id: 'r', tabs: [], activeId: null },
                    ],
                },
            },
        ],
        ['focusedLeafId wrong type', { ...structuredClone(valid), focusedLeafId: 42 }],
    ])('rejects %s', (_label, input) => {
        expect(isWorkspaceState(input)).toBe(false)
    })
})
