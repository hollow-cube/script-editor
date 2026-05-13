import { useMutation, type UseMutationOptions } from '@tanstack/react-query'

import type { HCClient } from '../client'
import { projectFilePath } from '../path'
import { useHCClient } from '../provider'
import { ProjectFileSchema, type ProjectFile } from './v1-project-get'

// ---- Endpoint ----

export const v1ProjectFilesUpdate = (
    client: HCClient,
    projectId: string,
    path: string,
    body: BodyInit,
    contentType: string = 'text/plain',
): Promise<ProjectFile> =>
    client.request('PUT', projectFilePath(projectId, path), {
        body,
        headers: { 'Content-Type': contentType },
        response: ProjectFileSchema,
    })

// ---- Mutation key ----

export const v1ProjectFilesUpdateKey = (projectId?: string, path?: string) =>
    [
        'v1',
        'project',
        'files',
        'update',
        ...(projectId === undefined ? [] : [projectId]),
        ...(path === undefined ? [] : [path]),
    ] as const

// ---- Hook ----

export interface V1ProjectFilesUpdateVariables {
    projectId: string
    path: string
    body: BodyInit
    contentType?: string
}

export type UseV1ProjectFilesUpdateOptions = { client?: HCClient } & Partial<
    Omit<
        UseMutationOptions<ProjectFile, Error, V1ProjectFilesUpdateVariables>,
        'mutationKey' | 'mutationFn'
    >
>

export const useV1ProjectFilesUpdate = (opts?: UseV1ProjectFilesUpdateOptions) => {
    const client = useHCClient(opts?.client)
    const { client: _client, ...rest } = opts ?? {}
    return useMutation<ProjectFile, Error, V1ProjectFilesUpdateVariables>({
        mutationKey: v1ProjectFilesUpdateKey(),
        mutationFn: ({ projectId, path, body, contentType }) =>
            v1ProjectFilesUpdate(client, projectId, path, body, contentType),
        ...rest,
    })
}
