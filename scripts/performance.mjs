import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { agentModule } from './agent-module.mjs';
const args = process.argv.slice(2), command = args.shift() ?? 'run';
const option = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
const { performanceCommand } = await agentModule('src/performance/cli.ts');
const input = option('--input') ? await readFile(resolve(option('--input')), 'utf8') : null;
const result = await performanceCommand(command, args, input);
if (command === 'render') {
  if (!option('--out')) throw new Error('Choose --out DIRECTORY for local audio exports.');
  const directory = resolve(option('--out')); await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'performance.wav'), result.wav);
  await writeFile(join(directory, 'performance.mid'), result.midi);
  await writeFile(join(directory, 'audio-receipt.json'), JSON.stringify(result.receipt, null, 2));
  console.log(JSON.stringify({ directory, duration: result.duration, receipt: result.receipt }, null, 2));
} else if (option('--out')) {
  await writeFile(resolve(option('--out')), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ output: resolve(option('--out')), verified: command === 'run' || command === 'verify' }));
} else console.log(JSON.stringify(result, null, 2));
