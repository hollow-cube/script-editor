import { z } from 'zod'

// Fail-fast validation of build-time config. Without this, a missing
// VITE_API_BASE_URL silently resolves to same-origin (the editor's own static
// host) and every API request hits the wrong origin — a broken prod app with
// no obvious cause. A clear thrown error at module load is strictly better
// than a silent wrong-origin fallback.
//
// Vite inlines `import.meta.env.VITE_*` at build time from the `.env*` files
// for the active mode (see web/.env.development, web/.env.production).

const EnvSchema = z.object({
    // Absolute base URL for the API host (no trailing slash, no /v1). The API
    // client appends /v1/...; canonicalHtu derives the DPoP `htu` from the
    // absolute request URL, so an absolute cross-origin base is required in
    // prod (the API is on a different origin than the editor).
    VITE_API_BASE_URL: z.url(),
})

const parsed = EnvSchema.safeParse(import.meta.env)

if (!parsed.success) {
    const detail = parsed.error.issues
        .map((issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('\n')
    throw new Error(
        `Invalid environment configuration:\n${detail}\n\n` +
            'Set VITE_API_BASE_URL (committed defaults live in web/.env.development ' +
            'and web/.env.production; see web/.env.example).',
    )
}

export const env = parsed.data
