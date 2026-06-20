import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// @mediapipe/tasks-vision references a .js.map that it does not ship, which spams
// "Failed to load source map" warnings in dev. Strip the stale reference.
function stripMediapipeSourcemap(): Plugin {
  return {
    name: 'strip-mediapipe-sourcemap',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('@mediapipe/tasks-vision')) {
        return { code: code.replace(/\/\/#\s*sourceMappingURL=.*$/gm, ''), map: null };
      }
      return null;
    },
  };
}

// HTTPS is required for getUserMedia on mobile browsers when testing over a LAN
// IP (e.g. https://192.168.x.x:5173). basicSsl serves a self-signed cert; accept
// the browser warning once on the phone. localhost is treated as secure already.
//
// `--mode tunnel` (npm run dev:tunnel) serves plain HTTP and accepts any Host, so
// a tunnel (ngrok/cloudflared) can put a public HTTPS domain in front — needed
// because DeepAR license keys reject `localhost` and require a real domain.
export default defineConfig(({ mode }) => {
  const tunnel = mode === 'tunnel';
  return {
    plugins: [react(), ...(tunnel ? [] : [basicSsl()]), stripMediapipeSourcemap()],
    server: {
      host: true,
      port: 5173,
      // Accept the tunnel's public hostname (Vite blocks unknown hosts otherwise).
      allowedHosts: true,
      ...(tunnel ? {} : { https: {} }),
    },
    // tasks-vision + deepar ship wasm that should not be pre-bundled aggressively.
    optimizeDeps: {
      exclude: ['@mediapipe/tasks-vision', 'deepar'],
    },
    build: {
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          // Split heavy libs so the browser can cache/parallelize them.
          manualChunks: {
            three: ['three'],
            r3f: ['@react-three/fiber', '@react-three/drei'],
            mediapipe: ['@mediapipe/tasks-vision'],
            react: ['react', 'react-dom', 'zustand'],
          },
        },
      },
    },
  };
});
