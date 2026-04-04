import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    server: {
          host: "::",
          port: 8080,
          hmr: {
                  overlay: false,
          },
    },
    plugins: [react()],
    resolve: {
          alias: {
                  "@": path.resolve(__dirname, "./src"),
          },
    },
    build: {
          rollupOptions: {
                  output: {
                          manualChunks(id) {
                                  if (!id.includes("node_modules")) return;

                                  if (
                                          id.includes("react-dom") ||
                                          id.includes("react-router-dom") ||
                                          id.includes("@tanstack/react-query") ||
                                          id.includes("/react/")
                                  ) {
                                          return "vendor-react";
                                  }

                                  if (id.includes("@supabase/supabase-js")) {
                                          return "vendor-supabase";
                                  }

                                  if (id.includes("@radix-ui")) {
                                          return "vendor-radix";
                                  }

                                  if (id.includes("date-fns")) {
                                          return "vendor-date";
                                  }

                                  if (id.includes("lucide-react")) {
                                          return "vendor-icons";
                                  }

                                  return undefined;
                          },
                  },
          },
    },
}));
