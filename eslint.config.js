import js from '@eslint/js';
import ts from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
export default ts.config(
  { ignores: ['dist/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  { files: ['**/*.ts', '**/*.tsx'], plugins: { 'react-hooks': hooks }, languageOptions: { globals: { window: 'readonly', document: 'readonly', localStorage: 'readonly', console: 'readonly', Blob: 'readonly', URL: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly', requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly', performance: 'readonly', AudioContext: 'readonly', File: 'readonly', navigator: 'readonly', KeyboardEvent: 'readonly', HTMLInputElement: 'readonly', HTMLSelectElement: 'readonly' } }, rules: { 'react-hooks/rules-of-hooks': 'error', '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }], '@typescript-eslint/no-explicit-any': 'error' } }
);
