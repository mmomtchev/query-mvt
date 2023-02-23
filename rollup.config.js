import typescript from '@rollup/plugin-typescript';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';

export default [
  {
    input: 'src/index.ts',
    output: {
      format: 'cjs',
      file: 'dist/cjs/index.cjs',
      sourcemap: true
    },
    plugins: [
      replace({
        '//useFetch': 'import fetch from \'node-fetch\';',
        preventAssignment: true
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
      replace({
        '//useFetch': 'import fetch from \'node-fetch\';',
        preventAssignment: true
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
      replace({
        '//useFetch': 'import fetch from \'node-fetch\';',
        preventAssignment: true
      }),
      typescript()
    ]
  }
];
