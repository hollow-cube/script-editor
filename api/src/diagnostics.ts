// FN-1 — shared diagnostics sink.
//
// One funnel for "handled, but you'd want to know" signals that would
// otherwise vanish silently: caught render crashes (the project error
// boundary), dropped malformed SSE frames, etc. Today it just `console.warn`s
// — the indirection IS the point: a single seam so telemetry can be wired in
// later without touching every call site.
//
// Lives in `api` because it is the lowest workspace (no internal deps) so both
// `api` and `common` can share one funnel without inverting the dependency
// direction.

export type Diagnostic = {
    /** Stable, greppable area tag, e.g. `'project-events'`, `'project-boundary'`. */
    scope: string
    message: string
    /** The underlying error/cause, if any. */
    error?: unknown
    /** Small, primitive, cheap structured context. Avoid large/sensitive blobs. */
    context?: Record<string, unknown>
}

export type DiagnosticSink = (diagnostic: Diagnostic) => void

const consoleSink: DiagnosticSink = ({ scope, message, error, context }) => {
    const prefix = `[${scope}] ${message}`
    if (error !== undefined) console.warn(prefix, error, context ?? {})
    else console.warn(prefix, context ?? {})
}

let sink: DiagnosticSink = consoleSink

/** Replace the process-wide sink (e.g. wire telemetry at app start). Passing
 *  `null` restores the default console sink. */
export function setDiagnosticSink(next: DiagnosticSink | null): void {
    sink = next ?? consoleSink
}

/** Report a handled diagnostic. Never throws — a broken sink must not
 *  escalate into the very failure it is reporting. */
export function reportDiagnostic(diagnostic: Diagnostic): void {
    try {
        sink(diagnostic)
    } catch {
        // Swallow: diagnostics are best-effort by definition.
    }
}
