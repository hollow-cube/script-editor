// `PendingFilesService` — local-only files awaiting first save.
//
// Two flavors:
//   • `path === null` — purely untitled (Cmd+N flow). No tree entry; the
//     editor will prompt the user for a path on first save.
//   • `path !== null` — created from the file tree's "New File" context
//     menu. A tree placeholder shows the chosen path; the editor opens
//     immediately, and the file is PUT to the server on first save.
//
// Replaces the Zustand store at `common/src/project/data/pending-files.tsx`.

import { computed, signal, type ReadonlySignal } from '../foundation/signal'

export type PendingFile = {
    tempId: string
    path: string | null
    /** Display title for untitled flavor (`'Untitled-1'`, …). Unused when
     *  `path` is set since the tree row + tab title come from `path`. */
    untitledTitle?: string
}

export class PendingFilesService {
    private readonly _byTempId = signal<ReadonlyMap<string, PendingFile>>(new Map())
    private _untitledCounter = 0

    /** Map of pending files, keyed by `tempId`. */
    readonly entries: ReadonlySignal<ReadonlyMap<string, PendingFile>> = this._byTempId

    /** Sorted list of pending entries. Sorted by `path` (empty paths first). */
    readonly list: ReadonlySignal<readonly PendingFile[]> = computed(() => {
        const entries = [...this._byTempId.value.values()]
        entries.sort((a, b) => (a.path ?? '').localeCompare(b.path ?? ''))
        return entries
    })

    addUntitled(): string {
        const tempId = makeTempId()
        const n = ++this._untitledCounter
        const entry: PendingFile = {
            tempId,
            path: null,
            untitledTitle: `Untitled-${n}`,
        }
        const next = new Map(this._byTempId.peek())
        next.set(tempId, entry)
        this._byTempId.value = next
        return tempId
    }

    addAtPath(path: string): string {
        const tempId = makeTempId()
        const next = new Map(this._byTempId.peek())
        next.set(tempId, { tempId, path })
        this._byTempId.value = next
        return tempId
    }

    assignPath(tempId: string, path: string): void {
        const cur = this._byTempId.peek()
        const existing = cur.get(tempId)
        if (!existing) return
        const next = new Map(cur)
        next.set(tempId, { ...existing, path })
        this._byTempId.value = next
    }

    remove(tempId: string): void {
        const cur = this._byTempId.peek()
        if (!cur.has(tempId)) return
        const next = new Map(cur)
        next.delete(tempId)
        this._byTempId.value = next
    }

    get(tempId: string): PendingFile | undefined {
        return this._byTempId.peek().get(tempId)
    }

    dispose(): void {
        this._byTempId.value = new Map()
    }
}

function makeTempId(): string {
    return `pending-${crypto.randomUUID()}`
}
