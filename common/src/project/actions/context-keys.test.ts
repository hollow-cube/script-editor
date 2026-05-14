import { beforeEach, describe, expect, test } from 'bun:test'

import { ContextKeys, contextMatches } from './context-keys'

describe('ContextKeys', () => {
    let keys: ContextKeys

    beforeEach(() => {
        keys = new ContextKeys()
    })

    test('starts with `global` set', () => {
        expect(keys.get('global')).toBe(true)
    })

    test('get returns false for unset keys', () => {
        expect(keys.get('editor:dirty')).toBe(false)
    })

    test('set + get round-trip', () => {
        keys.set('editor:dirty', true)
        expect(keys.get('editor:dirty')).toBe(true)
        keys.set('editor:dirty', false)
        expect(keys.get('editor:dirty')).toBe(false)
    })

    test('all() lists every truthy key including global', () => {
        keys.set('editor:dirty', true)
        keys.set('tool:files', true)
        expect(new Set(keys.all())).toEqual(new Set(['global', 'editor:dirty', 'tool:files']))
    })

    test('subscribe fires on real changes', () => {
        let fires = 0
        keys.subscribe(() => fires++)
        keys.set('editor:dirty', true)
        expect(fires).toBe(1)
    })

    test('subscribe is idempotent — setting to the same value is a no-op', () => {
        keys.set('editor:dirty', true)
        let fires = 0
        keys.subscribe(() => fires++)
        keys.set('editor:dirty', true) // same value
        keys.set('editor:dirty', true) // same value
        expect(fires).toBe(0)
    })

    test('unsubscribe stops further notifications', () => {
        let fires = 0
        const unsub = keys.subscribe(() => fires++)
        keys.set('a', true)
        unsub()
        keys.set('a', false)
        expect(fires).toBe(1)
    })

    test('replaceAll keeps global on and replaces other keys', () => {
        keys.set('tool:files', true)
        keys.set('editor:text', true)

        keys.replaceAll(['tool:lsp-log', 'editor:dirty'])

        expect(keys.get('tool:files')).toBe(false)
        expect(keys.get('editor:text')).toBe(false)
        expect(keys.get('tool:lsp-log')).toBe(true)
        expect(keys.get('editor:dirty')).toBe(true)
        expect(keys.get('global')).toBe(true) // global always survives
    })

    test('replaceAll fires the listener exactly once when changes happen', () => {
        keys.set('a', true)
        let fires = 0
        keys.subscribe(() => fires++)
        keys.replaceAll(['b', 'c'])
        expect(fires).toBe(1)
    })

    test('replaceAll is silent when the resulting set is identical', () => {
        keys.set('a', true)
        keys.set('b', true)
        let fires = 0
        keys.subscribe(() => fires++)
        keys.replaceAll(['a', 'b']) // already exactly that
        expect(fires).toBe(0)
    })
})

describe('contextMatches', () => {
    test('empty / undefined required matches everything', () => {
        const keys = new ContextKeys()
        expect(contextMatches(keys, undefined)).toBe(true)
        expect(contextMatches(keys, [])).toBe(true)
    })

    test('matches when every required key is set', () => {
        const keys = new ContextKeys()
        keys.set('editor:text', true)
        keys.set('editor:dirty', true)
        expect(contextMatches(keys, ['editor:text', 'editor:dirty'])).toBe(true)
    })

    test('rejects when any required key is missing', () => {
        const keys = new ContextKeys()
        keys.set('editor:text', true)
        expect(contextMatches(keys, ['editor:text', 'editor:dirty'])).toBe(false)
    })
})
