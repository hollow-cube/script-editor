import { useCallback, useMemo } from 'react'

import { getActiveEditor } from '../../editor/active-editor-registry'
import { runFormatOnView } from '../../editor/formatters'
import { findLeaf } from '../../workspace'
import { type WorkspaceStoreHook } from '../../workspace/context'
import { useRegisterAction } from './registry'
import { type Action } from './types'

// Globally-registered actions that operate on the focused text editor.
//
//   • `editor.format`  — Mod+Alt+L. Also registered as a CodeMirror keymap
//                        entry inside CodeEditor for the common "editor is
//                        focused" case. Both paths route through
//                        `runFormatOnView` so the behaviour stays consistent.
//   • `editor.save`    — Mod+S. Looks up the focused tab's save handler from
//                        the active-editor registry and invokes it. Replaces
//                        the per-tab window-level keydown listener so the
//                        action is also visible to the search popup and the
//                        native macOS menu.

function focusedEntry(useStore: WorkspaceStoreHook) {
    const state = useStore.getState()
    const leafId = state.focusedLeafId
    if (!leafId) return null
    const leaf = findLeaf(state.center, leafId)
    if (!leaf || !leaf.activeId) return null
    return getActiveEditor(leaf.activeId) ?? null
}

export function EditorActions({ useStore }: { useStore: WorkspaceStoreHook }) {
    const runFormat = useCallback(() => {
        const entry = focusedEntry(useStore)
        if (!entry) return
        void runFormatOnView(entry.view, entry.language)
    }, [useStore])

    const runSave = useCallback(() => {
        const entry = focusedEntry(useStore)
        if (!entry?.save) return
        void entry.save()
    }, [useStore])

    const formatAction = useMemo<Action>(
        () => ({
            id: 'editor.format',
            title: 'Format document',
            group: 'edit',
            keybinding: '$mod+alt+l',
            contexts: ['editor:text'],
            run: runFormat,
        }),
        [runFormat],
    )

    const saveAction = useMemo<Action>(
        () => ({
            id: 'editor.save',
            title: 'Save',
            group: 'edit',
            keybinding: '$mod+s',
            contexts: ['editor:text'],
            run: runSave,
        }),
        [runSave],
    )

    useRegisterAction(formatAction)
    useRegisterAction(saveAction)
    return null
}
