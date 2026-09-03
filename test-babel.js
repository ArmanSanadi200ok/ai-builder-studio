const Babel = require('@babel/standalone');
const code = "import { Button } from './components/Button';";
function resolveRelativePath(basePath, relativePath) {
  const parts = basePath.split('/');
  parts.pop();
  const relParts = relativePath.split('/');
  for (const part of relParts) {
    if (part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}
const rewriteImportsPlugin = function() {
  return {
    visitor: {
      ImportDeclaration(path, state) {
        const source = path.node.source.value;
        if (source.startsWith('.')) {
          let resolvedPath = resolveRelativePath(state.filename, source);
          if (resolvedPath.startsWith('./')) resolvedPath = resolvedPath.substring(2);
          if (resolvedPath.startsWith('/')) resolvedPath = resolvedPath.substring(1);
          path.node.source.value = '@local/' + resolvedPath;
        }
      }
    }
  };
};
Babel.registerPlugin('rewrite-imports', rewriteImportsPlugin);
const transpiled = Babel.transform(code, { filename: 'src/main.tsx', plugins: ['rewrite-imports'] }).code;
console.log(transpiled);
