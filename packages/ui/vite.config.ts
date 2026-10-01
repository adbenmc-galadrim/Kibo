import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { devProxy } from "./src/dev-proxy";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  build: { chunkSizeWarningLimit: 800 },
  worker: { rollupOptions: { output: { entryFileNames: "workers/[name]-[hash].js" } } },
  server: { proxy: devProxy("http://127.0.0.1:4317") },
});
