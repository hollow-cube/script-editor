import { type EngineApiMember } from './lookup'
import { type EngineApiMethod, type EngineApiProperty, type TypeSpec } from './schema'

// Best-effort one-line formatting of the (permissive) type grammar and of
// methods/properties. Shared by the docs editor (React) and the hover override
// (DOM) so both render identical signatures. This is intentionally minimal —
// richer type rendering is a follow-up.

type AnyType = {
    kind: string
    name?: string
    module?: string
    args?: AnyType[]
    alternatives?: AnyType[]
    inner?: AnyType
    type?: AnyType
    params?: { type: AnyType }[]
    returns?: AnyType[]
    fields?: { name: string; type: AnyType }[]
    indexerKey?: AnyType
    indexerValue?: AnyType
    value?: unknown
}

export function formatTypeSpec(spec: TypeSpec | undefined): string {
    if (!spec) return 'unknown'
    const t = spec as unknown as AnyType
    switch (t.kind) {
        case 'named': {
            const base = t.name ?? 'unknown'
            return t.args && t.args.length > 0
                ? `${base}<${t.args.map(formatTypeSpec).join(', ')}>`
                : base
        }
        case 'optional':
            return `${formatTypeSpec(t.inner)}?`
        case 'union':
            return (t.alternatives ?? []).map(formatTypeSpec).join(' | ') || 'unknown'
        case 'function': {
            const params = (t.params ?? []).map((p) => formatTypeSpec(p.type)).join(', ')
            const rets = (t.returns ?? []).map(formatTypeSpec)
            const ret =
                rets.length === 0 ? '()' : rets.length === 1 ? rets[0]! : `(${rets.join(', ')})`
            return `(${params}) -> ${ret}`
        }
        case 'table': {
            if (t.fields && t.fields.length > 0) {
                return `{ ${t.fields.map((f) => `${f.name}: ${formatTypeSpec(f.type)}`).join(', ')} }`
            }
            if (t.indexerKey || t.indexerValue) {
                return `{ [${formatTypeSpec(t.indexerKey)}]: ${formatTypeSpec(t.indexerValue)} }`
            }
            return '{}'
        }
        case 'variadic':
            return `...${formatTypeSpec(t.inner)}`
        case 'genericPack':
            return `${t.name ?? 'T'}...`
        case 'generic':
            return t.name ?? 'T'
        case 'pack':
            return t.inner ? formatTypeSpec(t.inner) : '()'
        case 'single':
            return formatTypeSpec(t.type)
        case 'string':
            return typeof t.value === 'string' ? `"${t.value}"` : 'string'
        default:
            return t.kind
    }
}

function genericsPrefix(generics: EngineApiMethod['generics']): string {
    if (!generics || generics.length === 0) return ''
    return `<${generics.map((g) => (g.pack ? `${g.name}...` : g.name)).join(', ')}>`
}

export function methodSignature(method: EngineApiMethod): string {
    const params = (method.params ?? [])
        .map((p) => `${p.name}${p.optional ? '?' : ''}: ${formatTypeSpec(p.type)}`)
        .join(', ')
    const rets = (method.returns ?? []).map((r) => formatTypeSpec(r.type))
    const ret = rets.length === 0 ? '()' : rets.length === 1 ? rets[0]! : `(${rets.join(', ')})`
    return `${method.name}${genericsPrefix(method.generics)}(${params}): ${ret}`
}

export function propertySignature(property: EngineApiProperty): string {
    const accessor = property.getter ?? property.setter
    const access =
        property.getter && property.setter
            ? ' (get/set)'
            : property.getter
              ? ''
              : property.setter
                ? ' (set)'
                : ''
    return `${property.name}: ${formatTypeSpec(accessor?.type)}${access}`
}

/** A qualified display name, e.g. `Player:send_message` or `store.StateDefinition`. */
export function memberTitle(member: EngineApiMember): string {
    if (member.kind === 'export') return member.export.name
    const name = member.kind === 'method' ? member.method.name : member.property.name
    return member.owner ? `${member.owner.name}.${name}` : name
}

export function memberSignature(member: EngineApiMember): string {
    switch (member.kind) {
        case 'method':
            return methodSignature(member.method)
        case 'property':
            return propertySignature(member.property)
        case 'export':
            return `type ${member.export.name}`
    }
}

export function memberDescription(member: EngineApiMember): string | undefined {
    switch (member.kind) {
        case 'method':
            return member.method.description
        case 'property':
            return member.property.description ?? member.property.getter?.description
        case 'export':
            return member.export.description
    }
}
