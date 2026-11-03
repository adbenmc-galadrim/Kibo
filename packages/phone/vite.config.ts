import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const SERVICE_WORKER = "sw";
const BUILD_ID = process.env.KIBO_BUILD_ID ?? Date.now().toString(36);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { KIBO_BUILD_ID: JSON.stringify(BUILD_ID) },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      sonner: new URL("./src/toast.ts", import.meta.url).pathname,
    },
  },
  build: {
    outDir: "dist",
    manifest: true,
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input: {
        index: new URL("./index.html", import.meta.url).pathname,
        [SERVICE_WORKER]: new URL("./src/sw.ts", import.meta.url).pathname,
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === SERVICE_WORKER ? "sw.js" : "assets/[name]-[hash].js"),
      },
    },
  },
});
