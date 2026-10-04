import { exact, plain } from '../runtime/data.ts';
import { assertData } from '../worlds/compiler.ts';
import { demand } from '../career/validation.ts';
import { CIRCUIT_LIMITS, type CircuitSave } from './types.ts';
import { validateCircuit } from './evidence.ts';

// Storage-only LZW over UTF-8, with a fixed 16-bit dictionary and explicit reset.
// Exports retain the original native JSON; compression never changes evidence.
const RESET = 256, FIRST = 257, LAST = 65535;
export function encodeCircuitStorage(save: CircuitSave) {
    const bytes = new TextEncoder().encode(JSON.stringify(validateCircuit(save))), codes: number[] = [];
    let dictionary = new Map<string, number>(), next = FIRST, word = '';
    for (const byte of bytes) {
        const char = String.fromCharCode(byte), combined = word + char;
        if (!word || dictionary.has(combined)) word = combined;
        else {
            codes.push(word.length === 1 ? word.charCodeAt(0) : dictionary.get(word)!);
            if (next <= LAST) dictionary.set(combined, next++);
            else { codes.push(RESET); dictionary = new Map(); next = FIRST; }
            word = char;
        }
    }
    if (word) codes.push(word.length === 1 ? word.charCodeAt(0) : dictionary.get(word)!);
    let binary = ''; for (const code of codes) binary += String.fromCharCode(code >> 8, code & 255);
    return { schema: 'circuit-storage@1', data: btoa(binary) };
}
export function decodeCircuitStorage(value: unknown): CircuitSave {
    assertData(value, CIRCUIT_LIMITS.bytes * 3, 8, 2);
    demand(plain(value) && exact(value, ['schema', 'data']) && value.schema === 'circuit-storage@1' && typeof value.data === 'string' && /^[A-Za-z0-9+/]*={0,2}$/.test(value.data), 'Invalid Circuit storage encoding.');
    const binary = atob(value.data); demand(binary.length % 2 === 0, 'Truncated Circuit storage.');
    let dictionary: string[] = [], next = FIRST, word = '', count = 0;
    const output: string[] = [];
    for (let i = 0; i < binary.length; i += 2) {
        const code = binary.charCodeAt(i) * 256 + binary.charCodeAt(i + 1);
        if (code === RESET) { dictionary = []; next = FIRST; word = ''; continue; }
        const entry = code < 256 ? String.fromCharCode(code) : dictionary[code] ?? (code === next && word ? word + word[0] : undefined);
        demand(entry !== undefined, 'Invalid Circuit storage dictionary.');
        count += entry.length; demand(count <= CIRCUIT_LIMITS.bytes, 'Expanded Circuit storage exceeds its archive limit.'); output.push(entry);
        if (word && next <= LAST) dictionary[next++] = word + entry[0];
        word = entry;
    }
    const text = output.join(''), bytes = Uint8Array.from(text, char => char.charCodeAt(0));
    return validateCircuit(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
}
