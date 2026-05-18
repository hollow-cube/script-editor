export function encodeMapId(mapId: string): string {
    return encodeURIComponent(mapId)
}

export function encodeWildcardPath(path: string): string {
    const trimmed = path.replace(/^\/+/u, '')
    return trimmed
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/')
}

export function mapEditorBootstrapPath(mapId: string): `/${string}` {
    return `/v1/maps/${encodeMapId(mapId)}/editor/bootstrap`
}

export function mapFilePath(mapId: string, path: string): `/${string}` {
    return `/v1/maps/${encodeMapId(mapId)}/files/${encodeWildcardPath(path)}`
}

export function mapEditorEventsPath(mapId: string): `/${string}` {
    return `/v1/maps/${encodeMapId(mapId)}/editor/events`
}
