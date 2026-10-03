export type Point = [number, number];
export type Color = [number, number, number, number];
export interface Shape { points: Point[]; color: Color }
export const color = (hex: string, alpha = 1): Color => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255, alpha];
export const cssColor = (c: Color) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${c[3]})`;
const shade = (c: Color, amount: number): Color => [c[0] * amount, c[1] * amount, c[2] * amount, c[3]];
export class Painter {
  shapes: Shape[] = [];
  poly(points: Point[], fill: string | Color, alpha = 1) { this.shapes.push({ points, color: typeof fill === 'string' ? color(fill, alpha) : fill }); }
  rect(x: number, y: number, w: number, h: number, fill: string | Color, alpha = 1) { this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill, alpha); }
  circle(x: number, y: number, radius: number, fill: string | Color, alpha = 1, segments = 24) { this.poly(Array.from({ length: segments }, (_, i) => [x + Math.cos(i * Math.PI * 2 / segments) * radius, y + Math.sin(i * Math.PI * 2 / segments) * radius] as Point), fill, alpha); }
  line(x1: number, y1: number, x2: number, y2: number, width: number, fill: string | Color, alpha = 1) { const angle = Math.atan2(y2 - y1, x2 - x1); const dx = Math.sin(angle) * width / 2; const dy = Math.cos(angle) * width / 2; this.poly([[x1 - dx, y1 + dy], [x2 - dx, y2 + dy], [x2 + dx, y2 - dy], [x1 + dx, y1 - dy]], fill, alpha); }
  iso(x: number, y: number, w: number, depth: number, height: number, fill: string | Color) {
    const c = typeof fill === 'string' ? color(fill) : fill;
    this.poly([[x, y], [x + w, y + w * 0.45], [x + w, y + w * 0.45 - height], [x, y - height]], shade(c, 0.64));
    this.poly([[x + w, y + w * 0.45], [x + w + depth, y + (w - depth) * 0.45], [x + w + depth, y + (w - depth) * 0.45 - height], [x + w, y + w * 0.45 - height]], shade(c, 0.83));
    this.poly([[x, y - height], [x + w, y + w * 0.45 - height], [x + w + depth, y + (w - depth) * 0.45 - height], [x + depth, y - depth * 0.45 - height]], c);
  }
  vertices() {
    const vertices: number[] = [];
    for (const shape of this.shapes) for (let i = 1; i < shape.points.length - 1; i++) for (const p of [shape.points[0], shape.points[i], shape.points[i + 1]]) vertices.push(p[0] / 400 - 1, 1 - p[1] / 190, ...shape.color);
    return new Float32Array(vertices);
  }
}
export type SceneData = Record<string, number | string | boolean | number[]>;
const palette: Record<string, string> = { money: '#caff66', hustle: '#ffbf70', scam: '#73d5ff', media: '#bba2ff', fix: '#ffda6a', code: '#88f1d0', career: '#ffa0bd', food: '#c1e678', admin: '#80b4ff', talk: '#ffa68a', power: '#ae9bff', rescue: '#8ee2e0', music: '#ffabd5', frequency: '#7bdeff', botany: '#a9e78a' };
const star = (p: Painter, x: number, y: number, c: string, size = 7) => { p.line(x - size, y, x + size, y, 2, c); p.line(x, y - size, x, y + size, 2, c); };
function building(p: Painter, x: number, y: number, h: number, c: string, lit = true) { p.iso(x, y, 34, 38, h, c); for (let j = 0; j < Math.max(1, h / 19); j++) { p.rect(x + 10, y - h + 9 + j * 16, 6, 6, lit ? '#eaffb4' : '#374054'); p.rect(x + 23, y - h + 14 + j * 16, 5, 6, lit ? '#eaffb4' : '#374054'); } }
export function buildWorld(kind: string, data: SceneData = {}, phase = 0) {
  const p = new Painter(); const c = palette[kind] || '#caff66'; const t = phase;
  p.rect(0, 0, 800, 380, '#171c2b');
  for (let i = 0; i < 38; i++) { const x = (i * 113 + 19) % 790; const y = (i * 71 + 17) % 350; p.circle(x, y, i % 5 === 0 ? 2 : 1, c, 0.1 + (i % 3) * 0.045); }
  p.poly([[105, 270], [400, 360], [697, 267], [400, 161]], '#252e40');
  p.poly([[105, 270], [400, 360], [400, 372], [105, 282]], '#141a29');
  p.poly([[400, 360], [697, 267], [697, 279], [400, 372]], '#1c2436');
  for (let i = 0; i <= 8; i++) { p.line(105 + i * 37, 270 - i * 13.5, 400 + i * 37, 360 - i * 11.6, 1, '#48526c', 0.23); p.line(105 + i * 37, 270 + i * 11.2, 400 + i * 37, 161 + i * 13.3, 1, '#48526c', 0.23); }
  if (kind === 'music') {
    const notes = Array.isArray(data.notes) ? data.notes : [0, 2, 4, 3, 1, 5, 4, 0];
    for (let i = 0; i < 8; i++) { const height = 35 + Math.max(0, Number(notes[i * 2] ?? notes[i] ?? 0)) * 13; p.iso(210 + i * 48, 265 + i * 5, 27, 30, height, i % 2 ? '#ab83c9' : c); p.circle(225 + i * 48, 273 + i * 5, 5, '#edf5ff'); }
    p.line(221, 160, 580, 105, 3, '#ffabd5');
  } else if (kind === 'frequency') {
    const hz = Number(data.hz || 330);
    for (let i = 0; i < 64; i++) { const x = 155 + i * 8; const a = i / 64 * Math.PI * 2 * hz / 160; const b = (i + 1) / 64 * Math.PI * 2 * hz / 160; p.line(x, 188 + Math.sin(a + t) * 55, x + 8, 188 + Math.sin(b + t) * 55, 3, c); }
    p.iso(304, 316, 146, 69, 23, '#375c73'); p.circle(365, 276, 16, '#caff66'); p.circle(437, 304, 11, c);
  } else if (kind === 'botany') {
    const growth = Number(data.growth ?? 45); const count = Number(data.pots ?? 3);
    for (let i = 0; i < Math.max(1, count); i++) { const x = 256 + i * 105; const y = 269 + i * 12; p.iso(x, y, 45, 48, 35, '#a77358'); p.line(x + 41, y - 25, x + 41, y - 65 - growth * 0.45, 6, '#89c75e'); for (let leaf = 0; leaf < 3; leaf++) { const ly = y - 47 - leaf * 17 - growth * 0.2; p.poly([[x + 41, ly], [x + 12, ly - 19], [x + 14, ly + 2]], '#7aa94d'); p.poly([[x + 41, ly - 8], [x + 69, ly - 28], [x + 72, ly - 9]], '#b8e978'); } }
    p.circle(610, 95, 28, '#ffd874');
  } else if (kind === 'power') {
    const lit = data.lit !== false; const solar = Number(data.solar ?? 3); const wind = Number(data.wind ?? 2);
    for (let i = 0; i < 5; i++) building(p, 405 + (i % 3) * 57, 256 + (i % 3) * 18 - Math.floor(i / 3) * 45, 46 + i * 13, ['#66718d', '#8189a5', '#59647f'][i % 3], lit);
    p.line(297, 293, 469, 280, 4, lit ? '#caff66' : '#626e87', 0.8);
    for (let i = 0; i < Math.min(solar, 7); i++) { const x = 209 + i * 20; const y = 255 - i * 7; p.iso(x, y, 35, 29, 8, '#6876c5'); p.poly([[x, y - 8], [x + 35, y + 8], [x + 64, y - 5], [x + 29, y - 21]], '#819dff'); p.line(x + 14, y - 13, x + 49, y + 3, 1, '#d0deff'); }
    for (let i = 0; i < Math.min(wind, 4); i++) { const x = 300 + i * 43; const y = 204 - i * 18; p.line(x, y, x, y - 90, 7, '#a6b4cc'); p.circle(x, y - 90, 7, '#edf1ff'); for (let j = 0; j < 3; j++) { const a = t * 0.8 + j * Math.PI * 2 / 3; p.line(x, y - 90, x + Math.cos(a) * 35, y - 90 + Math.sin(a) * 35, 5, '#e2e7ff'); } }
    p.iso(265, 302, 35, 38, 28, '#caff66'); p.rect(273, 277, 17, 5, '#233133'); p.circle(610, 67, 21, Number(data.sun ?? 1) === 0 ? '#bdcfff' : '#ffda6a', 0.7);
  } else if (kind === 'money') {
    for (let i = 0; i < 4; i++) { const height = (Number(data.balance ?? 75) / 100 * 62 + 23) * (i + 1) / 4; p.iso(277 + i * 50, 277 + i * 15, 44, 40, height + 10, i % 2 ? '#b7e75e' : c); for (let j = 0; j < Math.floor(height / 8); j++) p.line(283 + i * 50, 270 + i * 15 - j * 8, 315 + i * 50, 284 + i * 15 - j * 8, 1, '#618238'); }
    p.iso(442, 211, 58, 60, 85, '#6c768b'); p.rect(452, 141, 36, 32, '#caff66'); p.line(461, 152, 480, 152, 3, '#344235'); p.line(461, 163, 480, 163, 3, '#344235'); p.circle(288, 147, 34, '#ffda6a'); p.circle(288, 147, 23, '#c59640'); star(p, 288, 147, '#fff2ae', 12); star(p, 548, 111, c, 8);
  } else if (kind === 'code') {
    const size = Number(data.size ?? 5); const rx = Number(data.x ?? 2); const ry = Number(data.y ?? 2); const walls = Array.isArray(data.walls) ? data.walls : [];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const px = 315 + x * 31 - y * 27; const py = 157 + x * 13 + y * 15; p.iso(px, py, 29, 27, walls.includes(y * size + x) ? 25 : 4, walls.includes(y * size + x) ? '#58647e' : (x + y) % 2 ? '#37465a' : '#435268'); }
    const px = 315 + rx * 31 - ry * 27; const py = 157 + rx * 13 + ry * 15; p.iso(px, py - 6, 26, 25, 24, c); p.rect(px + 4, py - 26, 17, 10, '#152734'); p.circle(px + 8, py - 21, 2, '#efffff'); p.circle(px + 17, py - 21, 2, '#efffff'); p.line(px + 18, py - 42, px + 18, py - 50, 3, '#efffff'); p.circle(px + 18, py - 52, 4, c); const gx = Number(data.goalX ?? size - 1); const gy = Number(data.goalY ?? 0); star(p, 315 + gx * 31 - gy * 27 + 25, 157 + gx * 13 + gy * 15 - 15, '#ffda6a', 10);
  } else if (kind === 'scam') {
    p.iso(226, 270, 80, 53, 108, '#5c7591'); p.rect(235, 159, 57, 92, '#14243b'); for (let j = 0; j < 4; j++) p.rect(241, 175 + j * 18, 39 - j * 5, 5, '#85a6c4');
    p.poly([[455, 94], [548, 129], [541, 202], [497, 249], [455, 206], [447, 128]], c); p.poly([[463, 112], [532, 137], [525, 193], [497, 226], [469, 197], [461, 139]], '#234358'); p.line(473, 170, 489, 186, 8, '#caff66'); p.line(489, 186, 517, 150, 8, '#caff66'); star(p, 355, 126, '#caff66', 10);
  } else if (kind === 'media') {
    for (let i = 0; i < 3; i++) { p.rect(234 + i * 47, 113 + i * 27, 113, 128, '#616180'); p.rect(244 + i * 47, 122 + i * 27, 93, 43, '#9990ba'); for (let j = 0; j < 4; j++) p.rect(245 + i * 47, 177 + i * 27 + j * 12, 76 - j * 7, 3, '#d4cbec'); }
    p.circle(493, 208, 55, '#7a729e'); p.circle(493, 208, 44, '#211d39'); p.circle(493, 208, 36, '#695b8e'); p.line(527, 250, 566, 296, 22, '#bba2ff'); star(p, 493, 208, '#e8d9ff', 16);
  } else if (kind === 'fix') {
    p.iso(233, 283, 130, 110, 70, '#c69350'); p.iso(238, 208, 124, 106, 8, '#ffda6a'); p.rect(356, 215, 13, 26, '#6e5a39'); p.line(461, 255, 525, 174, 20, '#8492ae'); p.circle(529, 170, 29, '#b5c3d5'); p.poly([[520, 143], [539, 151], [529, 174], [508, 165]], '#171c2b'); p.line(284, 128, 348, 155, 11, '#b5c3d5'); p.line(310, 143, 285, 202, 13, '#ff925e');
    for (let i = 0; i < 7; i++) p.line(284 + i * 14, 263 + i * 3, 284 + i * 14, 251 + i * 3, 2, '#573e21'); star(p, 581, 119, c);
  } else if (kind === 'hustle') {
    p.iso(291, 286, 111, 90, 111, '#826c55'); p.poly([[283, 175], [402, 229], [498, 185], [379, 131]], '#ffbf70'); p.rect(301, 181, 88, 36, '#eb955b'); p.rect(311, 230, 33, 40, '#273042'); p.rect(357, 246, 27, 22, '#caff66');
    for (let i = 0; i < 4; i++) p.iso(501 + i * 22, 284 + i * 5, 18, 18, 20 + i * 17 + Number(data.profit ?? 0) / 10, i % 2 ? c : '#caff66'); star(p, 252, 156, '#ffda6a', 11);
  } else if (kind === 'career') {
    p.iso(293, 276, 100, 92, 89, '#bc738f'); p.line(341, 145, 371, 158, 13, '#ffc5d8'); p.line(341, 145, 341, 168, 10, '#ffc5d8'); p.line(371, 158, 371, 181, 10, '#ffc5d8'); p.rect(358, 234, 15, 15, '#ffda6a'); p.rect(472, 113, 100, 139, '#e7dff0'); for (let i = 0; i < 5; i++) p.rect(485, 144 + i * 18, 60 - i * 5, 4, '#6c6082'); p.circle(502, 126, 8, '#b07896');
  } else if (kind === 'food') {
    p.iso(278, 290, 108, 94, 61, '#abc178'); for (let i = 0; i < 5; i++) p.line(289 + i * 18, 242 + i * 8, 289 + i * 18, 281 + i * 8, 3, '#4b623e');
    for (let i = 0; i < 6; i++) p.circle(315 + (i % 3) * 40, 227 - Math.floor(i / 3) * 39, 24, ['#e89673', '#c1e678', '#ffda6a'][i % 3]); p.line(353, 198, 353, 179, 5, '#799b59'); p.iso(468, 243, 36, 37, 73, '#e5ead5'); p.iso(472, 170, 28, 31, 10, '#8fcace'); star(p, 231, 123, c);
  } else if (kind === 'admin') {
    p.rect(253, 116, 158, 144, '#b9caff'); p.rect(253, 116, 158, 29, '#5b84cf'); for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) p.rect(267 + x * 35, 159 + y * 30, 23, 21, x === y ? '#caff66' : '#7e95c2'); p.circle(500, 216, 64, '#80b4ff'); p.circle(500, 216, 53, '#24334d'); p.line(500, 216, 500, 178, 5, '#eff5ff'); p.line(500, 216, 531, 233, 5, '#caff66');
  } else if (kind === 'talk') {
    for (let i = 0; i < 2; i++) { const x = 301 + i * 154; p.iso(x - 24, 281, 45, 45, 64, i ? '#758dc0' : '#dc957a'); p.circle(x + 15, 190, 29, i ? '#b4cdff' : '#ffc6a9'); p.circle(x + 6, 185, 2, '#293043'); p.circle(x + 21, 185, 2, '#293043'); p.line(x + 7, 202, x + 19, 202, 3, '#293043'); p.rect(x - 17, 85 + i * 16, 95, 50, i ? '#a6bcf9' : c); p.poly([[x, 131 + i * 16], [x + 16, 131 + i * 16], [x + 8, 150 + i * 16]], i ? '#a6bcf9' : c); for (let j = 0; j < 3; j++) p.circle(x + j * 18 + 13, 109 + i * 16, 4, '#394055'); }
  } else if (kind === 'rescue') {
    for (let i = 0; i < 4; i++) building(p, 257 + i * 62, 221 + i * 14, 37 + (i % 2) * 26, '#5f7c87'); p.line(258, 287, 472, 256, 12, '#8ee2e0'); p.line(472, 256, 572, 296, 12, '#8ee2e0'); for (let i = 0; i < 3; i++) { p.circle(283 + i * 106, 284 - i * 13, 10, '#caff66'); p.circle(283 + i * 106, 284 - i * 13, 4, '#1d3434'); } p.circle(555, 117, 41, '#8ee2e0'); p.poly([[555, 86], [567, 130], [555, 119], [541, 140]], '#25424b');
  }
  for (let i = 0; i < 7; i++) { const x = 150 + (i * 109) % 540; const y = 71 + (i * 53) % 183; if (i % 2) star(p, x, y + Math.sin(t + i) * 2, c, 4); }
  return p;
}
