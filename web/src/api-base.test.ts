import { expect, test } from 'bun:test'

import { resolveApiBaseUrl } from './api-base'

const LOCAL = 'http://localhost:10000'
const PROD = 'https://api.hollowcube.net'

test('local hosts resolve to the localhost API', () => {
    expect(resolveApiBaseUrl('localhost')).toBe(LOCAL)
    expect(resolveApiBaseUrl('127.0.0.1')).toBe(LOCAL)
    expect(resolveApiBaseUrl('local.hollowcube.dev')).toBe(LOCAL)
})

test('production host resolves to the production API', () => {
    expect(resolveApiBaseUrl('hollowcube.net')).toBe(PROD)
})

test('PR preview hosts resolve to the production API', () => {
    expect(resolveApiBaseUrl('script-editor-1.preview.hollowcube.dev')).toBe(PROD)
    expect(resolveApiBaseUrl('script-editor-12345.preview.hollowcube.dev')).toBe(PROD)
})

test('unrecognized / malformed hosts throw (no silent fallback)', () => {
    for (const host of [
        'script-editor-.preview.hollowcube.dev',
        'script-editor-abc.preview.hollowcube.dev',
        'script-editor-1.hollowcube.dev',
        'script-editor-1.preview.hollowcube.dev.evil.com',
        'x.script-editor-1.preview.hollowcube.dev',
        'preview-1.hollowcube.dev',
        'preview.hollowcube.dev',
        'evil.com',
        'hollowcube.dev',
        'notlocalhost',
        '',
    ]) {
        expect(() => resolveApiBaseUrl(host)).toThrow()
    }
})

test('resolution is deterministic (AuthProvider useMemo stability)', () => {
    expect(resolveApiBaseUrl('script-editor-7.preview.hollowcube.dev')).toBe(
        resolveApiBaseUrl('script-editor-7.preview.hollowcube.dev'),
    )
})
