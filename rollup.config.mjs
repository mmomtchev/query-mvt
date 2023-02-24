import typescript from '@rollup/plugin-typescript';
import inject from '@rollup/plugin-inject';
import terser from '@rollup/plugin-terser';
import executable from 'rollup-plugin-executable';

export default [
  {
    input: 'src/index.ts',
    output: {
      format: 'cjs',
      file: 'dist/cjs/index.cjs',
      sourcemap: true
    },
    plugins: [
      inject({
        fetch: 'node-fetch'
      }),
      typescript(),
      terser()
    ]
  },
  {
    input: 'src/index.ts',
    output: {
      format: 'es',
      file: 'dist/es6/index.mjs',
      sourcemap: true
    },
    plugins: [
      inject({
        fetch: 'node-fetch'
      }),
      typescript()
    ]
  },
  {
    input: 'src/index.ts',
    output: {
      format: 'es',
      file: 'dist/browser/index.js',
      sourcemap: true
    },
    plugins: [
      typescript()
    ]
  },
  {
    input: 'src/cli.ts',
    output: {
      format: 'cjs',
      file: 'dist/cli.js',
      sourcemap: true,
      banner: '#!/usr/bin/env node'
    },
    plugins: [
      typescript(),
      executable()
    ]
  }
];
