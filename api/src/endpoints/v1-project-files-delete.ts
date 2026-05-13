import { useMutation, type UseMutationOptions } from '@tanstack/react-query'

import type { HCClient } from '../client'
import { projectFilePath } from '../path'
import { useHCClient } from '../provider'

// ---- Endpoint ----

export const v1ProjectFilesDelete = async (
    client: HCClient,
    projectId: string,
    path: string,
): Promise<void> => {
    await client.send('DELETE', projectFilePath(projectId, path))
}

// ---- Mutation key ----

export const v1ProjectFilesDeleteKey = (projectId?: string, path?: string) =>
    [
        'v1',
        'project',
        'files',
        'delete',
        ...(projectId === undefined ? [] : [projectId]),
        ...(path === undefined ? [] : [path]),
    ] as const

// ---- Hook ----

export interface V1ProjectFilesDeleteVariables {
    projectId: string
    path: string
}

export type UseV1ProjectFilesDeleteOptions = { client?: HCClient } & Partial<
    Omit<
        UseMutationOptions<void, Error, V1ProjectFilesDeleteVariables>,
        'mutationKey' | 'mutationFn'
    >
>

export const useV1ProjectFilesDelete = (opts?: UseV1ProjectFilesDeleteOptions) => {
    const client = useHCClient(opts?.client)
    const { client: _client, ...rest } = opts ?? {}
    return useMutation<void, Error, V1ProjectFilesDeleteVariables>({
        mutationKey: v1ProjectFilesDeleteKey(),
        mutationFn: ({ projectId, path }) => v1ProjectFilesDelete(client, projectId, path),
        ...rest,
    })
}
