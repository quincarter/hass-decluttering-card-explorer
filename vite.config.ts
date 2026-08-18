import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
    lib: {
      entry: 'src/decluttering-explorer-card.ts',
      formats: ['es'],
      fileName: () => 'decluttering-explorer-card.js',
    },
    minify: true,
  },
});
