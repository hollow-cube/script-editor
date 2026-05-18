// The API base is resolved at runtime from the page's hostname instead of being
// baked in at build time, so one build artifact serves production, per-PR
// previews, and the localhost-backend deployment. The host->API map below IS
// the whitelist: only these hostnames boot, anything else throws (no silent
// fallback to the real API). Values are absolute origins — no trailing slash,
// no `/v1`; HCClient appends that.

const LOCAL_API = 'http://localhost:10000'
const PROD_API = 'https://api.hollowcube.net'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', 'local.hollowcube.dev'])

// Previews intentionally share the production API for now; this may become a
// dedicated staging URL later.
const PREVIEW_HOST = /^script-editor-\d+\.preview\.hollowcube\.dev$/u

// Pure (no `window`) so it is unit-testable and deterministic. The single
// runtime call lives in the web entry point (main.tsx) and happens once at
// load — referentially stable for the page lifetime, which the AuthProvider's
// HCClient useMemo relies on.
export function resolveApiBaseUrl(hostname: string): string {
    if (LOCAL_HOSTS.has(hostname)) return LOCAL_API
    if (hostname === 'hollowcube.net' || PREVIEW_HOST.test(hostname)) return PROD_API
    throw new Error(
        `No API base configured for host "${hostname}". Recognized: ` +
            'localhost, 127.0.0.1, local.hollowcube.dev, hollowcube.net, ' +
            'script-editor-<n>.preview.hollowcube.dev',
    )
}
