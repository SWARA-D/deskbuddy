import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Run tests in Node environment (no browser DOM needed for these unit tests).
    environment: "node",
    globals: true,
    // Verbose reporter shows each test name in CI output.
    reporters: ["verbose"],
  },
  resolve: {
    // Mirror the @/* path alias from tsconfig.json so imports resolve correctly.
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
