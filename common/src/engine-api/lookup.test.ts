import { describe, expect, test } from 'bun:test'

import { findDocNode, findMember } from './lookup'
import { type EngineApiDoc } from './schema'

const doc: EngineApiDoc = {
    schemaVersion: 1,
    kind: 'luau-engine-api',
    globals: [
        {
            moduleName: 'runtime',
            staticProperties: [
                { name: 'version', getter: { type: { kind: 'named', name: 'string' } } },
            ],
        },
    ],
    libraries: {
        '@mapmaker/store': {
            moduleName: '@mapmaker/store',
            staticMethods: [
                { name: 'define_state', returns: [{ type: { kind: 'named', name: 'any' } }] },
            ],
            exports: [
                {
                    name: 'StateDefinition',
                    methods: [{ name: 'get' }, { name: 'set' }],
                },
            ],
        },
    },
    types: { global: '', modules: {} },
}

describe('findDocNode', () => {
    test('resolves a library by key', () => {
        expect(findDocNode(doc, '@mapmaker/store')?.moduleName).toBe('@mapmaker/store')
    })
    test('resolves a global by moduleName', () => {
        expect(findDocNode(doc, 'runtime')?.moduleName).toBe('runtime')
    })
    test('returns undefined for an unknown id', () => {
        expect(findDocNode(doc, '@mapmaker/nope')).toBeUndefined()
    })
})

describe('findMember', () => {
    test('finds a static method', () => {
        const node = findDocNode(doc, '@mapmaker/store')!
        const m = findMember(node, 'define_state')
        expect(m?.kind).toBe('method')
    })
    test('finds a static property', () => {
        const node = findDocNode(doc, 'runtime')!
        expect(findMember(node, 'version')?.kind).toBe('property')
    })
    test('finds an export type', () => {
        const node = findDocNode(doc, '@mapmaker/store')!
        const m = findMember(node, 'StateDefinition')
        expect(m?.kind).toBe('export')
    })
    test('finds a method on an export and carries its owner', () => {
        const node = findDocNode(doc, '@mapmaker/store')!
        const m = findMember(node, 'get')
        expect(m?.kind).toBe('method')
        expect(m && 'owner' in m ? m.owner?.name : undefined).toBe('StateDefinition')
    })
    test('returns undefined for an unknown symbol', () => {
        const node = findDocNode(doc, '@mapmaker/store')!
        expect(findMember(node, 'nope')).toBeUndefined()
    })
})
