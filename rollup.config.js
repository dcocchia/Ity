import typescript from '@rollup/plugin-typescript';
import { terser } from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';

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
  },
  {
    input: 'Ity.ts',
    plugins: [dts()],
    output: {
      file: 'dist/ity.d.ts',
      format: 'es'
    }
  }
];
