import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    cors: true,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  },
  define: {
    "process.env": {},
  },
  css: {
    postcss: true,
  },
  base: "/",
});
