import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: false,
    outExtension({ format }) {
      return {
        js: format === 'esm' ? '.mjs' : '.cjs',
      };
    },
  },
  {
    entry: ['src/cli.ts'],
    format: ['cjs'],
    banner: {
      js: '#!/usr/bin/env node',
    },
    outExtension() {
      return {
        js: '.cjs',
      };
    },
  },
]);

