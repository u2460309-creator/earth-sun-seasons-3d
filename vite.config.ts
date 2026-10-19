import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Sandboxed cloud previews have an opaque origin, sent as the literal "null".
// Keep access limited to that preview context and Vite's usual local origins.
const previewOrigins = [
  "null",
  /^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/,
];

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { cors: { origin: previewOrigins } },
  preview: { cors: { origin: previewOrigins } },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  build: { chunkSizeWarningLimit: 1600 },
});
