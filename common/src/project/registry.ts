import { type ReactNode } from 'react'

import { type DockId, type Tab, type TabRegistry } from '../workspace'

// Two registries sit above the workspace primitive's flat `TabRegistry`:
//
//  • ToolDefinition  — singleton, sits in a tool dock (files, search, …).
//                      Each tool maps to its own `kind`.
//
//  • EditorDefinition — multi-instance, keyed by mime type (json, luau, …).
//                       Multiple editor tabs can exist for the same file
//                       (e.g. when split).
//
// `buildTabRegistry` flattens both into the Record<TabKind, render> shape that
// the existing Workspace primitive consumes via its `tabRegistry` prop. The
// primitive itself doesn't know about tools vs editors.

export type ToolDefinition = {
    /** Tab kind. Convention: `tool:<id>`. */
    kind: string
    title: string
    icon: ReactNode
    /** Which dock the tool opens in if launched without an existing location. */
    defaultLocation: DockId
    render: (tab: Tab) => ReactNode
}

export type EditorDefinition = {
    /** Tab kind. Convention: `editor:<mime>` or `editor:<synthetic>`. */
    kind: string
    /** Mime types this editor handles. Empty for synthetic editors like Welcome. */
    mimeTypes: readonly string[]
    /** Optional title resolver. Receives `tab.payload`. */
    titleFor?: (payload: Record<string, unknown> | undefined) => string
    render: (tab: Tab) => ReactNode
}

export function buildTabRegistry(
    tools: readonly ToolDefinition[],
    editors: readonly EditorDefinition[],
): TabRegistry {
    const registry: Record<string, (tab: Tab) => ReactNode> = {}
    for (const tool of tools) registry[tool.kind] = tool.render
    for (const editor of editors) registry[editor.kind] = editor.render
    return registry
}
