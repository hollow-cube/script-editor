import { describe, expect, test } from 'bun:test'

import { engineApiDocSchema } from './schema'

// Parses the real bundle the app ships (the committed copy under web/public).
const BUNDLE_PATH = `${import.meta.dir}/../../../web/public/engine-api.editor.json`

describe('engineApiDocSchema', () => {
    test('parses the shipped engine-api.editor.json', async () => {
        const json = await Bun.file(BUNDLE_PATH).json()
        const parsed = engineApiDocSchema.safeParse(json)
        if (!parsed.success) throw new Error(parsed.error.message)
        expect(parsed.data.kind).toBe('luau-engine-api')
        expect(parsed.data.globals.length).toBeGreaterThan(0)
        expect(Object.keys(parsed.data.libraries).length).toBeGreaterThan(0)
        expect(typeof parsed.data.types.global).toBe('string')
        expect(Object.keys(parsed.data.types.modules).length).toBeGreaterThan(0)
    })

    test('tolerates unknown TypeSpec kinds (permissive type grammar)', () => {
        const doc = {
            schemaVersion: 1,
            kind: 'luau-engine-api',
            globals: [
                {
                    moduleName: 'X',
                    staticMethods: [
                        {
                            name: 'f',
                            params: [
                                {
                                    name: 'a',
                                    optional: false,
                                    type: { kind: 'some-future-kind', whatever: [1, 2] },
                                },
                            ],
                            returns: [{ type: { kind: 'named', name: 'number' } }],
                        },
                    ],
                },
            ],
            libraries: {},
            types: { global: '', modules: {} },
        }
        expect(engineApiDocSchema.safeParse(doc).success).toBe(true)
    })

    test('rejects a wrong top-level kind', () => {
        const bad = {
            schemaVersion: 1,
            kind: 'nope',
            globals: [],
            libraries: {},
            types: { global: '', modules: {} },
        }
        expect(engineApiDocSchema.safeParse(bad).success).toBe(false)
    })
})
