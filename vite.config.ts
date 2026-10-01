import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // This repo is a <username>.github.io root site, served at the domain
  // root, so '/' is correct. If you ever move this to a project repo
  // (served at <username>.github.io/repo-name/), change this to
  // '/repo-name/' — see DEPLOYMENT.md.
  base: '/',
})
