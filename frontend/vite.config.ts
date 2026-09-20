import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

const BUILD_ID = process.env.VITE_BUILD_ID || new Date().toISOString()
const APP_VERSION = '1.2.0'

function versionPlugin(): Plugin {
  return {
    name: 'version-manifest-plugin',
    buildStart() {
      const publicDir = path.resolve(__dirname, './public')
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true })
      }
      const data = JSON.stringify({
        version: APP_VERSION,
        buildId: BUILD_ID,
        builtAt: BUILD_ID,
      }, null, 2)
      fs.writeFileSync(path.resolve(publicDir, 'version.json'), data)
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({
          version: APP_VERSION,
          buildId: BUILD_ID,
          builtAt: BUILD_ID,
        }, null, 2),
      })
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/version.json') {
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
          res.end(JSON.stringify({
            version: APP_VERSION,
            buildId: BUILD_ID,
            builtAt: BUILD_ID,
          }))
          return
        }
        next()
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), versionPlugin()],
  define: {
    __APP_BUILD_ID__: JSON.stringify(BUILD_ID),
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api/ws': {
        target: 'ws://localhost',
        ws: true,
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost',
        changeOrigin: true,
      },
    },
  },
})
