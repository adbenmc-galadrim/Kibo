import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  build: { chunkSizeWarningLimit: 800 },
  server: { proxy: { "/api": { target: "http://127.0.0.1:4317", changeOrigin: true, ws: true } } },
});
