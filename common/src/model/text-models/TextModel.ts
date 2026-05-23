// `TextModel` — per-document state: content, original (last-saved
// snapshot), dirty (computed), path, orphaned, tempId. The factory
// returns a `TextModelInternal` that includes the writable operations
// `TextModelService` needs (`commit`, `setPath`, `setOriginal`,
// `markOrphaned`). Consumers receive `TextModel` (the read-only view)
// via the service's `get`/`getOrOpen`.

import { computed, signal, type ReadonlySignal, type Signal } from '../foundation/signal'

export type DocumentId = string

export interface TextModel {
    readonly id: DocumentId
    readonly tempId: string | null
    readonly path: ReadonlySignal<string | null>
    readonly content: ReadonlySignal<string>
    readonly original: ReadonlySignal<string>
    readonly dirty: ReadonlySignal<boolean>
    readonly orphaned: ReadonlySignal<boolean>
    setContent(content: string): void
    discard(): void
}

export interface TextModelInternal extends TextModel {
    commit(savedSnapshot: string): void
    setPath(path: string): void
    setOriginal(value: string): void
    markOrphaned(): void
    /** Mutate the id (used when promoting an untitled doc to its path). */
    rekey(newId: DocumentId): void
}

export interface CreateTextModelArgs {
    id: DocumentId
    tempId: string | null
    path: string | null
    initialContent: string
}

export function createTextModel(args: CreateTextModelArgs): TextModelInternal {
    let mutableId = args.id
    let mutableTempId = args.tempId
    const _path: Signal<string | null> = signal(args.path)
    const _content: Signal<string> = signal(args.initialContent)
    const _original: Signal<string> = signal(args.initialContent)
    const _orphaned: Signal<boolean> = signal(false)
    const _dirty: ReadonlySignal<boolean> = computed(() => _content.value !== _original.value)

    return {
        get id() {
            return mutableId
        },
        get tempId() {
            return mutableTempId
        },
        path: _path,
        content: _content,
        original: _original,
        dirty: _dirty,
        orphaned: _orphaned,

        setContent(content) {
            if (_content.peek() === content) return
            _content.value = content
        },
        discard() {
            const o = _original.peek()
            if (_content.peek() !== o) _content.value = o
        },
        commit(savedSnapshot) {
            _original.value = savedSnapshot
        },
        setPath(path) {
            _path.value = path
        },
        setOriginal(value) {
            _original.value = value
        },
        markOrphaned() {
            _orphaned.value = true
        },
        rekey(newId) {
            mutableId = newId
            mutableTempId = null
        },
    }
}
