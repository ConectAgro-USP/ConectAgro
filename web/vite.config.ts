import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    // Sem globals o Testing Library não limpa o DOM entre os testes
    globals: true,
    setupFiles: "@testing-library/jest-dom/vitest",
    coverage: {
      // O SonarCloud lê a cobertura do frontend no lcov.info
      reporter: ["text", "lcovonly"],
    },
  },
});
