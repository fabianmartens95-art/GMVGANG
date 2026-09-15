import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  preview: {
    allowedHosts: ["economics-calculator-production.up.railway.app"]
  }
});
