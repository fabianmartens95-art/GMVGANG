import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  preview: {
    // Public, stateless calculator: Railway health checks use an internal Host header.
    allowedHosts: true
  }
});
