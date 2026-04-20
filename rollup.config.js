const ts = require('typescript');
const terser = require('@rollup/plugin-terser');
const dts = require('rollup-plugin-dts').default;

function transpileTypeScript() {
  return {
    name: 'transpile-typescript',
    transform(code, id) {
      if (!id.endsWith('.ts')) return null;
      const result = ts.transpileModule(code, {
        fileName: id,
        compilerOptions: {
          target: ts.ScriptTarget.ES2019,
          module: ts.ModuleKind.ESNext,
          esModuleInterop: true,
          sourceMap: true
        }
      });
      return {
        code: result.outputText,
        map: result.sourceMapText ? JSON.parse(result.sourceMapText) : null
      };
    }
  };
}

module.exports = [
  {
    input: 'Ity.ts',
    plugins: [transpileTypeScript()],
    output: [
      { file: 'dist/ity.js', format: 'iife', name: 'Ity', exports: 'named', sourcemap: true },
      { file: 'dist/ity.cjs.js', format: 'cjs', exports: 'named', sourcemap: true },
      { file: 'dist/ity.esm.js', format: 'es', sourcemap: true },
      { file: 'dist/ity.esm.mjs', format: 'es', sourcemap: true }
    ]
  },
  {
    input: 'Ity.ts',
    plugins: [transpileTypeScript(), terser()],
    output: {
      file: 'dist/ity.min.js',
      format: 'iife',
      name: 'Ity',
      exports: 'named',
      sourcemap: true
    }
  },
  {
    input: 'types/Ity.d.ts',
    plugins: [dts()],
    output: {
      file: 'dist/ity.d.ts',
      format: 'es'
    }
  }
];
