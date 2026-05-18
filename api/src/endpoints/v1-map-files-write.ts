// Conditional-request options shared by the file write endpoints (PUT/DELETE).
//
// Per RFC 7232 the values are entity-tags: a quoted strong tag (`"<hex>"`,
// the file's content hash), a comma-separated list, a `W/`-prefixed weak tag,
// or the literal `*`. Callers pass the raw header value; this layer does not
// quote or interpret it. Omit a field for an unconditional write.
//
// On precondition failure the server returns 412; it surfaces as an
// `ApiError` with `status === 412` (the write endpoints do not list 412 in
// `allowedStatuses`, so the caller catches it like any other failure and can
// branch on the status).
export interface MapFilesWriteConditions {
    /** `If-Match` — write only if the current content matches. */
    ifMatch?: string
    /** `If-None-Match` — pass `'*'` for create-only (fail if it exists). */
    ifNoneMatch?: string
}

export function writeConditionHeaders(opts?: MapFilesWriteConditions): Record<string, string> {
    const headers: Record<string, string> = {}
    if (opts?.ifMatch !== undefined) headers['If-Match'] = opts.ifMatch
    if (opts?.ifNoneMatch !== undefined) headers['If-None-Match'] = opts.ifNoneMatch
    return headers
}
