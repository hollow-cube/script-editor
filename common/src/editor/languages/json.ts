import { json } from '@codemirror/lang-json'

import { type LanguageDefinition } from './types'

export const jsonLanguage: LanguageDefinition = {
    id: 'json',
    mimeTypes: ['application/json'],
    extensions: ['.json'],
    cmExtension: () => json(),
    formatter: (text) => {
        try {
            const parsed = JSON.parse(text) as unknown
            return { ok: true, text: JSON.stringify(parsed, null, 4) }
        } catch (e) {
            return { ok: false, error: e instanceof Error ? e.message : 'invalid JSON' }
        }
    },
}
