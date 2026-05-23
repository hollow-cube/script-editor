import type { HCClient } from '../client'
import { mapFilePath } from '../path'
import { writeConditionHeaders, type MapFilesWriteConditions } from './v1-map-files-write'

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
