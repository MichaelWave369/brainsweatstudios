import { build } from 'vite';
const result = await build({ configFile: false, logLevel: 'error', build: { ssr: 'src/runtime/harness.ts', write: false, minify: false, rollupOptions: { output: { codeSplitting: false } } } });
const output = Array.isArray(result) ? result[0].output : result.output;
const entry = output.find(item => item.type === 'chunk' && item.isEntry);
const { runHarness } = await import('data:text/javascript;base64,' + Buffer.from(entry.code).toString('base64'));
console.log(JSON.stringify(runHarness(Number(process.argv[2] || 1000)), null, 2));
