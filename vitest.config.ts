import { defineConfig, loadEnv } from "vitest/config"
import { resolve } from "path"

export default defineConfig(({ mode }) => ({
  test: {
    environment: "node",
    env: loadEnv(mode, process.cwd(), ""),
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
}))
