import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/.netlify/functions": {
        target: "http://localhost:8888",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@client": path.resolve(__dirname, "./src"),
      "@mara": path.resolve(__dirname, "../mara"),
      "@shared": path.resolve(__dirname, "../../shared"),
      "@components": path.resolve(__dirname, "../mara/components"),
    },
  },
  optimizeDeps: {
    include: ["mapbox-gl", "react", "react-dom"],
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
