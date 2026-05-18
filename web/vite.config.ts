import { cloudflare } from '@cloudflare/vite-plugin'
import generouted from '@generouted/react-router/plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'

// The app is mounted under `/editor` — `/` deliberately does not resolve to it.
// In the dev server `/` would otherwise 404 (Vite scopes everything to `base`),
// so bounce it to the app root for convenience.
const redirectRootToEditor = (): Plugin => ({
    name: 'redirect-root-to-editor',
    configureServer(server) {
        server.middlewares.use((req, res, next) => {
            if (req.url === '/') {
                res.statusCode = 302
                res.setHeader('Location', '/editor/')
                res.end()
                return
            }
            next()
        })
    },
})

export default defineConfig({
    base: '/editor/',
    plugins: [react(), tailwindcss(), generouted(), cloudflare(), redirectRootToEditor()],
    // `jose` is reached only through the @hollowcube/common/auth source barrel,
    // so Vite's dep scanner discovers it late and re-optimizes mid-load —
    // re-bundling react-dom with a fresh hash while the page still holds the
    // old react/react-router chunk, yielding two React instances ("Invalid
    // hook call" in <Outlet>). Pre-declaring the React family + jose forces
    // one deterministic optimize pass up front.
    optimizeDeps: {
        include: [
            'react',
            'react-dom',
            'react-dom/client',
            'react/jsx-runtime',
            'react/jsx-dev-runtime',
            'react-router',
            'jose',
        ],
    },
    resolve: {
        // Belt-and-braces: pin every consumer (workspace source + pre-bundled
        // deps) to a single physical copy.
        dedupe: ['react', 'react-dom', 'react-router'],
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
})
