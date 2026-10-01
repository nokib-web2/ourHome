import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the built site works from any folder / host.
  base: './',
  server: {
    // polling is slower in theory but never misses a save on Windows drives
    watch: { usePolling: true, interval: 200 },
  },
  build: {
    // three.js alone is ~600 kB, and the HEIC converter (~1.3 MB) is its own
    // chunk that only downloads if an iPhone HEIC photo is actually used
    chunkSizeWarningLimit: 1400,
  },
});
