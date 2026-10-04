import { build } from 'vite';
export async function agentModule(entry) {
  const result = await build({ configFile: false, logLevel: 'error', build: { ssr: entry, write: false, minify: false, rollupOptions: { output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0].output : result.output;
  const chunk = output.find(item => item.type === 'chunk' && item.isEntry);
  return import('data:text/javascript;base64,' + Buffer.from(chunk.code).toString('base64'));
}
