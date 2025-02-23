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
      external: [
        "react",
        "react-dom",
        "react-router-dom",
        "lucide-react",
        "recharts",
        "mapbox-gl",
      ],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react-router-dom": "ReactRouterDOM",
          "lucide-react": "LucideReact",
          recharts: "Recharts",
          "mapbox-gl": "mapboxgl",
        },
      },
    },
  },
});
