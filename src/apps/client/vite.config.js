import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
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
    include: [
      "mapbox-gl",
      "react",
      "react-dom",
      "recharts",
      "lucide-react",
      "d3",
      "d3-array",
      "d3-scale",
      "d3-shape",
      "victory",
      "lodash",
    ],
  },
  build: {
    rollupOptions: {
      external: [
        "mapbox-gl/dist/mapbox-gl.css",
        "@novu/notification-center",
        "axios",
        "papaparse",
      ],
      output: {
        globals: {
          "@novu/notification-center": "Novu",
          axios: "axios",
          papaparse: "Papa",
        },
      },
    },
  },
});
