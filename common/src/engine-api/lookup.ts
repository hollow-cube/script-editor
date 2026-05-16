import {
    type EngineApiDoc,
    type EngineApiExport,
    type EngineApiMethod,
    type EngineApiModule,
    type EngineApiProperty,
} from './schema'

// Pure navigation helpers over the parsed doc. Used by the docs editor, the
// hover override, and the search source.

/** Resolve a module id to its doc node. `moduleId` is a library key
 *  (`@mapmaker/store`) or a global `moduleName` (`Text`, `runtime`). */
export function findDocNode(doc: EngineApiDoc, moduleId: string): EngineApiModule | undefined {
    return doc.libraries[moduleId] ?? doc.globals.find((g) => g.moduleName === moduleId)
}

export type EngineApiMember =
    | { kind: 'method'; method: EngineApiMethod; owner?: EngineApiExport }
    | { kind: 'property'; property: EngineApiProperty; owner?: EngineApiExport }
    | { kind: 'export'; export: EngineApiExport }

/** Best-effort: find the member named `symbol` anywhere in `node` — a static
 *  method/property, an export type, or a method/property on an export. First
 *  match wins (name collisions across containers are rare and acceptable for
 *  v1; rendering fidelity is a follow-up). */
export function findMember(node: EngineApiModule, symbol: string): EngineApiMember | undefined {
    const method = node.staticMethods?.find((m) => m.name === symbol)
    if (method) return { kind: 'method', method }

    const property = node.staticProperties?.find((p) => p.name === symbol)
    if (property) return { kind: 'property', property }

    for (const exp of node.exports ?? []) {
        if (exp.name === symbol) return { kind: 'export', export: exp }
    }
    for (const exp of node.exports ?? []) {
        const m = exp.methods?.find((x) => x.name === symbol)
        if (m) return { kind: 'method', method: m, owner: exp }
        const p = exp.properties?.find((x) => x.name === symbol)
        if (p) return { kind: 'property', property: p, owner: exp }
    }
    return undefined
}
