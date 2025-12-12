import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      "@konzept": path.resolve(import.meta.dirname, "konzept"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    // Enhanced HMR (Hot Module Replacement) configuration
    hmr: {
      overlay: true, // Show error overlay on build errors
    },
    fs: {
      // Allow serving files from outside of Vite root (client/) so @konzept imports work
      allow: [
        path.resolve(import.meta.dirname),
        path.resolve(import.meta.dirname, "konzept"),
      ],
    },
    watch: {
      // Force reload on changes to these file types
      usePolling: true, // Use polling for better file change detection
      interval: 100, // Check for changes every 100ms
    },
    // Automatically find available port if default is occupied
    strictPort: false,
    port: 5173,
  },
  // Optimize caching behavior
  cacheDir: path.resolve(import.meta.dirname, "node_modules/.vite"),
  optimizeDeps: {
    force: false, // Only force rebuild when needed
  },
});
