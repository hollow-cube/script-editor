import { queryOptions, useQuery, type UseQueryOptions } from '@tanstack/react-query'

import type { HCClient } from '../client'
import { mapFilePath } from '../path'
import { useHCClient } from '../provider'

export interface MapFileBytes {
    bytes: Uint8Array
    contentType: string
    /** Strong ETag from the response (`"<hex sha256>"`, quoted). Pass it back
     *  as `ifNoneMatch` on a later GET, or as `ifMatch` on a write, for
     *  conditional requests. Absent if the server omitted the header. */
    etag?: string
    /** True when an `ifNoneMatch` GET returned `304 Not Modified` — the
     *  cached copy is still current and `bytes` is empty. */
    notModified?: boolean
}

export interface MapFilesGetConditions {
    /** `If-None-Match` — a previously seen ETag. A match yields a 304 and
     *  `notModified: true` (empty body) instead of re-transferring bytes. */
    ifNoneMatch?: string
    signal?: AbortSignal
}

// ---- Endpoint ----
// Raw file bytes. Sets `ETag: "<hex sha256>"`; honor it with `ifNoneMatch`
// for caching (304 → notModified, no body).

export const v1MapFilesGet = async (
    client: HCClient,
    mapId: string,
    path: string,
    opts?: MapFilesGetConditions,
): Promise<MapFileBytes> => {
    const headers: Record<string, string> = {}
    if (opts?.ifNoneMatch !== undefined) headers['If-None-Match'] = opts.ifNoneMatch

    const response = await client.send('GET', mapFilePath(mapId, path), {
        headers,
        signal: opts?.signal,
        // 304 is control flow on a conditional GET, not an error.
        allowedStatuses: opts?.ifNoneMatch === undefined ? undefined : [304],
    })

    const etag = response.headers.get('etag') ?? undefined
    if (response.status === 304) {
        return { bytes: new Uint8Array(0), contentType: '', etag, notModified: true }
    }
    const buffer = await response.arrayBuffer()
    return {
        bytes: new Uint8Array(buffer),
        contentType: response.headers.get('content-type') ?? 'application/octet-stream',
        etag,
    }
}

// ---- Query key ----

export const v1MapFilesGetKey = (mapId?: string, path?: string) =>
    [
        'v1',
        'map',
        'files',
        'get',
        ...(mapId === undefined ? [] : [mapId]),
        ...(path === undefined ? [] : [path]),
    ] as const

// ---- Query options ----

export const v1MapFilesGetOptions = (client: HCClient, mapId: string, path: string) =>
    queryOptions({
        queryKey: v1MapFilesGetKey(mapId, path),
        queryFn: () => v1MapFilesGet(client, mapId, path),
    })

// ---- Hook ----

export type UseV1MapFilesGetOptions = { client?: HCClient } & Partial<
    Omit<
        UseQueryOptions<MapFileBytes, Error, MapFileBytes, ReturnType<typeof v1MapFilesGetKey>>,
        'queryKey' | 'queryFn'
    >
>

export const useV1MapFilesGet = (mapId: string, path: string, opts?: UseV1MapFilesGetOptions) => {
    const client = useHCClient(opts?.client)
    const { client: _client, ...rest } = opts ?? {}
    return useQuery({ ...v1MapFilesGetOptions(client, mapId, path), ...rest })
}
