import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const rootDir = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      '@jackfoxdev/threlte-text-morph': resolve(rootDir, 'src/lib/index.ts'),
      three: resolve(rootDir, 'node_modules/three')
    }
  },
  server: {
    port: 4173
  }
});
