import { jsx as reactJsx, jsxs as reactJsxs } from 'react/jsx-runtime';
import { translate } from './translate';
import type { ReactElement } from 'react';
export { Fragment } from 'react/jsx-runtime';
export type { JSX } from 'react/jsx-runtime';

function originalText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(originalText).join(' ');
  if (value && typeof value === 'object' && 'props' in value) {
    const props = (value as ReactElement<Record<string, unknown>>).props;
    return String(props['data-source-text'] || originalText(props.children));
  }
  return '';
}
const plainText = (value: unknown) => typeof value === 'string' || typeof value === 'number';
const rawTextElements = new Set(['pre', 'code', 'script', 'style']);

function localize(type: unknown, props: unknown) {
  if (typeof type !== 'string' || !props || typeof props !== 'object' || rawTextElements.has(type)) return props;
  if ((props as Record<string, unknown>).translate === 'no') return props;
  const p = { ...props } as Record<string, unknown>;
  const children = p.children;
  const primitiveChildren = plainText(children) || (Array.isArray(children) && children.every(plainText));
  // Keep English labels for the deterministic bots. Limit recursive extraction
  // to their controls/notices instead of duplicating whole pages in attributes.
  const botSurface = type === 'button' || type === 'label' || (typeof p.className === 'string' && /\bnotice\b/.test(p.className));
  if (primitiveChildren || botSurface) {
    const source = originalText(children).trim();
    if (source) p['data-source-text'] = source;
  }
  if (typeof p['aria-label'] === 'string') p['data-source-label'] = p['aria-label'];
  if (typeof children === 'string') p.children = translate(children);
  else if (Array.isArray(children)) {
    // A simple mixed number/text message can be localized as a whole, keeping
    // grammar and counters together. React elements retain their semantics.
    const sourceMessage = primitiveChildren ? children.join('') : '';
    const message = sourceMessage ? translate(sourceMessage) : sourceMessage;
    p.children = primitiveChildren && message !== sourceMessage ? [message] : children.map(v => typeof v === 'string' ? translate(v) : v);
  }
  for (const key of ['aria-label', 'placeholder', 'title']) if (typeof p[key] === 'string') p[key] = translate(p[key]);
  return p;
}
export function jsx(...args: Parameters<typeof reactJsx>) { return reactJsx(args[0], localize(args[0], args[1]), args[2]); }
export function jsxs(...args: Parameters<typeof reactJsxs>) { return reactJsxs(args[0], localize(args[0], args[1]), args[2]); }
export { localize };
