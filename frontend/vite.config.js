import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.VITE_API_URL || 'http://127.0.0.1:5000';

  console.log('--- Vite Config ---');
  console.log('Mode:', mode);
  console.log('API URL:', apiUrl);

  return {
    plugins: [
      react(),
      mode === 'development' ? basicSsl() : null
    ].filter(Boolean),
    resolve: {
      alias: {
        'simple-peer': 'simple-peer/simplepeer.min.js',
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: true,
      proxy: {
        '/socket.io': {
          target: apiUrl,
          ws: true,
          changeOrigin: true,
          secure: false
        },
        '/api': {
          target: apiUrl,
          changeOrigin: true,
          secure: false
        },
        '/uploads': {
          target: apiUrl,
          changeOrigin: true,
          secure: false
        },
        '/peerjs': {
          target: apiUrl,
          changeOrigin: true,
          ws: true,
          secure: false
        }
      }
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      proxy: {
        '/socket.io': {
          target: apiUrl,
          ws: true,
          changeOrigin: true,
          secure: false
        },
        '/api': {
          target: apiUrl,
          changeOrigin: true,
          secure: false
        },
        '/uploads': {
          target: apiUrl,
          changeOrigin: true,
          secure: false
        },
        '/peerjs': {
          target: apiUrl,
          changeOrigin: true,
          ws: true,
          secure: false
        }
      }
    }
  }
})

