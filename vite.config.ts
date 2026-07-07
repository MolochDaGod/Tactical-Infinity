import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const THREE_ADDONS = path.resolve(import.meta.dirname, "node_modules/three/examples/jsm");

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    // Resolve three/addons/* → three/examples/jsm/* for any package that uses the addons alias
    {
      name: "three-addons-resolver",
      resolveId(id) {
        if (id.startsWith("three/addons/")) {
          return path.join(THREE_ADDONS, id.slice("three/addons/".length));
        }
      },
    },
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "client", "src", "assets"),
      // Force all packages to share one Three.js instance (prevents duplicate WebGLRenderer warnings)
      "three": path.resolve(import.meta.dirname, "node_modules/three"),
    },
  },
  optimizeDeps: {
    // Resolve three/addons/* during esbuild pre-bundling (needed by @three.ez/instanced-mesh)
    esbuildOptions: {
      plugins: [
        {
          name: "three-addons-esbuild",
          setup(build) {
            build.onResolve({ filter: /^three\/addons\// }, (args) => {
              const suffix = args.path.replace("three/addons/", "");
              return { path: path.join(THREE_ADDONS, suffix) };
            });
          },
        },
      ],
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          if (id.includes("/three/") || id.includes("three-mesh-bvh") || id.includes("meshoptimizer") || id.includes("@recast-navigation")) {
            return "vendor-three";
          }
          if (id.includes("@pixi") || id.includes("/pixi.js") || id.includes("/pixi-")) {
            return "vendor-pixi";
          }
          if (id.includes("yuka") || id.includes("cannon")) {
            return "vendor-physics";
          }
          if (id.includes("react-dom") || id.includes("scheduler/")) {
            return "vendor-react-dom";
          }
          if (id.includes("@radix-ui") || id.includes("framer-motion") || id.includes("lucide-react") || id.includes("cmdk") || id.includes("vaul")) {
            return "vendor-ui";
          }
          if (id.includes("@tanstack") || id.includes("wouter") || id.includes("zod") || id.includes("react-hook-form") || id.includes("@hookform")) {
            return "vendor-app-core";
          }
          if (id.includes("date-fns") || id.includes("recharts") || id.includes("/d3-")) {
            return "vendor-data-viz";
          }
          return "vendor";
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
