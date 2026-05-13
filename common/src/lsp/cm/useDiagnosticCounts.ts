import { useEffect, useState } from 'react'
import type { Diagnostic } from 'vscode-languageserver-types'

import { type LspClient } from '../LspClient'

export type DiagnosticCounts = {
    errors: number
    warnings: number
    infos: number
    hints: number
    total: number
}

const EMPTY: DiagnosticCounts = { errors: 0, warnings: 0, infos: 0, hints: 0, total: 0 }

function tally(diags: readonly Diagnostic[]): DiagnosticCounts {
    let errors = 0
    let warnings = 0
    let infos = 0
    let hints = 0
    for (const d of diags) {
        switch (d.severity ?? 1) {
            case 1:
                errors++
                break
            case 2:
                warnings++
                break
            case 3:
                infos++
                break
            case 4:
                hints++
                break
        }
    }
    return { errors, warnings, infos, hints, total: errors + warnings + infos + hints }
}

/** Subscribe to the LSP's diagnostic stream for `uri` and return the running
 *  counts by severity. Returns zeros when `client` or `uri` is missing. */
export function useDiagnosticCounts(
    client: LspClient | null | undefined,
    uri: string | null | undefined,
): DiagnosticCounts {
    const [counts, setCounts] = useState<DiagnosticCounts>(EMPTY)

    useEffect(() => {
        if (!client || !uri) {
            setCounts(EMPTY)
            return
        }
        setCounts(tally(client.getDiagnostics(uri)))
        return client.onDiagnostics((u, diags) => {
            if (u !== uri) return
            setCounts(tally(diags))
        })
    }, [client, uri])

    return counts
}
