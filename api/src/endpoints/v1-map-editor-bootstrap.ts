import { z } from 'zod'

import type { HCClient } from '../client'
import { mapEditorBootstrapPath } from '../path'

export const MapFileSchema = z.object({
    path: z.string(),
    contentType: z.string(),
    size: z.int(),
    /** Hex SHA-256 of the stored bytes. Doubles as the strong ETag for
     *  conditional file requests (see v1-map-files-*). */
    hash: z.string(),
})
export type MapFile = z.infer<typeof MapFileSchema>

export const MapInfoSchema = z.object({
    id: z.string(),
    name: z.string(),
    owner: z.string(),
})
export type MapInfo = z.infer<typeof MapInfoSchema>

export const MapEditorBootstrapSchema = z.object({
    map: MapInfoSchema,
    files: z.array(MapFileSchema),
})
export type MapEditorBootstrap = z.infer<typeof MapEditorBootstrapSchema>

// One call to initialize the editor: map metadata + the full file listing.
// Replaces the old GET /projects/{id}. Requires a session (401 unauth, 404
// unknown map, 403 not the owner).

export const v1MapEditorBootstrap = (
    client: HCClient,
    mapId: string,
    opts?: { signal?: AbortSignal },
): Promise<MapEditorBootstrap> =>
    client.request('GET', mapEditorBootstrapPath(mapId), {
        response: MapEditorBootstrapSchema,
        signal: opts?.signal,
    })
