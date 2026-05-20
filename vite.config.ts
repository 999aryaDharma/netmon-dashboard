import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    host: "0.0.0.0", // ← Tambah ini: listen di semua interface
    port: 5173, // ← Pastikan port-nya sama
  },
});
