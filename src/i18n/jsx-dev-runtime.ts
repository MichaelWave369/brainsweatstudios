import { jsxDEV as reactJsxDEV } from 'react/jsx-dev-runtime';
import { localize } from './jsx-runtime';
export { Fragment } from 'react/jsx-dev-runtime';
export type { JSX } from 'react/jsx-dev-runtime';
export function jsxDEV(...args: Parameters<typeof reactJsxDEV>) { return reactJsxDEV(args[0], localize(args[0], args[1]), args[2], args[3], args[4], args[5]); }
