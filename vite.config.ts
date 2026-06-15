import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const configuredBase = process.env.VITE_GITHUB_PAGES_BASE_PATH;
const repositoryBase = process.env.GITHUB_REPOSITORY?.split("/")[1];

export default defineConfig({
  base: configuredBase || (repositoryBase ? `/${repositoryBase}/` : "/"),
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts"
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("lightweight-charts")) return "charts";
          if (id.includes("@supabase")) return "supabase";
          return undefined;
        }
      }
    }
  }
});
