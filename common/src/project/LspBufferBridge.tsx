import { useEffect } from 'react'

import { fileUriFromPath, useLuauLsp } from '../lsp'
import { useDocumentStore } from './documents'
import { type Document } from './documents/store'

// Translates document lifecycle into LSP traffic for Luau buffers. Mounted
// once at project level inside DocumentStoreProvider + LuauLspProvider.
//
// Lifetime model: once the bridge has sent `textDocument/didOpen` for a
// URI, the LSP keeps tracking that file for the rest of the session. We
// deliberately do NOT mirror the document store's refcount-based eviction
// (which fires when the user closes a tab, switches to a different tab in
// dev with strict-mode double-effects, etc.). Forwarding those evictions
// to the LSP would clear its diagnostic cache for the URI and cause
// annotations to disappear when the user comes back to the file.
//
// `LspClient.openDocument` is idempotent (early-returns if the URI is
// already tracked), so a re-mount of this bridge or a re-open of the same
// document is safe.

function isLuauDocId(id: string): boolean {
    if (id.startsWith('unsaved:')) return false
    return id.endsWith('.luau') || id.endsWith('.lua')
}

export function LspBufferBridge() {
    const documentStore = useDocumentStore()
    const { client, status } = useLuauLsp()

    useEffect(() => {
        if (!client || status !== 'running') return

        const seenContent = new Map<string, string>() // docId -> last content sent

        const ensureOpen = (doc: Document) => {
            if (!isLuauDocId(doc.id)) return
            const uri = fileUriFromPath(doc.id)
            if (!seenContent.has(doc.id)) {
                seenContent.set(doc.id, doc.current)
                client.openDocument(uri, 'luau', doc.current)
                return
            }
            const prev = seenContent.get(doc.id)
            if (prev !== doc.current) {
                seenContent.set(doc.id, doc.current)
                client.didChange(uri, doc.current)
            }
        }

        // Catch-up: didOpen any Luau buffers that materialised before the
        // LSP came online.
        for (const doc of Object.values(documentStore.getState().documents)) {
            ensureOpen(doc)
        }

        const unsubscribe = documentStore.subscribe((state) => {
            for (const doc of Object.values(state.documents)) ensureOpen(doc)
        })

        return () => {
            // Do NOT didClose docs here. Tab switches and React-strict-mode
            // re-runs cause the document store to evict and re-add buffers;
            // closing them on the LSP side wipes diagnostics. The LSP
            // documents are released when the LuauLspProvider tears down
            // the worker via `client.stop()`.
            unsubscribe()
            seenContent.clear()
        }
    }, [client, status, documentStore])

    return null
}
