import { StateEffect, StateField } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { ViewPlugin, keymap, showTooltip, type Tooltip } from '@codemirror/view'
import type { ParameterInformation, SignatureHelp } from 'vscode-languageserver-types'

import { type LspClient } from '../LspClient'
import { offsetToPosition } from './lspUtils'

type SigState = { help: SignatureHelp; pos: number } | null

const setSig = StateEffect.define<SigState>()

function paramRange(label: string | [number, number], full: string): [number, number] {
    if (typeof label === 'string') {
        const idx = full.indexOf(label)
        return idx >= 0 ? [idx, idx + label.length] : [0, 0]
    }
    return label
}

function buildDom(help: SignatureHelp): HTMLElement {
    const sig = help.signatures[help.activeSignature ?? 0]
    if (!sig) return document.createElement('div')
    const wrap = document.createElement('div')
    wrap.className = 'cm-sig-tooltip'

    const sigRow = document.createElement('div')
    sigRow.className = 'cm-sig-signature'
    const label = sig.label
    const params = sig.parameters ?? []
    const activeParam = sig.activeParameter ?? help.activeParameter ?? 0

    const activeParamInfo: ParameterInformation | undefined = params[activeParam]
    if (activeParamInfo) {
        const [start, end] = paramRange(activeParamInfo.label, label)
        const before = document.createTextNode(label.slice(0, start))
        const active = document.createElement('span')
        active.className = 'cm-sig-active-param'
        active.textContent = label.slice(start, end)
        const after = document.createTextNode(label.slice(end))
        sigRow.append(before, active, after)
    } else {
        sigRow.textContent = label
    }
    wrap.append(sigRow)

    if (activeParamInfo?.documentation) {
        const docs = document.createElement('div')
        docs.className = 'cm-sig-doc'
        docs.textContent =
            typeof activeParamInfo.documentation === 'string'
                ? activeParamInfo.documentation
                : activeParamInfo.documentation.value
        wrap.append(docs)
    } else if (sig.documentation) {
        const docs = document.createElement('div')
        docs.className = 'cm-sig-doc'
        docs.textContent =
            typeof sig.documentation === 'string' ? sig.documentation : sig.documentation.value
        wrap.append(docs)
    }
    return wrap
}

const sigField = StateField.define<SigState>({
    create: () => null,
    update(value, tr) {
        for (const e of tr.effects) if (e.is(setSig)) return e.value
        if (value && tr.docChanged) {
            return { help: value.help, pos: tr.changes.mapPos(value.pos) }
        }
        return value
    },
    provide: (f) =>
        showTooltip.from(f, (state): Tooltip | null => {
            if (!state) return null
            return {
                pos: state.pos,
                above: true,
                strictSide: false,
                arrow: false,
                create() {
                    const dom = buildDom(state.help)
                    return { dom }
                },
            }
        }),
})

export function lspSignatureHelp(client: LspClient, uri: string) {
    const caps = client.getCapabilities()?.signatureHelpProvider
    const triggers = caps?.triggerCharacters ?? ['(', ',']
    const retriggers = caps?.retriggerCharacters ?? []

    const fetchHelp = async (view: EditorView, pos: number) => {
        let result: SignatureHelp | null = null
        try {
            result = await client.sendRequest<SignatureHelp | null>('textDocument/signatureHelp', {
                textDocument: { uri },
                position: offsetToPosition(view.state.doc, pos),
            })
        } catch {
            return
        }
        if (!result || !result.signatures || result.signatures.length === 0) {
            view.dispatch({ effects: setSig.of(null) })
            return
        }
        view.dispatch({ effects: setSig.of({ help: result, pos }) })
    }

    const plugin = ViewPlugin.define((view) => ({
        update(update) {
            if (!update.docChanged) return
            let triggered = false
            let cancelled = false
            update.changes.iterChanges((_from, _to, _fromB, _toB, inserted) => {
                const text = inserted.toString()
                if (text.length === 0) return
                if (text.includes(')') || text.includes(';')) cancelled = true
                for (const c of triggers) if (text.includes(c)) triggered = true
                for (const c of retriggers) if (text.includes(c)) triggered = true
            })
            if (cancelled) {
                view.dispatch({ effects: setSig.of(null) })
                return
            }
            if (triggered) {
                void fetchHelp(view, update.state.selection.main.head)
            }
        },
    }))

    const dismissKey = keymap.of([
        {
            key: 'Escape',
            run(view) {
                if (!view.state.field(sigField, false)) return false
                view.dispatch({ effects: setSig.of(null) })
                return true
            },
        },
    ])

    return [sigField, plugin, dismissKey]
}
