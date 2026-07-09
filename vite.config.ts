import stylex from "@stylexjs/unplugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackStart(),
    // StyleX must run before react for Fast Refresh compatibility
    stylex.vite({
      dev: process.env.NODE_ENV === "development",
      useCSSLayers: true,
      runtimeInjection: false,
    }),
    // react's vite plugin must come after start's vite plugin
    viteReact(),
    tsconfigPaths(),
  ],
});
