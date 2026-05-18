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

export { HCClientProvider, useHCClient } from './provider'

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
    useV1MapEditorBootstrap,
    v1MapEditorBootstrap,
    v1MapEditorBootstrapKey,
    v1MapEditorBootstrapOptions,
    type MapEditorBootstrap,
    type MapFile,
    type MapInfo,
    type UseV1MapEditorBootstrapOptions,
} from './endpoints/v1-map-editor-bootstrap'

export {
    useV1MapFilesGet,
    v1MapFilesGet,
    v1MapFilesGetKey,
    v1MapFilesGetOptions,
    type MapFileBytes,
    type MapFilesGetConditions,
    type UseV1MapFilesGetOptions,
} from './endpoints/v1-map-files-get'

export {
    useV1MapFilesUpdate,
    v1MapFilesUpdate,
    v1MapFilesUpdateKey,
    type UseV1MapFilesUpdateOptions,
    type V1MapFilesUpdateVariables,
} from './endpoints/v1-map-files-update'

export {
    useV1MapFilesDelete,
    v1MapFilesDelete,
    v1MapFilesDeleteKey,
    type UseV1MapFilesDeleteOptions,
    type V1MapFilesDeleteVariables,
} from './endpoints/v1-map-files-delete'

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
