import { z } from 'zod'

import type { HCClient } from '../client'
import { reportDiagnostic } from '../diagnostics'
import { mapEditorEventsPath } from '../path'
import { parseSSEStream } from '../sse'

export const MapEventSchema = z.object({
    path: z.string(),
})
export type MapEvent = z.infer<typeof MapEventSchema>

export interface MapEventEnvelope {
    id: string
    path: string
}

export interface V1MapEditorEventsOptions {
    lastEventId?: string
    signal?: AbortSignal
}

// ---- Endpoint ----
//
// Streams server-sent change events for a map's editor. Each yielded value
// carries the event id (use as `lastEventId` to resume — the server resumes
// at seq+1 via the standard `Last-Event-ID` header) and the changed file
// path. Caller should refetch the file; a subsequent 404 indicates deletion.

export async function* v1MapEditorEvents(
    client: HCClient,
    mapId: string,
    opts?: V1MapEditorEventsOptions,
): AsyncGenerator<MapEventEnvelope> {
    const headers: Record<string, string> = { Accept: 'text/event-stream' }
    if (opts?.lastEventId !== undefined) headers['Last-Event-ID'] = opts.lastEventId

    // Long-lived stream: no client timeout (it would kill an idle-but-healthy
    // connection) and no client-level transient retry (`events.tsx` owns
    // reconnect/backoff — compounding the two would double the wait).
    const response = await client.send('GET', mapEditorEventsPath(mapId), {
        headers,
        signal: opts?.signal,
        timeoutMs: null,
        retry: false,
    })
    if (!response.body) {
        throw new Error('v1MapEditorEvents: response has no body')
    }

    for await (const frame of parseSSEStream(response.body, opts?.signal)) {
        if (frame.id === undefined) continue
        let parsed: unknown
        try {
            parsed = JSON.parse(frame.data)
        } catch (error) {
            // A malformed frame would otherwise vanish silently; if the
            // backend event schema drifts the editor just stops refreshing
            // with zero diagnostic. One greppable line turns that into a clue.
            reportDiagnostic({
                scope: 'map-editor-events',
                message: 'dropped event frame: invalid JSON',
                error,
                context: { mapId, eventId: frame.id, sample: frame.data.slice(0, 120) },
            })
            continue
        }
        const result = MapEventSchema.safeParse(parsed)
        if (!result.success) {
            reportDiagnostic({
                scope: 'map-editor-events',
                message: 'dropped event frame: schema mismatch',
                error: result.error,
                context: { mapId, eventId: frame.id, sample: frame.data.slice(0, 120) },
            })
            continue
        }
        yield { id: frame.id, path: result.data.path }
    }
}
