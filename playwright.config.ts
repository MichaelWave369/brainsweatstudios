import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', timeout: 45000, fullyParallel: false,
  use: { baseURL: process.env.TEST_BASE_URL || 'http://127.0.0.1:5173', headless: true, viewport: { width: 1440, height: 1000 } },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } } },
    ...(process.env.CROSS_BROWSER === '1' ? [
      { name: 'firefox', testMatch: /(?:accessibility|features)\.spec\.ts/, use: { browserName: 'firefox' as const, launchOptions: { executablePath: process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH || undefined } } },
      { name: 'webkit', testMatch: /(?:accessibility|features)\.spec\.ts/, use: { browserName: 'webkit' as const, launchOptions: { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH || undefined } } },
    ] : []),
  ],
  webServer: process.env.TEST_BASE_URL ? undefined : { command: process.env.TEST_PRODUCTION === '1' ? 'node scripts/test-server.mjs' : 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
  reporter: [['list']],
});
