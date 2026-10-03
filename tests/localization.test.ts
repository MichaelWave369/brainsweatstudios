import { afterEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { getLocale, setLocale, translate } from '../src/i18n/translate';
import { jsx, jsxs, localize } from '../src/i18n/jsx-runtime';
import { games } from '../src/data/games';
import { guidance } from '../src/systems/coach';
import type { ReactElement } from 'react';

const propsOf = (element: ReactElement) => element.props as Record<string, unknown>;

afterEach(() => setLocale('en'));
describe('Spanish interface and authored guidance', () => {
  it('keeps the English interface unchanged and preserves meaningful whitespace', () => {
    expect(getLocale()).toBe('en'); expect(translate('  Money Mission ')).toBe('  Money Mission ');
    setLocale('es'); expect(translate('  Money Mission ')).toBe('  Misión Dinero ');
    expect(translate('  440 Hz ')).toBe('  440 Hz ');
  });
  it('covers every world, description, skill, and council recommendation', () => {
    setLocale('es');
    for (const game of games) {
      expect(translate(game.title)).not.toBe(game.title);
      expect(translate(game.description)).not.toBe(game.description);
      const coach = guidance[game.id];
      for (const message of [coach.hint, coach.resources, coach.mistake, ...coach.steps]) expect(translate(message)).not.toBe(message);
    }
  });
  it('translates dynamic mission and control labels without changing model values', () => {
    setLocale('es');
    expect(translate('Start mission 8')).toBe('Iniciar misión 8');
    expect(translate('Step 2 of 3')).toBe('Paso 2 de 3');
    expect(translate('Complete two missions in Botany Garden')).toBe('Completa dos misiones en Jardín Botánico');
    expect(translate('Decrease Leafy herb')).toBe('Reducir Hierba de hojas verdes');
    expect(translate('Score 80 in Frequency Lab')).toBe('Logra 80 puntos en Laboratorio de Frecuencias');
  });
  it('localizes nested feedback, catalog templates, and joined warning labels', () => {
    setLocale('es');
    const nested = translate('Week 2: Compared options and asked for help. A practical alternative costs $50.');
    expect(nested).toMatch(/^Semana 2:/); expect(nested).not.toContain('Compared'); expect(nested).toContain('$50');
    expect(translate('Asks for a password · Rushes your decision')).toBe('Pide una contraseña · Apresura tu decisión');
    expect(translate('MONEY & BUSINESS')).toBe('DINERO Y NEGOCIOS');
    expect(translate('0 of 36 badges discovered. Every reward comes from something you do.')).toContain('0 de 36');
    expect(translate('You reached trusted help, made 4 practical decisions, and carried 2 useful resources for this situation.')).toContain('recursos útiles para la situación: 2.');
  });
  it('keeps raw code, fictional domains, and unknown proper names intact', () => {
    setLocale('es');
    expect(translate('Alex Rivera')).toBe('Alex Rivera');
    expect(translate('school.example.invalid')).toBe('school.example.invalid');
    const code = { children: 'Add right command', title: 'Code Quest' };
    expect(localize('code', code)).toBe(code);
  });
  it('keeps long unknown imported logs intact without expensive template matching', () => {
    setLocale('es');
    const unknown = 'Day 1: x. Day 2: x · '.repeat(700).slice(0, 12000);
    const started = performance.now();
    expect(translate(unknown)).toBe(unknown);
    expect(performance.now() - started).toBeLessThan(50);
    expect(translate(`Day 1: ${'x'.repeat(500)}`)).toBe(`Día 1: ${'x'.repeat(500)}`);
  });
});
describe('JSX localization preserves controls and rendering semantics', () => {
  it('preserves React static-child arrays and translates fragments when no full template exists', () => {
    setLocale('es');
    const element = jsxs('p', { children: [90, ' XP to your next level'] });
    expect(Array.isArray(propsOf(element).children)).toBe(true);
    expect(renderToStaticMarkup(element)).toContain('90 XP hasta tu siguiente nivel');
    const mission = jsxs('h2', { children: ['Mission ', 8] });
    expect(Array.isArray(propsOf(mission).children)).toBe(true);
    expect(renderToStaticMarkup(mission)).toContain('Misión 8');
  });
  it('retains English bot labels while translating visible and accessible labels', () => {
    setLocale('es');
    const element = jsxs('button', { 'aria-label': 'Add right command', children: [jsx('strong', { children: 'Start the month' }), jsx('small', { children: 'Your next step' })] });
    expect(propsOf(element)['data-source-label']).toBe('Add right command');
    expect(propsOf(element)['aria-label']).toBe('Añadir comando derecha');
    expect(propsOf(element)['data-source-text']).toBe('Start the month Your next step');
    expect(renderToStaticMarkup(element)).toContain('Empezar el mes');
  });
  it('avoids copying whole pages into source-label attributes', () => {
    setLocale('es');
    const child = jsx('p', { children: 'Your next step' });
    const page = jsx('main', { children: child });
    expect(propsOf(page)['data-source-text']).toBeUndefined();
    expect(propsOf(child)['data-source-text']).toBe('Your next step');
  });

  it('keeps profile nicknames verbatim when translation is disabled', () => { setLocale('es'); expect(localize('option', { children: 'Music', translate: 'no' })).toEqual({ children: 'Music', translate: 'no' }); });
});
