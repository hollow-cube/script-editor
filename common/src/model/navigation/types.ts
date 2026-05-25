// Metadata-only views of tool / editor definitions that the model layer
// needs for navigation: enough to find the right tab, build a title, and
// route a new tab. Render functions live host-side in `project/registry.tsx`.

import type { DockId } from '../../workspace/types'

export type ToolMetadata = {
    /** Tab kind. Convention: `tool:<id>`. */
    kind: string
    /** Display title; used as the tab title when creating a new instance. */
    title: string
    /** Dock the tool opens in when no specific dock is requested. */
    defaultLocation: DockId
}

export type EditorMetadata<TPayload = unknown> = {
    /** Tab kind. Convention: `editor:<mime>` or `editor:<synthetic>`. */
    kind: string
    /** Mime types this editor handles. Empty for synthetic editors. */
    mimeTypes: readonly string[]
    /** When true, opening this editor again focuses the existing instance
     *  instead of creating a new tab. */
    singleton?: boolean
    /** Validate / narrow the tab payload. */
    parsePayload?: (raw: unknown) => TPayload
    /** Optional title resolver, receives the parsed payload. */
    titleFor?: (payload: TPayload) => string
}

export type AnyEditorMetadata = EditorMetadata<unknown>

export type OpenEditorTarget =
    | { kind: 'focused' }
    | { kind: 'leaf'; leafId: string }
    | { kind: 'new-tab'; leafId: string }

export type OpenEditorArgs = {
    /** Either the editor kind directly, or a mime type to look up. */
    kind?: string
    mimeType?: string
    payload?: Record<string, unknown>
    /** Optional identity for reuse. If a tab with the same kind and matching
     *  `payload[identityKey]` already exists, it's activated instead of
     *  creating a new tab. */
    identityKey?: string
    title?: string
    target?: OpenEditorTarget
}

export type OpenToolArgs = {
    kind: string
    dock?: DockId
}
