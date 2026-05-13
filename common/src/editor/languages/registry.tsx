import { createContext, useContext, useMemo, type ReactNode } from 'react'

import { jsonLanguage } from './json'
import { luauLanguage } from './luau'
import { type LanguageDefinition } from './types'

// Single LanguageProvider mounted by the host (ProjectWorkspace). Editors
// resolve languages from mime types and pass them to <CodeEditor>.

type LanguageRegistryValue = {
    languages: readonly LanguageDefinition[]
}

const LanguageContext = createContext<LanguageRegistryValue | null>(null)

const DEFAULT_LANGUAGES: readonly LanguageDefinition[] = [jsonLanguage, luauLanguage]

export function LanguageProvider({
    languages = DEFAULT_LANGUAGES,
    children,
}: {
    languages?: readonly LanguageDefinition[]
    children: ReactNode
}) {
    const value = useMemo<LanguageRegistryValue>(() => ({ languages }), [languages])
    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

function useLanguageRegistry(): LanguageRegistryValue {
    const ctx = useContext(LanguageContext)
    if (!ctx) {
        throw new Error('useLanguageRegistry must be used inside <LanguageProvider>')
    }
    return ctx
}

export function useLanguages(): readonly LanguageDefinition[] {
    return useLanguageRegistry().languages
}

export function useLanguageById(id: string | undefined): LanguageDefinition | undefined {
    const { languages } = useLanguageRegistry()
    if (!id) return undefined
    return languages.find((l) => l.id === id)
}

export function useLanguageForMime(mimeType: string | undefined): LanguageDefinition | undefined {
    const { languages } = useLanguageRegistry()
    if (!mimeType) return undefined
    return languages.find((l) => l.mimeTypes.some((p) => matchesMime(p, mimeType)))
}

function matchesMime(pattern: string, mime: string): boolean {
    if (pattern === mime) return true
    if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -1)
        return mime.startsWith(prefix)
    }
    return false
}

/** Inspect every registered language's mime types — used by host code that
 *  needs to decide whether a file is openable as text without a React hook. */
export function listAllLanguageMimes(languages: readonly LanguageDefinition[]): string[] {
    const out: string[] = []
    for (const l of languages) for (const m of l.mimeTypes) out.push(m)
    return out
}
