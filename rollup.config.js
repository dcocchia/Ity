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

function moduleBuild(name, input, external = []) {
  const isCoreExternal = (id) => id === './Ity' || /[/\\]Ity(\.ts)?$/.test(id);
  return {
    input,
    external(id) {
      return isCoreExternal(id) || external.includes(id);
    },
    plugins: [transpileTypeScript()],
    output: [
      {
        file: `dist/${name}.cjs.js`,
        format: 'cjs',
        exports: 'named',
        sourcemap: true,
        paths(id) {
          if (isCoreExternal(id)) return './ity.cjs.js';
          return id;
        }
      },
      {
        file: `dist/${name}.esm.mjs`,
        format: 'es',
        sourcemap: true,
        paths(id) {
          if (isCoreExternal(id)) return './ity.esm.mjs';
          return id;
        }
      }
    ]
  };
}

function dtsBuild(name) {
  return {
    input: `types/${name}.d.ts`,
    plugins: [dts()],
    output: {
      file: `dist/${name}.d.ts`,
      format: 'es'
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
  moduleBuild('query', 'query.ts', ['./Ity']),
  moduleBuild('forms', 'forms.ts', ['./Ity']),
  moduleBuild('react', 'react.ts', ['./Ity', 'react']),
  dtsBuild('Ity'),
  dtsBuild('query'),
  dtsBuild('forms'),
  dtsBuild('react')
];
