import { describe, expect, test } from 'bun:test'

import { PendingFilesService } from './PendingFilesService'

describe('PendingFilesService — addUntitled', () => {
    test('adds an untitled entry and returns its tempId', () => {
        const svc = new PendingFilesService()
        const tempId = svc.addUntitled()
        const entry = svc.get(tempId)
        expect(entry?.tempId).toBe(tempId)
        expect(entry?.path).toBeNull()
        expect(entry?.untitledTitle).toBe('Untitled-1')
    })

    test('untitled titles increment monotonically', () => {
        const svc = new PendingFilesService()
        const a = svc.addUntitled()
        const b = svc.addUntitled()
        expect(svc.get(a)?.untitledTitle).toBe('Untitled-1')
        expect(svc.get(b)?.untitledTitle).toBe('Untitled-2')
    })
})

describe('PendingFilesService — addAtPath', () => {
    test('adds an entry with the given path and no untitled title', () => {
        const svc = new PendingFilesService()
        const tempId = svc.addAtPath('src/foo.luau')
        const entry = svc.get(tempId)
        expect(entry?.path).toBe('src/foo.luau')
        expect(entry?.untitledTitle).toBeUndefined()
    })
})

describe('PendingFilesService — assignPath', () => {
    test('updates the path of an existing entry', () => {
        const svc = new PendingFilesService()
        const tempId = svc.addUntitled()
        svc.assignPath(tempId, 'new/path.luau')
        expect(svc.get(tempId)?.path).toBe('new/path.luau')
    })

    test('no-ops for unknown tempId', () => {
        const svc = new PendingFilesService()
        svc.assignPath('does-not-exist', 'x.luau')
        expect(svc.get('does-not-exist')).toBeUndefined()
    })
})

describe('PendingFilesService — remove', () => {
    test('removes by tempId', () => {
        const svc = new PendingFilesService()
        const tempId = svc.addUntitled()
        svc.remove(tempId)
        expect(svc.get(tempId)).toBeUndefined()
    })
})

describe('PendingFilesService — list signal', () => {
    test('reflects entries sorted by path', () => {
        const svc = new PendingFilesService()
        const a = svc.addAtPath('b.luau')
        const b = svc.addAtPath('a.luau')
        const list = svc.list.peek()
        expect(list.map((e) => e.path)).toEqual(['a.luau', 'b.luau'])
        // touch unused vars
        void a
        void b
    })
})

describe('PendingFilesService — disposal', () => {
    test('clears all entries', () => {
        const svc = new PendingFilesService()
        const tempId = svc.addUntitled()
        svc.dispose()
        expect(svc.get(tempId)).toBeUndefined()
        expect(svc.list.peek()).toEqual([])
    })
})
