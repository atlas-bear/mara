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
    include: ["mapbox-gl", "react", "react-dom"],
  },
  build: {
    rollupOptions: {
      external: [
        "mapbox-gl",
        "mapbox-gl/dist/mapbox-gl.css",
        "lucide-react",
        "recharts",
        "lodash",
        "d3",
        "d3-array",
        "d3-scale",
        "d3-shape",
        "victory",
        "@novu/notification-center",
        "axios",
        "papaparse",
      ],
      output: {
        globals: {
          "mapbox-gl": "mapboxgl",
          "lucide-react": "LucideReact",
          recharts: "Recharts",
          lodash: "_",
          d3: "d3",
          "d3-array": "d3Array",
          "d3-scale": "d3Scale",
          "d3-shape": "d3Shape",
          victory: "Victory",
          "@novu/notification-center": "Novu",
          axios: "axios",
          papaparse: "Papa",
        },
      },
    },
  },
});
