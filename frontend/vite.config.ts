import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// En dev, Vite joue le role de la future gateway : /api part vers group-service lance en local.
// Le code du front n'utilise que des URLs relatives (/api/...), donc rien ne change une fois deploye.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/groups': 'http://localhost:8080',
    },
  },
})
