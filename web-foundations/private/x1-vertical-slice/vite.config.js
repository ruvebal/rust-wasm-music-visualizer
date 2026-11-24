import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/rust-wasm-music-visualizer/' : '/',
});
