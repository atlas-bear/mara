import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@client": path.resolve(__dirname, "./src"),
      "@mara": path.resolve(__dirname, "../mara"),
      "@shared": path.resolve(__dirname, "../../shared"),
      "@components": path.resolve(__dirname, "../mara/components"),
    },
  },
  build: {
    rollupOptions: {
      // Make sure these dependencies are available during build
      external: ["react", "react-dom", "react-router-dom"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react-router-dom": "ReactRouterDOM",
        },
      },
    },
    commonjsOptions: {
      // Include these packages in the bundle
      include: ["node_modules/**", "../mara/components/**"],
    },
  },
});
