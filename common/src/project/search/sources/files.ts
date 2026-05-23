import { useMemo } from 'react'

import { useFileTreeService } from '../../../model/files'
import { useSignal } from '../../../model/foundation/react'
import { fuzzyScore } from '../fuzzy'
import { type SearchResult } from '../types'

/** Fuzzy-match the project's file paths against `query`. */
export function useFileResults(query: string, limit = 50): SearchResult[] {
    const fileTree = useFileTreeService()
    const files = useSignal(fileTree.list)
    return useMemo(() => {
        const results: SearchResult[] = []
        for (const file of files) {
            const match = fuzzyScore(query, file.path)
            if (!match) continue
            const lastSlash = file.path.lastIndexOf('/')
            const name = lastSlash === -1 ? file.path : file.path.slice(lastSlash + 1)
            const dir = lastSlash === -1 ? '' : file.path.slice(0, lastSlash)
            results.push({
                kind: 'file',
                id: `file:${file.path}`,
                title: name,
                subtitle: dir || undefined,
                matches: match.matches,
                score: match.score,
                data: file,
            })
        }
        results.sort((a, b) => b.score - a.score)
        return results.slice(0, limit)
    }, [files, query, limit])
}
