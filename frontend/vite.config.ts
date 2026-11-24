import react from '@vitejs/plugin-react'
import { defineConfig, type ProxyOptions } from 'vite'

// En dev, Vite redirige les appels /api/... du front. Le code du front n'utilise que des URLs relatives.
//
// - npm run dev       : vers la gateway du cluster (minikube tunnel doit tourner) -> services + PostgreSQL.
//   On vise 127.0.0.1 en precisant le nom splitly.localhost, que Node ne sait pas resoudre seul.
// - npm run dev:local : vers les services lances en local avec npm run dev (base en memoire).
const GATEWAY: Record<string, ProxyOptions> = {
  '/api': { target: 'http://127.0.0.1', headers: { Host: 'splitly.localhost' } },
}

const LOCAL_SERVICES: Record<string, string> = {
  '/api/groups': 'http://localhost:8080',
  '/api/expenses': 'http://localhost:8081',
}

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    proxy: mode === 'local' ? LOCAL_SERVICES : GATEWAY,
  },
}))
