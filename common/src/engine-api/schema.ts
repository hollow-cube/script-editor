import { z } from 'zod'

// Zod schema for `engine-api.editor.json`. The navigation structure (modules,
// members, names, descriptions) is validated strictly enough to drive the docs
// UI; `TypeSpec` is intentionally permissive — v1 only reads `kind`/`name`/
// `description`, and the type grammar will keep evolving, so a new TypeSpec
// kind must never fail the parse.

export const typeSpecSchema = z.looseObject({ kind: z.string() })
export type TypeSpec = z.infer<typeof typeSpecSchema>

const genericSchema = z.object({
    name: z.string(),
    pack: z.boolean(),
})

const paramSchema = z.object({
    name: z.string(),
    optional: z.boolean(),
    type: typeSpecSchema,
    description: z.string().optional(),
})

const returnSchema = z.object({
    type: typeSpecSchema,
})

const methodSchema = z.object({
    name: z.string(),
    description: z.string().optional(),
    generics: z.array(genericSchema).optional(),
    params: z.array(paramSchema).optional(),
    returns: z.array(returnSchema).optional(),
})

const accessorSchema = z.object({
    description: z.string().optional(),
    type: typeSpecSchema,
})

const propertySchema = z.object({
    name: z.string(),
    description: z.string().optional(),
    getter: accessorSchema.optional(),
    setter: accessorSchema.optional(),
})

const metaMethodSchema = z.object({
    meta: z.string(),
    description: z.string().optional(),
})

const exportSchema = z.object({
    name: z.string(),
    description: z.string().optional(),
    generics: z.array(genericSchema).optional(),
    methods: z.array(methodSchema).optional(),
    properties: z.array(propertySchema).optional(),
    metaMethods: z.array(metaMethodSchema).optional(),
    /** Name of the export this one inherits from (single inheritance). */
    superExport: z.string().optional(),
})

// Globals and libraries share the same module shape; only the surfacing path
// differs (globals come from the `.d.luau` definition file, libraries from
// require-able synthetic modules).
const moduleSchema = z.object({
    moduleName: z.string(),
    description: z.string().optional(),
    exports: z.array(exportSchema).optional(),
    staticMethods: z.array(methodSchema).optional(),
    staticProperties: z.array(propertySchema).optional(),
})

export const engineApiDocSchema = z.object({
    schemaVersion: z.number(),
    kind: z.literal('luau-engine-api'),
    globals: z.array(moduleSchema),
    libraries: z.record(z.string(), moduleSchema),
    types: z.object({
        /** `global.d.luau` declaration text; `''` when there are no globals. */
        global: z.string(),
        /** Luau source per require-able module, keyed like `libraries`
         *  (the bare `@mapmaker` key is the package `init.luau`). */
        modules: z.record(z.string(), z.string()),
    }),
})

export type EngineApiDoc = z.infer<typeof engineApiDocSchema>
export type EngineApiModule = z.infer<typeof moduleSchema>
export type EngineApiExport = z.infer<typeof exportSchema>
export type EngineApiMethod = z.infer<typeof methodSchema>
export type EngineApiProperty = z.infer<typeof propertySchema>
export type EngineApiParam = z.infer<typeof paramSchema>
