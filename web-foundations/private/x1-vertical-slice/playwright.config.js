import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  timeout: 30000,
  workers: 1,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4173/rust-wasm-music-visualizer/',
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/rust-wasm-music-visualizer/',
    env: { GITHUB_ACTIONS: 'true' },
    reuseExistingServer: false,
    timeout: 60000,
  },
});
