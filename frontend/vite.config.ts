import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// En dev, Vite joue le role de la gateway : chaque /api/... part vers le service lance en local.
// Le code du front n'utilise que des URLs relatives (/api/...), donc rien ne change une fois deploye.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/groups': 'http://localhost:8080',
      '/api/expenses': 'http://localhost:8081',
    },
  },
})
