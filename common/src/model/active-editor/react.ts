import { useSignal } from '../foundation/react'
import { useProject } from '../foundation/react'
import type { ActiveEditorEntry } from './ActiveEditorRegistry'

export function useActiveEditorRegistry() {
    return useProject().activeEditor
}

export function useActiveDocId(): string | null {
    return useSignal(useProject().activeEditor.activeDocId)
}

export function useActiveEditorEntry(tabId: string | undefined): ActiveEditorEntry | undefined {
    const reg = useProject().activeEditor
    if (!tabId) return undefined
    return reg.get(tabId)
}
