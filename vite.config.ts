import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import postcss from "postcss";
import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";
import globalStyleSource from "./frontend/globalStyleSource";
import tailwindConfig from "./tailwind.config";

const globalStylesModuleId = 'virtual:cora-global-styles.css';
const resolvedGlobalStylesModuleId = `\0${globalStylesModuleId}`;

function reactGlobalStyles(): Plugin {
  let compiledStyles = '';

  const compileStyles = async () => {
    const result = await postcss([tailwindcss(tailwindConfig), autoprefixer]).process(globalStyleSource, {
      from: undefined,
    });
    compiledStyles = result.css;
  };

  return {
    name: 'cora-react-global-styles',
    enforce: 'pre',
    async buildStart() {
      await compileStyles();
    },
    resolveId(id) {
      return id === globalStylesModuleId ? resolvedGlobalStylesModuleId : undefined;
    },
    async load(id) {
      if (id !== resolvedGlobalStylesModuleId) return undefined;
      if (!compiledStyles) await compileStyles();
      return compiledStyles;
    },
    async handleHotUpdate(context) {
      if (!/\.[jt]sx?$/.test(context.file)) return undefined;

      await compileStyles();
      const globalStylesModule = context.server.moduleGraph.getModuleById(resolvedGlobalStylesModuleId);
      if (!globalStylesModule) return undefined;

      context.server.moduleGraph.invalidateModule(globalStylesModule);
      return [...context.modules, globalStylesModule];
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [reactGlobalStyles(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./frontend"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('@tanstack')) return 'vendor-query';
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('leaflet')) return 'vendor-maps';
          if (id.includes('@radix-ui')) return 'vendor-radix';
          if (
            id.includes('react-dom') ||
            id.includes('react-router') ||
            /node_modules[\\/]react[\\/]/.test(id)
          ) {
            return 'vendor-react';
          }
          return undefined;
        },
      },
    },
  },
}));
