import { useMutation, type UseMutationOptions } from '@tanstack/react-query'

import type { HCClient } from '../client'
import { mapFilePath } from '../path'
import { useHCClient } from '../provider'
import { writeConditionHeaders, type MapFilesWriteConditions } from './v1-map-files-write'

// ---- Endpoint ----
// 204 on success, 404 if absent. `If-Match` / `If-None-Match` preconditions
// surface a failed match as a 412 `ApiError`.

export const v1MapFilesDelete = async (
    client: HCClient,
    mapId: string,
    path: string,
    opts?: MapFilesWriteConditions,
): Promise<void> => {
    await client.send('DELETE', mapFilePath(mapId, path), {
        headers: writeConditionHeaders(opts),
    })
}

// ---- Mutation key ----

export const v1MapFilesDeleteKey = (mapId?: string, path?: string) =>
    [
        'v1',
        'map',
        'files',
        'delete',
        ...(mapId === undefined ? [] : [mapId]),
        ...(path === undefined ? [] : [path]),
    ] as const

// ---- Hook ----

export interface V1MapFilesDeleteVariables extends MapFilesWriteConditions {
    mapId: string
    path: string
}

export type UseV1MapFilesDeleteOptions = { client?: HCClient } & Partial<
    Omit<UseMutationOptions<void, Error, V1MapFilesDeleteVariables>, 'mutationKey' | 'mutationFn'>
>

export const useV1MapFilesDelete = (opts?: UseV1MapFilesDeleteOptions) => {
    const client = useHCClient(opts?.client)
    const { client: _client, ...rest } = opts ?? {}
    return useMutation<void, Error, V1MapFilesDeleteVariables>({
        mutationKey: v1MapFilesDeleteKey(),
        mutationFn: ({ mapId, path, ifMatch, ifNoneMatch }) =>
            v1MapFilesDelete(client, mapId, path, { ifMatch, ifNoneMatch }),
        ...rest,
    })
}
