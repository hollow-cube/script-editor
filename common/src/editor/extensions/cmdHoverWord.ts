import { StateEffect, StateField, type Extension } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, type DecorationSet } from '@codemirror/view'

import { stringTokenAt } from './tokens'

// Module-level signal tracking whether Cmd (macOS) or Ctrl (other) is held.
// Updated by document-level listeners; subscribers (one per editor view) react
// by clearing or reasserting the underline when the modifier flips.
let modifierHeld = false
const subscribers = new Set<(held: boolean) => void>()

function setModifierHeld(next: boolean) {
    if (next === modifierHeld) return
    modifierHeld = next
    subscribers.forEach((fn) => fn(next))
}

let listenersInstalled = false
function installGlobalListeners() {
    if (listenersInstalled || typeof window === 'undefined') return
    listenersInstalled = true
    const isMac =
        typeof navigator !== 'undefined' && /Mac|iPhone|iPad/u.test(navigator.platform || '')
    const isModKey = (e: KeyboardEvent) => (isMac ? e.key === 'Meta' : e.key === 'Control')
    window.addEventListener('keydown', (e) => {
        if (isModKey(e) || (isMac ? e.metaKey : e.ctrlKey)) setModifierHeld(true)
    })
    window.addEventListener('keyup', (e) => {
        if (isModKey(e)) setModifierHeld(false)
    })
    window.addEventListener('blur', () => setModifierHeld(false))
}

// Event emitted on the editor's root DOM when the user cmd/ctrl-clicks a
// resolved string token. Listened to by `CodeEditor` to trigger find-usages.
export const EDITOR_CMD_LINK_EVENT = 'hc-editor-cmd-link' as const

export type EditorCmdLinkDetail = {
    token: string
    from: number
    to: number
    anchorPos: number
}

const setLinkRange = StateEffect.define<{ from: number; to: number } | null>()

const linkRangeField = StateField.define<{ from: number; to: number } | null>({
    create: () => null,
    update(value, tr) {
        for (const e of tr.effects) {
            if (e.is(setLinkRange)) return e.value
        }
        if (tr.docChanged) return null
        return value
    },
})

const linkMark = Decoration.mark({ class: 'cm-hcCmdLink' })

const decorationsField = StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(_value, tr) {
        const range = tr.state.field(linkRangeField, false) ?? null
        if (!range) return Decoration.none
        if (range.from >= range.to) return Decoration.none
        return Decoration.set([linkMark.range(range.from, range.to)])
    },
    provide: (f) => EditorView.decorations.from(f),
})

const cmdLinkTheme = EditorView.theme({
    '.cm-hcCmdLink': {
        textDecoration: 'underline',
        textDecorationColor: 'var(--primary)',
        textDecorationThickness: '1px',
        cursor: 'pointer',
    },
})

function computeLinkRange(view: EditorView, clientX: number, clientY: number) {
    const pos = view.posAtCoords({ x: clientX, y: clientY })
    if (pos === null) return null
    return stringTokenAt(view, pos)
}

// One per editor view: subscribes to the global modifier signal so we can
// clear the underline when Cmd is released without waiting for a mousemove.
const modifierSubscriberPlugin = ViewPlugin.define((view) => {
    const onChange = (held: boolean) => {
        if (!held && view.state.field(linkRangeField, false)) {
            view.dispatch({ effects: setLinkRange.of(null) })
        }
    }
    subscribers.add(onChange)
    return {
        destroy() {
            subscribers.delete(onChange)
        },
    }
})

export type CmdHoverWordOptions = {
    /** When true the cmd+click handler is skipped (no event dispatched, no
     *  preempt) — the hover-underline still renders so users get visual
     *  feedback that the modifier is recognized. Use this when a later
     *  extension (e.g. LSP go-to-def) owns the click action. */
    suppressClick?: boolean
}

export function cmdHoverWord(options: CmdHoverWordOptions = {}): Extension {
    installGlobalListeners()
    const suppressClick = !!options.suppressClick

    return [
        linkRangeField,
        decorationsField,
        cmdLinkTheme,
        modifierSubscriberPlugin,
        EditorView.domEventHandlers({
            mousemove(event, view) {
                const held = modifierHeld || event.metaKey || event.ctrlKey
                if (held && !modifierHeld) setModifierHeld(true)
                const next = held ? computeLinkRange(view, event.clientX, event.clientY) : null
                const current = view.state.field(linkRangeField, false) ?? null
                const same =
                    !!current && !!next && current.from === next.from && current.to === next.to
                if (same) return false
                if (!current && !next) return false
                view.dispatch({
                    effects: setLinkRange.of(next ? { from: next.from, to: next.to } : null),
                })
                return false
            },
            mouseleave(_event, view) {
                if (view.state.field(linkRangeField, false)) {
                    view.dispatch({ effects: setLinkRange.of(null) })
                }
                return false
            },
            mousedown(event, view) {
                if (suppressClick) return false
                const held = modifierHeld || event.metaKey || event.ctrlKey
                if (!held) return false
                if (event.button !== 0) return false
                const range = computeLinkRange(view, event.clientX, event.clientY)
                if (!range) return false
                event.preventDefault()
                const detail: EditorCmdLinkDetail = {
                    token: range.token,
                    from: range.from,
                    to: range.to,
                    anchorPos: range.from,
                }
                view.dom.dispatchEvent(
                    new CustomEvent(EDITOR_CMD_LINK_EVENT, { detail, bubbles: true }),
                )
                view.dispatch({ effects: setLinkRange.of(null) })
                return true
            },
        }),
    ]
}
