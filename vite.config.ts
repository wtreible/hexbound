/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// Project Pages are served from /<repo>/. Change this if the repo is renamed (DESIGN.md §3).
export default defineConfig({
  base: '/hexbound/',
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
