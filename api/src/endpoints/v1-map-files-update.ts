import { useMutation, type UseMutationOptions } from '@tanstack/react-query'

import type { HCClient } from '../client'
import { mapFilePath } from '../path'
import { useHCClient } from '../provider'
import { MapFileSchema, type MapFile } from './v1-map-editor-bootstrap'
import { writeConditionHeaders, type MapFilesWriteConditions } from './v1-map-files-write'

// ---- Endpoint ----
// Raw body, `Content-Type` stored verbatim (default `text/plain`). 1 MB max
// → 400. Returns the new file record; its `hash` is the new ETag (the PUT
// response does NOT carry an `ETag` header). `If-Match` / `If-None-Match: *`
// preconditions surface a failed match as a 412 `ApiError`.

export const v1MapFilesUpdate = (
    client: HCClient,
    mapId: string,
    path: string,
    body: BodyInit,
    contentType: string = 'text/plain',
    opts?: MapFilesWriteConditions,
): Promise<MapFile> =>
    client.request('PUT', mapFilePath(mapId, path), {
        body,
        headers: { 'Content-Type': contentType, ...writeConditionHeaders(opts) },
        response: MapFileSchema,
    })

// ---- Mutation key ----

export const v1MapFilesUpdateKey = (mapId?: string, path?: string) =>
    [
        'v1',
        'map',
        'files',
        'update',
        ...(mapId === undefined ? [] : [mapId]),
        ...(path === undefined ? [] : [path]),
    ] as const

// ---- Hook ----

export interface V1MapFilesUpdateVariables extends MapFilesWriteConditions {
    mapId: string
    path: string
    body: BodyInit
    contentType?: string
}

export type UseV1MapFilesUpdateOptions = { client?: HCClient } & Partial<
    Omit<
        UseMutationOptions<MapFile, Error, V1MapFilesUpdateVariables>,
        'mutationKey' | 'mutationFn'
    >
>

export const useV1MapFilesUpdate = (opts?: UseV1MapFilesUpdateOptions) => {
    const client = useHCClient(opts?.client)
    const { client: _client, ...rest } = opts ?? {}
    return useMutation<MapFile, Error, V1MapFilesUpdateVariables>({
        mutationKey: v1MapFilesUpdateKey(),
        mutationFn: ({ mapId, path, body, contentType, ifMatch, ifNoneMatch }) =>
            v1MapFilesUpdate(client, mapId, path, body, contentType, { ifMatch, ifNoneMatch }),
        ...rest,
    })
}
