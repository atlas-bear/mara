import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    cors: true,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  },
  define: {
    "process.env": process.env,
  },
  base: "/",
});
