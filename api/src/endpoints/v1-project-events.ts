import { z } from 'zod'

import type { HCClient } from '../client'
import { projectEventsPath } from '../path'
import { parseSSEStream } from '../sse'

export const ProjectEventSchema = z.object({
    path: z.string(),
})
export type ProjectEvent = z.infer<typeof ProjectEventSchema>

export interface ProjectEventEnvelope {
    id: string
    path: string
}

export interface V1ProjectEventsOptions {
    lastEventId?: string
    signal?: AbortSignal
}

// ---- Endpoint ----
//
// Streams server-sent change events for a project. Each yielded value carries
// the event id (use as `lastEventId` to resume) and the changed file path.
// Caller should refetch the file; a subsequent 404 indicates deletion.

export async function* v1ProjectEvents(
    client: HCClient,
    projectId: string,
    opts?: V1ProjectEventsOptions,
): AsyncGenerator<ProjectEventEnvelope> {
    const headers: Record<string, string> = { Accept: 'text/event-stream' }
    if (opts?.lastEventId !== undefined) headers['Last-Event-ID'] = opts.lastEventId

    const response = await client.send('GET', projectEventsPath(projectId), {
        headers,
        signal: opts?.signal,
    })
    if (!response.body) {
        throw new Error('v1ProjectEvents: response has no body')
    }

    for await (const frame of parseSSEStream(response.body, opts?.signal)) {
        if (frame.id === undefined) continue
        let parsed: unknown
        try {
            parsed = JSON.parse(frame.data)
        } catch {
            continue
        }
        const result = ProjectEventSchema.safeParse(parsed)
        if (!result.success) continue
        yield { id: frame.id, path: result.data.path }
    }
}
