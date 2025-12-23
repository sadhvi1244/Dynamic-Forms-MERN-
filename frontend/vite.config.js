import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      "/api": {
        target: "https://dynamic-forms-backend-wine.vercel.app",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
