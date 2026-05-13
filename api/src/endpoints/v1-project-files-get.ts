import { queryOptions, useQuery, type UseQueryOptions } from '@tanstack/react-query'

import type { HCClient } from '../client'
import { projectFilePath } from '../path'
import { useHCClient } from '../provider'

export interface ProjectFileBytes {
    bytes: Uint8Array
    contentType: string
}

// ---- Endpoint ----

export const v1ProjectFilesGet = async (
    client: HCClient,
    projectId: string,
    path: string,
): Promise<ProjectFileBytes> => {
    const response = await client.send('GET', projectFilePath(projectId, path))
    const buffer = await response.arrayBuffer()
    return {
        bytes: new Uint8Array(buffer),
        contentType: response.headers.get('content-type') ?? 'application/octet-stream',
    }
}

// ---- Query key ----

export const v1ProjectFilesGetKey = (projectId?: string, path?: string) =>
    [
        'v1',
        'project',
        'files',
        'get',
        ...(projectId === undefined ? [] : [projectId]),
        ...(path === undefined ? [] : [path]),
    ] as const

// ---- Query options ----

export const v1ProjectFilesGetOptions = (client: HCClient, projectId: string, path: string) =>
    queryOptions({
        queryKey: v1ProjectFilesGetKey(projectId, path),
        queryFn: () => v1ProjectFilesGet(client, projectId, path),
    })

// ---- Hook ----

export type UseV1ProjectFilesGetOptions = { client?: HCClient } & Partial<
    Omit<
        UseQueryOptions<
            ProjectFileBytes,
            Error,
            ProjectFileBytes,
            ReturnType<typeof v1ProjectFilesGetKey>
        >,
        'queryKey' | 'queryFn'
    >
>

export const useV1ProjectFilesGet = (
    projectId: string,
    path: string,
    opts?: UseV1ProjectFilesGetOptions,
) => {
    const client = useHCClient(opts?.client)
    const { client: _client, ...rest } = opts ?? {}
    return useQuery({ ...v1ProjectFilesGetOptions(client, projectId, path), ...rest })
}
