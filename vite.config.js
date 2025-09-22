import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: 'https://geometrydashclone.netlify.app/', // <- agrega tu URL de Netlify aquí
})
