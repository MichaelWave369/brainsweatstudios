import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd(); const packages = [];
async function visitModules(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const location = path.join(directory, entry.name);
    if (entry.name.startsWith('@')) { await visitModules(location); continue; }
    try { const pkg = JSON.parse(await readFile(path.join(location, 'package.json'), 'utf8')); packages.push({ name: pkg.name, version: pkg.version, license: typeof pkg.license === 'string' ? pkg.license : pkg.license?.type || 'UNSPECIFIED', location }); } catch { /* Not a package directory. */ }
    try { await visitModules(path.join(location, 'node_modules')); } catch { /* No nested dependencies. */ }
  }
}
await visitModules(path.join(root, 'node_modules'));
packages.sort((a, b) => a.name.localeCompare(b.name));
const runtime = new Set(['react', 'react-dom', 'scheduler', 'lucide-react']);
const table = packages.map(pkg => `| ${pkg.name} | ${pkg.version} | ${pkg.license} | ${runtime.has(pkg.name) ? 'Runtime' : 'Development / build'} |`).join('\n');
let notices = '# Third-party notices\n\nBrain Sweat Studio’s original code, geometric artwork, and procedural sound are MIT licensed. Third-party packages retain their own licenses. No external photography, fonts, audio files, or copyrighted game assets are included.\n\nThe application has only React, React DOM, Scheduler, and Lucide as runtime dependencies; all use the MIT license. The build and testing toolchain also uses the licenses listed below.\n\n| Package | Version | License | Use |\n| --- | --- | --- | --- |\n' + table + '\n\n## Runtime license texts\n\n';
for (const pkg of packages.filter(pkg => runtime.has(pkg.name))) {
  const files = await readdir(pkg.location); const license = files.find(file => /^(license|licence)(\.md|\.txt)?$/i.test(file));
  if (license) notices += `### ${pkg.name} ${pkg.version}\n\n\`\`\`text\n${await readFile(path.join(pkg.location, license), 'utf8')}\n\`\`\`\n\n`;
}
await writeFile('THIRD_PARTY_NOTICES.md', notices);
const unknown = packages.filter(pkg => pkg.license === 'UNSPECIFIED');
console.log(JSON.stringify({ packages: packages.length, licenses: [...new Set(packages.map(pkg => pkg.license))], unspecified: unknown.map(pkg => pkg.name) }));
if (unknown.length) process.exitCode = 1;
