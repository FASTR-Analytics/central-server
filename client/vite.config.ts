import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [solidPlugin(), tsconfigPaths(), tailwindcss()],
  resolve: {
    alias: {
      "@timroberton/panther": path.resolve(__dirname, "../../platform/panther/mod.ui.ts"),
      panther: path.resolve(__dirname, "../../platform/panther/mod.ui.ts"),
      "platform-lib": path.resolve(__dirname, "../../platform/lib/mod.ts"),
      "solid-js": path.resolve(__dirname, "node_modules/solid-js"),
      "@solidjs/router": path.resolve(__dirname, "node_modules/@solidjs/router"),
    },
  },
  // Serve platform fonts during development
  publicDir: path.resolve(__dirname, "../../platform/client/public"),
  server: {
    port: 3000,
  },
  build: {
    target: "esnext",
    outDir: "dist",
  },
});
