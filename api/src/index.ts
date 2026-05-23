export {
    HCClient,
    HCV1Client,
    HCV1MapClient,
    HCV1MapFilesClient,
    canonicalHtu,
    type HCAuthHook,
    type HCClientLike,
    type HCClientOptions,
    type HCMethod,
    type HCRequestOptions,
} from './client'

export { ApiError, ApiErrorSchema, type ApiErrorBody } from './error'

export {
    reportDiagnostic,
    setDiagnosticSink,
    type Diagnostic,
    type DiagnosticSink,
} from './diagnostics'

export {
    encodeMapId,
    encodeWildcardPath,
    mapEditorBootstrapPath,
    mapEditorEventsPath,
    mapFilePath,
} from './path'

export { parseSSEStream, type SSEEvent } from './sse'

export {
    MapEditorBootstrapSchema,
    MapFileSchema,
    MapInfoSchema,
    v1MapEditorBootstrap,
    type MapEditorBootstrap,
    type MapFile,
    type MapInfo,
} from './endpoints/v1-map-editor-bootstrap'

export {
    v1MapFilesGet,
    type MapFileBytes,
    type MapFilesGetConditions,
} from './endpoints/v1-map-files-get'

export { v1MapFilesUpdate } from './endpoints/v1-map-files-update'

export { v1MapFilesDelete } from './endpoints/v1-map-files-delete'

export { type MapFilesWriteConditions } from './endpoints/v1-map-files-write'

export {
    MapEventSchema,
    v1MapEditorEvents,
    type MapEvent,
    type MapEventEnvelope,
    type V1MapEditorEventsOptions,
} from './endpoints/v1-map-editor-events'

export {
    AccountMetaSchema,
    v1AuthRedeem,
    V1AuthRedeemResponseSchema,
    type AccountMeta,
    type ClientKind,
    type V1AuthRedeemRequest,
    type V1AuthRedeemResponse,
} from './endpoints/v1-auth-redeem'

export {
    v1AuthToken,
    V1AuthTokenResponseSchema,
    type V1AuthTokenRequest,
    type V1AuthTokenResponse,
} from './endpoints/v1-auth-token'
