import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

// Read literal catalogue structure without executing UI/profile modules in the
// build config. Unsupported catalogue shapes fail the build, not silently drift.
async function countArray(file, name) {
  const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true), imports = new Map();
  for (const statement of source.statements) if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)) for (const entry of statement.importClause.namedBindings.elements) imports.set(entry.name.text, { file: path.resolve(path.dirname(file), statement.moduleSpecifier.text + '.ts'), name: entry.propertyName?.text || entry.name.text });
  for (const statement of source.statements) if (ts.isVariableStatement(statement)) for (const variable of statement.declarationList.declarations) if (ts.isIdentifier(variable.name) && variable.name.text === name && variable.initializer && ts.isArrayLiteralExpression(variable.initializer)) {
    let total = 0;
    for (const element of variable.initializer.elements) {
      if (!ts.isSpreadElement(element)) { total++; continue; }
      const value = element.expression;
      if (ts.isIdentifier(value) && imports.has(value.text)) { const imported = imports.get(value.text); total += await countArray(imported.file, imported.name); }
      else if (ts.isCallExpression(value) && ts.isPropertyAccessExpression(value.expression) && value.expression.name.text === 'map' && ts.isIdentifier(value.expression.expression) && value.expression.expression.text === 'games') total += await countArray(path.resolve('src/data/games.ts'), 'games');
      else throw new Error(`Unsupported catalogue spread in ${file}: ${name}`);
    }
    return total;
  }
  throw new Error(`Missing literal catalogue ${name} in ${file}`);
}
export async function readCatalogue() {
  const release = JSON.parse(await readFile('src/data/release.json', 'utf8')), games = await readFile('src/data/games.ts', 'utf8');
  const missions = games.match(/export const MISSIONS_PER_WORLD = (\d+);/);
  if (!missions) throw new Error('Missing missions-per-world constant.');
  const [worlds, classes, badges, modes] = await Promise.all([countArray(path.resolve('src/data/games.ts'), 'games'), countArray(path.resolve('src/data/classes.ts'), 'courses'), countArray(path.resolve('src/systems/progress.ts'), 'badges'), countArray(path.resolve('src/data/types.ts'), 'DIFFICULTIES')]);
  return { ...release, worlds, classes, badges, slots: worlds * Number(missions[1]) * modes };
}
export const description = studio => `Play smarter. Live smarter. ${studio.worlds} free game worlds, ${studio.classes} hands-on classes, and a local agent simulation lab. Explore practical skills, STEM, building, and survival. No account needed for local play.`;
