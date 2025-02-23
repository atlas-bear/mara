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
  optimizeDeps: {
    include: ["mapbox-gl"],
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
          react: "React",
          "react-dom": "ReactDOM",
          "react-router-dom": "ReactRouterDOM",
          "lucide-react": "LucideReact",
          recharts: "Recharts",
          "mapbox-gl": "mapboxgl",
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
