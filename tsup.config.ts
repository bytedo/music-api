import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  bundle: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  outDir: 'dist',
  // 把 axios / cheerio 一并打进产物，使 dist 自包含、运行镜像无需 node_modules
});
