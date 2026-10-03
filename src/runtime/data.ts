// Data-only validation shared by browser, headless tests and the Deno server.
export const plain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
export const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
export const integer = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
export const finite = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
export function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
export function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
}
export function canonical(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + Array.from(value, canonical).join(',') + ']';
  if (plain(value)) return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  throw new Error('Expected finite, serializable data.');
}
export function parseJSON(text: string, maxBytes: number): unknown {
  if (new TextEncoder().encode(text).length > maxBytes) throw new Error('This file exceeds the import limit.');
  return JSON.parse(text);
}
// Synchronous SHA-256 avoids browser/Node/Deno-specific dependencies. Hashes
// identify data; they are not signatures or permission to trust imported data.
const K = Array.from({ length: 64 }, (_, i) => {
  let candidate = 2, found = -1;
  while (true) { let prime = true; for (let d = 2; d * d <= candidate; d++) if (candidate % d === 0) { prime = false; break; }
    if (prime && ++found === i) return Math.floor((Math.cbrt(candidate) % 1) * 2 ** 32) >>> 0;
    candidate++;
  }
});
const rotate = (v: number, n: number) => v >>> n | v << (32 - n);
export function sha256(text: string): string {
  const input = new TextEncoder().encode(text), bytes = new Uint8Array(Math.ceil((input.length + 9) / 64) * 64);
  bytes.set(input); bytes[input.length] = 128;
  const view = new DataView(bytes.buffer); view.setUint32(bytes.length - 4, input.length * 8, false);
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], w = new Uint32Array(64);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2]; w[i] = (w[i - 16] + (rotate(a, 7) ^ rotate(a, 18) ^ a >>> 3) + w[i - 7] + (rotate(b, 17) ^ rotate(b, 19) ^ b >>> 10)) >>> 0; }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + (e & f ^ ~e & g) + K[i] + w[i]) >>> 0;
      const t2 = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + (a & b ^ a & c ^ b & c)) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, hh].forEach((v, i) => { h[i] = (h[i] + v) >>> 0; });
  }
  return h.map(v => v.toString(16).padStart(8, '0')).join('');
}
export const hash = (value: unknown) => sha256(canonical(value));
