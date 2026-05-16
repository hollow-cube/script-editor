import { beforeAll, describe, expect, test } from 'bun:test'

import { type EngineApiBundle } from '../engine-api'
import { applyEngineApiModules } from './docModules'
import { fileUriFromPath, pathFromFileUri, resolveUri, withSwappedExtension } from './uriResolver'

// `docModules` / `definitionFiles` are populated from the engine API bundle;
// seed a minimal fixture so the resolver has something to match against.
const fixture: EngineApiBundle = {
    doc: {
        schemaVersion: 1,
        kind: 'luau-engine-api',
        globals: [],
        libraries: {},
        types: { global: '', modules: {} },
    },
    docModules: [
        { alias: '@mapmaker/store', path: '/src/mapmaker/store.lua', content: 'return {}' },
    ],
    docModuleAliases: { '@mapmaker/': '/src/mapmaker/' },
    definitionFiles: [{ path: '/definitions/global.d.luau', alias: 'global.d.luau', content: '' }],
}

beforeAll(() => {
    applyEngineApiModules(fixture)
})

describe('pathFromFileUri', () => {
    test('strips file:// prefix and preserves leading slash', () => {
        expect(pathFromFileUri('file:///workspace/src/main.luau')).toBe('/workspace/src/main.luau')
    })

    test('adds leading slash when missing after file://', () => {
        expect(pathFromFileUri('file://workspace/src/main.luau')).toBe('/workspace/src/main.luau')
    })

    test('returns input unchanged when not a file URI', () => {
        expect(pathFromFileUri('/already/absolute.luau')).toBe('/already/absolute.luau')
        expect(pathFromFileUri('relative/path.luau')).toBe('relative/path.luau')
    })
})

describe('fileUriFromPath', () => {
    test('prepends file:// to an absolute path', () => {
        expect(fileUriFromPath('/workspace/src/main.luau')).toBe('file:///workspace/src/main.luau')
    })

    test('normalizes paths without a leading slash', () => {
        expect(fileUriFromPath('workspace/src/main.luau')).toBe('file:///workspace/src/main.luau')
    })

    test('round-trips with pathFromFileUri', () => {
        const path = '/workspace/foo/bar.luau'
        expect(pathFromFileUri(fileUriFromPath(path))).toBe(path)
    })
})

describe('withSwappedExtension', () => {
    test('swaps .luau to .lua', () => {
        expect(withSwappedExtension('/src/foo.luau')).toBe('/src/foo.lua')
    })

    test('swaps .lua to .luau', () => {
        expect(withSwappedExtension('/src/foo.lua')).toBe('/src/foo.luau')
    })

    test('returns null for other extensions', () => {
        expect(withSwappedExtension('/src/foo.json')).toBeNull()
        expect(withSwappedExtension('/src/foo')).toBeNull()
    })
})

describe('resolveUri', () => {
    test('resolves to project file when path matches known set (without leading slash)', () => {
        const result = resolveUri('file:///workspace/main.luau', ['workspace/main.luau'])
        expect(result).toEqual({ kind: 'file', path: 'workspace/main.luau' })
    })

    test('resolves via .luau ↔ .lua extension swap when LSP returns the other variant', () => {
        // luau-lsp will report require()d paths as `.lua` even when the on-disk
        // file is `.luau` — the resolver should still find it.
        const result = resolveUri('file:///workspace/lib.lua', ['workspace/lib.luau'])
        expect(result).toEqual({ kind: 'file', path: 'workspace/lib.luau' })
    })

    test('resolves to doc-module when path matches a known module', () => {
        // luau-lsp reports the require()d path as `.lua`; the resolver accepts
        // either extension and maps it back to the `.luau` doc module.
        const result = resolveUri('file:///src/mapmaker/store.lua', [])
        expect(result.kind).toBe('doc-module')
        if (result.kind === 'doc-module') {
            expect(result.module.alias).toBe('@mapmaker/store')
        }
    })

    test('resolves to definition-file when path matches a definition file', () => {
        const result = resolveUri('file:///definitions/global.d.luau', [])
        expect(result.kind).toBe('definition-file')
        if (result.kind === 'definition-file') {
            expect(result.file.alias).toBe('global.d.luau')
        }
    })

    test('returns unknown when no resolution path matches', () => {
        const result = resolveUri('file:///nowhere/file.luau', ['some/other.luau'])
        expect(result).toEqual({ kind: 'unknown' })
    })

    test('matches paths with leading slash too', () => {
        const result = resolveUri('file:///workspace/main.luau', ['/workspace/main.luau'])
        expect(result).toEqual({ kind: 'file', path: '/workspace/main.luau' })
    })
})
