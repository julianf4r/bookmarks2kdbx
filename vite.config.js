import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

function localPrivacyPolicy() {
    return {
        name: 'local-privacy-policy',
        transformIndexHtml: {
            order: 'post',
            handler(_html, context) {
                const development = Boolean(context.server)
                const address = context.server?.httpServer?.address()
                const port = address && typeof address === 'object'
                    ? address.port
                    : context.server?.config.server.port || 5173
                const styles = development ? "'self' 'unsafe-inline'" : "'self'"
                const connections = development
                    ? `'self' ws://localhost:${port} ws://127.0.0.1:${port} ws://[::1]:${port}`
                    : "'none'"
                const policy = `default-src 'self'; script-src 'self'; style-src ${styles}; img-src 'self'; font-src 'self'; connect-src ${connections}; frame-src 'none'; object-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'`
                return [{
                    tag: 'meta',
                    attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
                    injectTo: 'head-prepend',
                }]
            },
        },
    }
}

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        localPrivacyPolicy(),
    ],
    build: {
        modulePreload: { polyfill: false },
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        },
    },
})
