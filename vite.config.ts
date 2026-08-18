import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
    lib: {
      entry: 'src/decluttering-selector.ts',
      formats: ['es'],
      fileName: () => 'decluttering-selector.js',
    },
    minify: true,
  },
  test: {
    environment: 'happy-dom',
  },
});
