import fs from 'fs';
import path from 'path';
import { parse } from 'acorn';

const dir = process.argv[2] || '.';
const outFile = process.env.HOME
  ? path.join(process.env.HOME, 'Archy', 'dependancyMap.txt')
  : path.join('C:\\', 'Users', process.env.USERNAME, 'Archy', 'dependancyMap.txt');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.mjs'));

let output = '';

for (const file of files) {
  const code = fs.readFileSync(path.join(dir, file), 'utf-8');
  let ast;
  try {
    ast = parse(code, { ecmaVersion: 2022, sourceType: 'module' });
  } catch (err) {
    console.error(`\n❌ Error parsing ${file}:\n  ${err.message}\n  (line ${err.loc?.line}, col ${err.loc?.column})`);
    continue; // Skip broken file, do not throw
  }

  const imports = [];
  const exports = [];

  for (const node of ast.body) {
    if (node.type === 'ImportDeclaration') {
      imports.push(node.source.value);
    } else if (node.type === 'ExportNamedDeclaration') {
      if (node.declaration) {
        if (node.declaration.type === 'FunctionDeclaration') {
          exports.push(node.declaration.id.name);
        } else if (node.declaration.declarations) {
          for (const d of node.declaration.declarations) {
            exports.push(d.id.name);
          }
        }
      }
      if (node.specifiers) {
        for (const s of node.specifiers) {
          exports.push(s.exported.name);
        }
      }
    }
  }

  output += `\n📄 ${file}\n`;
  output += `  📥 Imports: ${imports.join(', ') || '(none)'}\n`;
  output += `  📤 Exports: ${exports.join(', ') || '(none)'}\n`;
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, output, 'utf-8');
console.log(`Dependency map written to ${outFile}`);
