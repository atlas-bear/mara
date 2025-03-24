import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      "@client": path.resolve(__dirname, "../client/src"),
      "@shared": path.resolve(__dirname, "../../shared"),
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx'
      }
    }
  },
  build: {
    rollupOptions: {
      // Exclude server-only code from the client bundle
      external: [
        // Functions that should never be bundled in client code
        '/functions/**',
        '**/functions/**',
        '**/llm-*.js',
        '**/airtable.js',
        '**/prompts/**'
      ]
    }
  },
});
