import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';

export default [
  {
    input: 'Ity.ts',
    plugins: [typescript()],
    output: [
      { file: 'dist/ity.js', format: 'iife', name: 'Ity', sourcemap: true },
      { file: 'dist/ity.cjs.js', format: 'cjs', sourcemap: true },
      { file: 'dist/ity.esm.js', format: 'es', sourcemap: true }
    ]
  },
  {
    input: 'Ity.ts',
    plugins: [typescript(), terser()],
    output: {
      file: 'dist/ity.min.js',
      format: 'iife',
      name: 'Ity',
      sourcemap: true
    }
  }
];
