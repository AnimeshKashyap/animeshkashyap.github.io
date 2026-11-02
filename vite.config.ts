import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // This repo is a <username>.github.io root site, served at the domain
  // root, so '/' is correct. If you ever move this to a project repo
  // (served at <username>.github.io/repo-name/), change this to
  // '/repo-name/' — see DEPLOYMENT.md.
  base: '/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        v2: resolve(rootDir, 'v2/index.html'),
        v3: resolve(rootDir, 'v3/index.html'),
        v4: resolve(rootDir, 'v4/index.html'),
      },
    },
  },
})
