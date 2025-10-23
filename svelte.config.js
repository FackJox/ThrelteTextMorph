import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: null
  },
  package: {
    source: 'src',
    dir: 'dist'
  }
};

export default config;
