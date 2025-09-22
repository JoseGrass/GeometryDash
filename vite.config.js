import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2015',      // compatible con WebView
    outDir: 'dist',
    rollupOptions: {
      output: {
        format: 'iife',    // bundle clásico
        entryFileNames: 'bundle.js',
      },
    },
  },
})
