import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config for the React SPA frontend.
// - root is this `frontend/` directory (where index.html lives)
// - the production build is emitted to `frontend/dist`, which the Express
//   static handler serves in production (Option 1: backend serves the build).
// - during development, API calls to `/api/*` are proxied to the Express
//   backend so the browser treats them as same-origin and the HttpOnly,
//   SameSite=Lax session cookie continues to work without any CORS changes.
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: false,
      },
    },
  },
});
