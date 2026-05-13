import { EditorView } from '@codemirror/view'

import { stringTokenAt } from './tokens'

export type EditorContextMenuDetail = {
    clientX: number
    clientY: number
    pos: number // doc offset under cursor
    token: string | null // string-literal text under cursor (without quotes), if any
    tokenFrom: number | null
    tokenTo: number | null
}

export const EDITOR_CONTEXT_MENU_EVENT = 'hc-editor-contextmenu' as const

export const editorContextMenuExtension = EditorView.domEventHandlers({
    contextmenu(event, view) {
        event.preventDefault()
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
        const string = pos === null ? null : stringTokenAt(view, pos)
        const detail: EditorContextMenuDetail = {
            clientX: event.clientX,
            clientY: event.clientY,
            pos: pos ?? 0,
            token: string ? string.token : null,
            tokenFrom: string ? string.from : null,
            tokenTo: string ? string.to : null,
        }
        view.dom.dispatchEvent(
            new CustomEvent(EDITOR_CONTEXT_MENU_EVENT, { detail, bubbles: true }),
        )
        return true
    },
})
