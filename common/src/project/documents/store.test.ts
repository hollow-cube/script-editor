import { beforeEach, describe, expect, test } from 'bun:test'

import { createDocumentStore, selectDirtyDocuments, type DocumentStore } from './store'

describe('documentStore', () => {
    let store: DocumentStore

    beforeEach(() => {
        store = createDocumentStore()
    })

    describe('openDocument', () => {
        test('creates a document on first open with initial content', () => {
            store.getState().openDocument('a', 'hello')
            const doc = store.getState().documents.a
            expect(doc).toBeDefined()
            expect(doc!.original).toBe('hello')
            expect(doc!.current).toBe('hello')
            expect(doc!.dirty).toBe(false)
            expect(doc!.refCount).toBe(1)
        })

        test('is idempotent — re-opening bumps refCount and ignores new initialContent', () => {
            store.getState().openDocument('a', 'first')
            store.getState().setContent('a', 'edited')
            store.getState().openDocument('a', 'second-open-content')

            const doc = store.getState().documents.a!
            expect(doc.refCount).toBe(2)
            expect(doc.current).toBe('edited') // initialContent ignored on reopen
            expect(doc.original).toBe('first') // original preserved
        })
    })

    describe('setContent', () => {
        test('marks dirty when content diverges from original', () => {
            store.getState().openDocument('a', 'hello')
            store.getState().setContent('a', 'hello world')
            const doc = store.getState().documents.a!
            expect(doc.current).toBe('hello world')
            expect(doc.dirty).toBe(true)
        })

        test('clears dirty when content returns to original', () => {
            store.getState().openDocument('a', 'hello')
            store.getState().setContent('a', 'edited')
            store.getState().setContent('a', 'hello')
            expect(store.getState().documents.a!.dirty).toBe(false)
        })

        test('is a no-op on unknown documents', () => {
            store.getState().setContent('missing', 'x')
            expect(store.getState().documents.missing).toBeUndefined()
        })
    })

    describe('commit', () => {
        test('promotes current to original and clears dirty', () => {
            store.getState().openDocument('a', 'hello')
            store.getState().setContent('a', 'edited')
            store.getState().commit('a')
            const doc = store.getState().documents.a!
            expect(doc.original).toBe('edited')
            expect(doc.current).toBe('edited')
            expect(doc.dirty).toBe(false)
        })

        test('is a no-op on unknown documents', () => {
            store.getState().commit('missing')
            expect(store.getState().documents.missing).toBeUndefined()
        })
    })

    describe('discard', () => {
        test('reverts current to original and clears dirty', () => {
            store.getState().openDocument('a', 'hello')
            store.getState().setContent('a', 'edited')
            store.getState().discard('a')
            const doc = store.getState().documents.a!
            expect(doc.current).toBe('hello')
            expect(doc.dirty).toBe(false)
        })
    })

    describe('closeDocument', () => {
        test('decrements refCount but keeps the document while count > 0', () => {
            store.getState().openDocument('a', 'hello')
            store.getState().openDocument('a', 'ignored')
            store.getState().closeDocument('a')

            const doc = store.getState().documents.a!
            expect(doc).toBeDefined()
            expect(doc.refCount).toBe(1)
        })

        test('removes the document when refCount drops to zero', () => {
            store.getState().openDocument('a', 'hello')
            store.getState().closeDocument('a')
            expect(store.getState().documents.a).toBeUndefined()
        })

        test('force removes regardless of refCount', () => {
            store.getState().openDocument('a', 'hello')
            store.getState().openDocument('a', 'hello')
            store.getState().closeDocument('a', { force: true })
            expect(store.getState().documents.a).toBeUndefined()
        })

        test('is a no-op on unknown documents', () => {
            store.getState().closeDocument('missing')
            expect(store.getState().documents.missing).toBeUndefined()
        })
    })

    describe('selectDirtyDocuments', () => {
        test('returns only documents whose dirty flag is set', () => {
            store.getState().openDocument('a', 'hello')
            store.getState().openDocument('b', 'world')
            store.getState().setContent('a', 'edited')

            const dirty = selectDirtyDocuments(store.getState())
            expect(dirty.map((d) => d.id)).toEqual(['a'])
        })

        test('returns empty when nothing is dirty', () => {
            store.getState().openDocument('a', 'hello')
            expect(selectDirtyDocuments(store.getState())).toEqual([])
        })
    })
})
