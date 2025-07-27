import { reactRouter } from "@react-router/dev/vite"
import { defineConfig } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [reactRouter(), tsconfigPaths()],
  server: {
    fs: {
      // Allow serving files from the external drive
      allow: [
        // Default allowed paths
        '..',
        // Add your external drive path
        '/Volumes/T7'
      ]
    }
  },
  // Add static file serving for external directory
  publicDir: false, // Disable default public directory since we're using custom setup
})
