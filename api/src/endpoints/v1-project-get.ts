import { queryOptions, useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import type { HCClient } from '../client'
import { projectPath } from '../path'
import { useHCClient } from '../provider'

export const ProjectFileSchema = z.object({
    path: z.string(),
    contentType: z.string(),
    size: z.int(),
    hash: z.string(),
    content: z.string().optional(),
})
export type ProjectFile = z.infer<typeof ProjectFileSchema>

export const ProjectSchema = z.object({
    id: z.string(),
    name: z.string(),
    files: z.array(ProjectFileSchema),
})
export type Project = z.infer<typeof ProjectSchema>

// ---- Endpoint ----

export const v1ProjectGet = (client: HCClient, projectId: string): Promise<Project> =>
    client.request('GET', projectPath(projectId), { response: ProjectSchema })

// ---- Query key ----
// Pass no args for a prefix match (matches all v1.project.get queries).

export const v1ProjectGetKey = (projectId?: string) =>
    ['v1', 'project', 'get', ...(projectId === undefined ? [] : [projectId])] as const

// ---- Query options ----

export const v1ProjectGetOptions = (client: HCClient, projectId: string) =>
    queryOptions({
        queryKey: v1ProjectGetKey(projectId),
        queryFn: () => v1ProjectGet(client, projectId),
    })

// ---- Hook ----

export type UseV1ProjectGetOptions = { client?: HCClient } & Partial<
    Omit<
        UseQueryOptions<Project, Error, Project, ReturnType<typeof v1ProjectGetKey>>,
        'queryKey' | 'queryFn'
    >
>

export const useV1ProjectGet = (projectId: string, opts?: UseV1ProjectGetOptions) => {
    const client = useHCClient(opts?.client)
    const { client: _client, ...rest } = opts ?? {}
    return useQuery({ ...v1ProjectGetOptions(client, projectId), ...rest })
}
