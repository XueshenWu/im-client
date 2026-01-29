import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Define a workspace with separate configs for Main and Renderer
    projects: [
      {
        extends: true,
        test: {
          include: ['tests/main/**/*.test.ts'],
          name: 'main',
          environment: 'node', // Main process acts like a Node server
        },
      },
      {
        extends: true,
        test: {
          include: ['tests/renderer/**/*.test.ts', 'src/**/*.test.tsx'],
          name: 'renderer',
          environment: 'jsdom', // Renderer acts like a browser
        },
      },
      {
        extends:true,
        test:{
          include: ['src/**/*.test.ts'],
          name:'services',
          environment: 'node'
        }
      }
    ],
  },
});