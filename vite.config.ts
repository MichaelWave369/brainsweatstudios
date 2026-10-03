import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'serve' ? '/' : (process.env.VITE_BASE_PATH || '/brainsweatstudios/'),
  build: { target: 'es2022', sourcemap: false },
  test: { include: ['tests/unit.test.ts'], environment: 'node' },
}));
