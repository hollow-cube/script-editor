import { z } from 'zod'

export const ApiErrorSchema = z.object({
    error: z.string(),
})
export type ApiErrorBody = z.infer<typeof ApiErrorSchema>

export interface ApiErrorContext {
    method?: string
    url?: string
    cause?: unknown
}

export class ApiError extends Error {
    readonly status: number
    readonly method?: string
    readonly url?: string
    /** Set when the failure was a client-side request timeout (status 0). Lets
     *  callers distinguish "we gave up waiting" from "the network failed". */
    readonly timedOut: boolean
    /** Parsed `Retry-After` (ms) from a 429/503 response, when present. The
     *  retry layer prefers this over its computed backoff. */
    readonly retryAfterMs?: number

    constructor(
        status: number,
        message: string,
        context?: ApiErrorContext & { timedOut?: boolean; retryAfterMs?: number },
    ) {
        super(message, context?.cause === undefined ? undefined : { cause: context.cause })
        this.name = 'ApiError'
        this.status = status
        this.method = context?.method
        this.url = context?.url
        this.timedOut = context?.timedOut ?? false
        this.retryAfterMs = context?.retryAfterMs
    }

    static async fromResponse(response: Response, context?: ApiErrorContext): Promise<ApiError> {
        let message = response.statusText || `HTTP ${response.status}`
        try {
            const text = await response.text()
            if (text) {
                const parsed = ApiErrorSchema.safeParse(JSON.parse(text))
                if (parsed.success) message = parsed.data.error
            }
        } catch {
            // fall through; keep statusText
        }
        return new ApiError(response.status, message, {
            ...context,
            retryAfterMs: parseRetryAfter(response.headers.get('Retry-After')),
        })
    }

    // A request that exceeded the client-side deadline. Status 0 (no HTTP
    // response was received) — same as a network failure for retry purposes,
    // but flagged so the UI can say "timed out" rather than "unreachable".
    static timeout(method: string, url: string, ms: number, cause: unknown): ApiError {
        return new ApiError(0, `Request timed out after ${ms}ms`, {
            method,
            url,
            cause,
            timedOut: true,
        })
    }

    // Wrap a fetch-thrown network error so callers see what URL was attempted.
    // The browser only tells JS the request failed — "Failed to fetch" in
    // Chromium/Firefox, "Load failed" in Safari/WebKit — without saying *why*.
    // Detect by type: fetch throws TypeError for any network-level failure
    // (host unreachable, DNS, TLS, blocked by CORS, mixed content). The actual
    // reason is in the browser's devtools network tab.
    static network(method: string, url: string, cause: unknown): ApiError {
        const original = cause instanceof Error ? cause.message : String(cause)
        const hint =
            cause instanceof TypeError
                ? ' (server unreachable, blocked by CORS, or mixed content — check the browser network tab for the actual reason)'
                : ''
        return new ApiError(0, `${original}${hint}`, { method, url, cause })
    }
}

// `Retry-After` is either delta-seconds (a non-negative integer) or an
// HTTP-date. Returns the delay in ms, or undefined if absent/unparseable.
function parseRetryAfter(header: string | null): number | undefined {
    if (!header) return undefined
    const secs = Number(header)
    if (Number.isFinite(secs)) return secs >= 0 ? secs * 1000 : undefined
    const date = Date.parse(header)
    if (Number.isNaN(date)) return undefined
    return Math.max(0, date - Date.now())
}
