import { defineConfig } from "vite";
export default defineConfig({
  esbuild: { jsx: "automatic" },
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/\/(react-dom|react|scheduler)\//.test(id)) return "react";
          if (/\/(dexie|dexie-react-hooks|papaparse)\//.test(id))
            return "storage";
          if (id.includes("/@radix-ui/")) return "controls";
        },
      },
    },
  },
});
