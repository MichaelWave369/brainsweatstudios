import es from './es.json' with { type: 'json' };
import rungFour from './rung4.json' with { type: 'json' };
import academy from './academy.json' with { type: 'json' };
import runtime from './runtime.json' with { type: 'json' };
import garage from './garage.json' with { type: 'json' };
import worlds from './worlds.json' with { type: 'json' };
import career from './career.json' with { type: 'json' };
import families from './families.json' with { type: 'json' };

let locale: 'en' | 'es' = 'en';
export const setLocale = (next: 'en' | 'es') => { locale = next; };
export const getLocale = () => locale;
const dictionary:Record<string,string> = {...es,...rungFour,...academy,...runtime,...garage,...worlds,...career,...families};
const uppercaseDictionary = new Map(Object.entries(dictionary).map(([source, target]) => [source.toUpperCase(), target.toLocaleUpperCase('es')]));
const escapePattern = (part: string) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
interface MessageTemplate { expression: RegExp; translation: string; groups: number[][]; prefix: string; specificity: number }
// Build each message pattern once. Placeholders preserve numbers, names, and model
// values; translations can reorder or omit English-only plural suffixes.
const templates: MessageTemplate[] = Object.entries(dictionary).flatMap(([source, translation]) => {
  const placeholders = [...source.matchAll(/(?:\{\d+\})+/g)];
  if (!placeholders.length || !/[A-Za-z]/.test(source.replace(/\{\d+\}/g, ''))) return [];
  let expression = '^'; let previous = 0;
  for (const placeholder of placeholders) {
    expression += escapePattern(source.slice(previous, placeholder.index)) + '(.*?)';
    previous = placeholder.index! + placeholder[0].length;
  }
  expression += escapePattern(source.slice(previous)) + '$';
  const groups = placeholders.map(p => [...p[0].matchAll(/\{(\d+)\}/g)].map(match => Number(match[1])));
  return [{ expression: new RegExp(expression), translation, groups, prefix: source.slice(0, placeholders[0].index), specificity: source.replace(/\{\d+\}/g, '').length }];
}).sort((a, b) => b.specificity - a.specificity);

function localized(text: string, depth = 0): string {
  if (!text || depth > 3) return text;
  const direct = dictionary[text];
  if (direct !== undefined) return direct;
  // Imported logs and player-authored text are not translation instructions.
  // Keep unusually long unknown strings intact rather than matching templates.
  if (text.length > 2000) return text;
  if (text === text.toUpperCase() && uppercaseDictionary.has(text)) return uppercaseDictionary.get(text)!;
  for (const template of templates) {
    if (template.prefix && !text.startsWith(template.prefix)) continue;
    const matched = text.match(template.expression);
    if (!matched) continue;
    // Adjacent placeholders have no visible boundary. Capture their combined
    // text once; independently matching them causes polynomial backtracking on
    // long unknown log entries. The first slot keeps the group, others are empty.
    const values = new Map(template.groups.flatMap((group, n) => group.map((index, part) => [index, part === 0 ? matched[n + 1] : ''] as const)));
    return template.translation.replace(/\{(\d+)\}/g, (placeholder, index: string) => {
      const value = values.get(Number(index));
      if (value === undefined) return placeholder;
      // Captured proper names and units remain unchanged unless the catalog has
      // an intentional display translation, such as a world or skill title.
      return value === text ? value : localized(value, depth + 1);
    });
  }
  const patterns: [RegExp, (...parts: string[]) => string][] = [
    [/^Mission (\d+)(.*)$/, (n, tail) => `Misión ${n}${localized(tail, depth + 1)}`],
    [/^Start mission (\d+)$/, n => `Iniciar misión ${n}`],
    [/^Day (\d+)(.*)$/, (n, tail) => `Día ${n}${localized(tail, depth + 1)}`],
    [/^Turn (\d+)(.*)$/, (n, tail) => `Turno ${n}${localized(tail, depth + 1)}`],
    [/^Level (\d+)(.*)$/, (n, tail) => `Nivel ${n}${localized(tail, depth + 1)}`],
    [/^Score (\d+) in (.+)$/, (n, game) => `Logra ${n} puntos en ${localized(game, depth + 1)}`],
    [/^Complete (one|two) missions? in (.+)$/, (n, game) => `Completa ${n === 'one' ? 'una misión' : 'dos misiones'} en ${localized(game, depth + 1)}`],
    [/^(.+) Master$/, game => `Maestría en ${localized(game, depth + 1)}`],
    [/^Best: (.*)$/, n => `Mejor: ${n}`],
    [/^(Add|Increase|Decrease|Collect|Plant) (.+)$/, (action, value) => `${({ Add: 'Añadir', Increase: 'Aumentar', Decrease: 'Reducir', Collect: 'Recoger', Plant: 'Plantar' } as Record<string, string>)[action]} ${localized(value, depth + 1)}`],
    [/^(.+), (current location|closed path|adjacent)$/, (name, state) => `${localized(name, depth + 1)}, ${localized(state, depth + 1)}`],
    [/^(\d+) of (\d+) badges discovered\. Every reward comes from something you do\.$/, (n, total) => `${n} de ${total} insignias descubiertas. Cada premio viene de algo que haces.`],
    [/^Complete a (.+) mission\.$/, game => `Completa una misión de ${localized(game, depth + 1)}.`],
    [/^Score 90 or more in (.+)\.$/, game => `Logra 90 puntos o más en ${localized(game, depth + 1)}.`],
    [/^(\d+) missions to go$/, n => `Faltan ${n} misiones`],
    [/^Step (\d+) of (\d+)$/, (n, total) => `Paso ${n} de ${total}`],
  ];
  for (const [pattern, convert] of patterns) {
    const match = text.match(pattern);
    if (match) return convert(...match.slice(1));
  }
  if (text.includes(' · ')) return text.split(' · ').map(part => localized(part, depth + 1)).join(' · ');
  return text;
}
export function translate(text: string): string {
  if (locale === 'en' || !/[A-Za-z]/.test(text)) return text;
  const trimmed = text.trim();
  return trimmed ? text.replace(trimmed, localized(trimmed)) : text;
}
