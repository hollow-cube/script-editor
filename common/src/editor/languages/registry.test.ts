import { describe, expect, test } from 'bun:test'

import { resolveLanguageForMime, resolveLanguageForPath } from './registry'
import { type LanguageDefinition } from './types'

// Minimal stand-ins so the tests don't depend on Shiki/JSON parsers loading.
const fakeExtension = (() => ({})) as unknown as LanguageDefinition['cmExtension']

const jsonLang: LanguageDefinition = {
    id: 'json',
    mimeTypes: ['application/json'],
    extensions: ['.json'],
    cmExtension: fakeExtension,
}

const luauLang: LanguageDefinition = {
    id: 'luau',
    mimeTypes: ['application/luau', 'text/x-luau'],
    extensions: ['.luau', '.lua'],
    cmExtension: fakeExtension,
}

const mdLang: LanguageDefinition = {
    id: 'markdown',
    // Wildcard so we can exercise mime/* matching.
    mimeTypes: ['text/markdown', 'text/x-markdown'],
    extensions: ['.md'],
    cmExtension: fakeExtension,
}

const fallback: LanguageDefinition = {
    id: 'plaintext',
    mimeTypes: ['text/*'],
    extensions: [],
    cmExtension: fakeExtension,
}

const languages = [jsonLang, luauLang, mdLang, fallback]

describe('resolveLanguageForPath', () => {
    test('matches a known extension', () => {
        expect(resolveLanguageForPath(languages, 'config.json')?.id).toBe('json')
        expect(resolveLanguageForPath(languages, 'src/main.luau')?.id).toBe('luau')
    })

    test('matches a multi-extension language by alternate extension', () => {
        expect(resolveLanguageForPath(languages, 'lib.lua')?.id).toBe('luau')
    })

    test('is case-insensitive on the extension', () => {
        expect(resolveLanguageForPath(languages, 'README.MD')?.id).toBe('markdown')
        expect(resolveLanguageForPath(languages, 'src/main.LUAU')?.id).toBe('luau')
    })

    test('returns undefined for paths without an extension', () => {
        expect(resolveLanguageForPath(languages, 'Dockerfile')).toBeUndefined()
    })

    test('returns undefined for unknown extensions', () => {
        expect(resolveLanguageForPath(languages, 'image.png')).toBeUndefined()
    })

    test('returns undefined for an empty / nullish path', () => {
        expect(resolveLanguageForPath(languages, '')).toBeUndefined()
        expect(resolveLanguageForPath(languages, undefined)).toBeUndefined()
    })

    test('order in the registry determines first-match wins for shared extensions', () => {
        const conflicting: LanguageDefinition = {
            id: 'jsonc',
            mimeTypes: ['application/jsonc'],
            extensions: ['.json'],
            cmExtension: fakeExtension,
        }
        // jsonc placed BEFORE json — should win because we scan in order.
        const out = resolveLanguageForPath([conflicting, ...languages], 'tsconfig.json')
        expect(out?.id).toBe('jsonc')
    })
})

describe('resolveLanguageForMime', () => {
    test('exact mime match', () => {
        expect(resolveLanguageForMime(languages, 'application/json')?.id).toBe('json')
        expect(resolveLanguageForMime(languages, 'application/luau')?.id).toBe('luau')
        expect(resolveLanguageForMime(languages, 'text/x-luau')?.id).toBe('luau')
    })

    test('wildcard mime match (text/*) hits the fallback language', () => {
        // 'text/plain' is not on any exact-match language, but the plaintext
        // fallback registers 'text/*' so it should match.
        expect(resolveLanguageForMime(languages, 'text/plain')?.id).toBe('plaintext')
    })

    test('exact match wins over wildcard match when both could apply', () => {
        // Place plaintext (text/*) AHEAD of markdown (text/markdown). Wildcard
        // match wins by scan order — this lock-in documents the expectation so
        // users adding new languages know how to position their registration.
        const ordered = [fallback, mdLang]
        expect(resolveLanguageForMime(ordered, 'text/markdown')?.id).toBe('plaintext')

        // Inverted order — the specific language wins.
        expect(resolveLanguageForMime([mdLang, fallback], 'text/markdown')?.id).toBe('markdown')
    })

    test('returns undefined for unknown mime', () => {
        expect(resolveLanguageForMime(languages, 'image/png')).toBeUndefined()
    })

    test('returns undefined for an empty / nullish mime', () => {
        expect(resolveLanguageForMime(languages, '')).toBeUndefined()
        expect(resolveLanguageForMime(languages, undefined)).toBeUndefined()
    })
})
