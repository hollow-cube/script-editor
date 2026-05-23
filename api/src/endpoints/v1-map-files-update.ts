import type { HCClient } from '../client'
import { mapFilePath } from '../path'
import { MapFileSchema, type MapFile } from './v1-map-editor-bootstrap'
import { writeConditionHeaders, type MapFilesWriteConditions } from './v1-map-files-write'

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
