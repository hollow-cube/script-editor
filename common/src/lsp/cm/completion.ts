import {
    autocompletion,
    snippet,
    type Completion,
    type CompletionContext,
    type CompletionResult,
} from '@codemirror/autocomplete'
import type { CompletionItem, CompletionList } from 'vscode-languageserver-types'

import { type LspClient } from '../LspClient'
import { offsetToPosition } from './lspUtils'

const KIND_LABELS: Record<number, string> = {
    1: 'text',
    2: 'method',
    3: 'function',
    4: 'class',
    5: 'property',
    6: 'variable',
    7: 'class',
    8: 'interface',
    9: 'namespace',
    10: 'property',
    11: 'constant',
    12: 'constant',
    13: 'enum',
    14: 'keyword',
    15: 'text',
    16: 'constant',
    17: 'text',
    18: 'text',
    19: 'text',
    20: 'enum',
    21: 'constant',
    22: 'class',
    23: 'event',
    24: 'function',
    25: 'type',
}

/** Convert LSP snippet syntax (`$1`, `${1:default}`) to CodeMirror's. */
function lspSnippetToCm(s: string): string {
    return s
        .replaceAll(/\\\$/g, ' ESC_DOLLAR ')
        .replaceAll(/\$\{(\d+):([^}]*)\}/g, (_, _i, def) => '#{' + def + '}')
        .replaceAll(/\$\{(\d+)\}/g, '#{}')
        .replaceAll(/\$(\d+)/g, '#{}')
        .replaceAll(/ ESC_DOLLAR /g, '$')
}

function buildCompletion(item: CompletionItem): Completion {
    const insertText = item.insertText ?? item.label
    const isSnippet = item.insertTextFormat === 2
    const detail = item.detail
    const docs =
        item.documentation === undefined
            ? undefined
            : typeof item.documentation === 'string'
              ? item.documentation
              : item.documentation.value
    return {
        label: item.label,
        type: KIND_LABELS[item.kind ?? 1] ?? 'text',
        detail,
        info: docs,
        apply: isSnippet ? snippet(lspSnippetToCm(insertText)) : insertText,
        boost: item.preselect ? 1 : 0,
    }
}

export function lspCompletion(client: LspClient, uri: string) {
    const triggerChars = new Set(
        (client.getCapabilities()?.completionProvider?.triggerCharacters ?? []).filter(
            (c) => c.length > 0 && !/\s/.test(c),
        ),
    )

    const source = async (ctx: CompletionContext): Promise<CompletionResult | null> => {
        const word = ctx.matchBefore(/[\w.:]*/)
        const lastChar = ctx.state.doc.sliceString(Math.max(0, ctx.pos - 1), ctx.pos)
        const isTrigger = triggerChars.has(lastChar)
        if (!ctx.explicit && !isTrigger && (!word || word.from === word.to)) return null

        let result: CompletionItem[] | CompletionList | null = null
        try {
            result = await client.sendRequest<CompletionItem[] | CompletionList | null>(
                'textDocument/completion',
                {
                    textDocument: { uri },
                    position: offsetToPosition(ctx.state.doc, ctx.pos),
                },
            )
        } catch {
            return null
        }
        if (!result) return null
        const items = Array.isArray(result) ? result : result.items
        const from = word ? word.from : ctx.pos
        return {
            from,
            options: items.map(buildCompletion),
            validFor: /^[\w.:]*$/,
        }
    }

    return autocompletion({
        override: [source],
        defaultKeymap: true,
        activateOnTyping: true,
    })
}
