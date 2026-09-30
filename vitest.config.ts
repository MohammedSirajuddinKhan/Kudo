import path from "path";
import { defineConfig } from "vitest/config";

// Minimal test config — deliberately separate from vite.config.ts so unit
// tests don't load the app's plugin chain (vly/tailwind/react). Files that
// need DOM APIs opt in with a `@vitest-environment happy-dom` pragma.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
