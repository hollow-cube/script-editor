// `ActiveEditorRegistry` — the model-layer home for "which text editor is
// currently mounted, where, with what view-level handlers." Replaces the
// module-level `Map` in `common/src/editor/active-editor-registry.ts`.
//
// Two surfaces:
//
//   • The `Map<tabId, entry>` (CodeMirror view + save handler + LSP URI +
//     language) — looked up by `editor.save` / `editor.format` /
//     `editor.codeAction` etc.
//   • An `activeDocId: ReadonlySignal<string | null>` — the focused tab
//     id. Set imperatively by the React focus tracker (the workspace
//     primitive doesn't push it here yet; Phase 6 will). For now an
//     external caller is free to set it via `setActive(tabId)`.

import type { EditorView } from '@codemirror/view'

import type { LanguageDefinition } from '../../editor/languages/types'
import { signal, type ReadonlySignal } from '../foundation/signal'

export type ActiveEditorEntry = {
    view: EditorView
    language?: LanguageDefinition
    /** Optional save handler. Globally-bound actions (`editor.save`) call this
     *  to dispatch a save to the currently focused tab. Returns true on
     *  successful save, false (or throws) if the save was cancelled or
     *  errored. */
    save?: () => Promise<boolean>
    /** LSP URI for this tab when an LSP binding is active. */
    lspUri?: string
}

export class ActiveEditorRegistry {
    private readonly _registry = new Map<string, ActiveEditorEntry>()
    private readonly _activeDocId = signal<string | null>(null)

    /** The currently focused tab id, if known. Phase 6 wires this from the
     *  workspace's focus signal; for now consumers can `setActiveDocId`
     *  imperatively. */
    readonly activeDocId: ReadonlySignal<string | null> = this._activeDocId

    register(tabId: string, entry: ActiveEditorEntry): void {
        this._registry.set(tabId, entry)
    }

    unregister(tabId: string): void {
        this._registry.delete(tabId)
    }

    get(tabId: string): ActiveEditorEntry | undefined {
        return this._registry.get(tabId)
    }

    setActiveDocId(tabId: string | null): void {
        this._activeDocId.value = tabId
    }

    dispose(): void {
        this._registry.clear()
        this._activeDocId.value = null
    }
}
