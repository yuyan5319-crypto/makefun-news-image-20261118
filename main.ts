// The Orbit — one image that sums up Wednesday 18 November 2026.
//
// Node 22, standard library only, no network. Draws a newspaper front page
// pixel by pixel (own PNG encoder, own rasteriser, own 5x7 bitmap type) and
// writes it to /output/entry.png (MAKEFUN_OUTPUT_DIR stands in locally).
// Fully deterministic: two runs write the same bytes.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------- font ----
// A 5x7 bitmap typeface, one string per row, '#' is ink. Authored for this
// entry; covers A-Z, 0-9 and the punctuation the page needs.
const GLYPHS: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '.#.#.', '..#..', '..#..', '..#..', '.#.#.', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#..##', '#.#.#', '##..#', '#...#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '#####'],
  '2': ['.###.', '#...#', '....#', '..##.', '.#...', '#....', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '.##..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.#...'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'],
  '$': ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '%': ['##..#', '##.#.', '....#', '...#.', '..#..', '.#...', '#.###'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '(': ['...##', '..#..', '.#...', '.#...', '.#...', '..#..', '...##'],
  ')': ['##...', '..#..', '...#.', '...#.', '...#.', '..#..', '##...'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '"': ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '·': ['.....', '.....', '.....', '.##..', '.##..', '.....', '.....'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};
const FALLBACK = GLYPHS['?'];

// ------------------------------------------------------------- canvas -----
type RGB = [number, number, number];
const W = 1024;
const H = 1024;
const px = new Uint8Array(W * H * 3);

const PAPER: RGB = [246, 241, 227];
const INK: RGB = [20, 22, 26];
const RED: RGB = [178, 32, 44];
const BLUE: RGB = [29, 78, 137];
const SEA: RGB = [126, 166, 184];
const DEEPSEA: RGB = [84, 124, 148];
const GOLD: RGB = [198, 148, 44];
const GRAY: RGB = [92, 96, 102];
const LIGHT: RGB = [232, 224, 203];
const ORANGE: RGB = [226, 114, 38];
const WHITE: RGB = [252, 250, 244];

function set(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, c);
}
function frame(x: number, y: number, w: number, h: number, t: number, c: RGB): void {
  rect(x, y, w, t, c); rect(x, y + h - t, w, t, c);
  rect(x, y, t, h, c); rect(x + w - t, y, t, h, c);
}
function line(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
  const dx = x1 - x0, dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(x0 + (dx * s) / steps), y = Math.round(y0 + (dy * s) / steps);
    rect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
  }
}
function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let j = cy - r; j <= cy + r; j++)
    for (let i = cx - r; i <= cx + r; i++)
      if ((i - cx) * (i - cx) + (j - cy) * (j - cy) <= r * r) set(i, j, c);
}
function ring(cx: number, cy: number, r: number, t: number, c: RGB): void {
  for (let j = cy - r - t; j <= cy + r + t; j++)
    for (let i = cx - r - t; i <= cx + r + t; i++) {
      const d = Math.sqrt((i - cx) * (i - cx) + (j - cy) * (j - cy));
      if (d <= r && d > r - t) set(i, j, c);
    }
}
function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
  const area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  if (area === 0) return;
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const a = ((x1 - x) * (y2 - y) - (y1 - y) * (x2 - x)) / area;
      const b = ((x2 - x) * (y0 - y) - (y2 - y) * (x0 - x)) / area;
      const g = 1 - a - b;
      if (a >= 0 && b >= 0 && g >= 0) set(x, y, c);
    }
}

// --------------------------------------------------------------- text -----
function textWidth(s: string, scale: number): number {
  return s.length === 0 ? 0 : s.length * 6 * scale - scale;
}
function drawText(x: number, y: number, s: string, scale: number, c: RGB, bold = false): void {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = GLYPHS[ch] ?? FALLBACK;
    for (let r = 0; r < 7; r++)
      for (let col = 0; col < 5; col++)
        if (g[r][col] === '#') {
          rect(cx + col * scale, y + r * scale, scale, scale, c);
          if (bold) rect(cx + col * scale + Math.max(1, scale >> 2), y + r * scale, scale, scale, c);
        }
    cx += 6 * scale;
  }
}
function centerText(y: number, s: string, scale: number, c: RGB, bold = false): void {
  drawText(Math.round((W - textWidth(s, scale)) / 2), y, s, scale, c, bold);
}
function wrap(s: string, scale: number, maxW: number): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur === '' ? w : cur + ' ' + w;
    if (textWidth(next, scale) > maxW && cur !== '') { lines.push(cur); cur = w; }
    else cur = next;
  }
  if (cur !== '') lines.push(cur);
  return lines;
}
function drawPara(x: number, y: number, s: string, scale: number, maxW: number, lh: number, c: RGB): number {
  const lines = wrap(s, scale, maxW);
  for (let i = 0; i < lines.length; i++) drawText(x, y + i * lh, lines[i], scale, c);
  return y + lines.length * lh;
}

// --------------------------------------------------------------- icons ----
// Three summit flags on poles (US, China, Russia as flat colour blocks).
function iconFlags(x: number, y: number): void {
  for (let i = 0; i < 3; i++) {
    const fx = x + i * 20;
    rect(fx, y, 2, 52, INK);
  }
  rect(x + 2, y, 16, 11, WHITE);
  rect(x + 2, y, 16, 2, RED); rect(x + 2, y + 4, 16, 2, RED); rect(x + 2, y + 8, 16, 3, RED);
  rect(x + 2, y, 7, 6, BLUE);
  rect(x + 22, y, 16, 11, RED); disc(x + 27, y + 5, 2, GOLD);
  rect(x + 42, y, 16, 4, WHITE); rect(x + 42, y + 4, 16, 4, BLUE); rect(x + 42, y + 8, 16, 3, RED);
  rect(x, y + 52, 58, 3, INK);
}
// Oil tanker on waves.
function iconTanker(x: number, y: number): void {
  rect(x + 6, y + 26, 52, 10, INK);            // hull
  tri(x + 58, y + 26, x + 66, y + 36, x + 58, y + 36, INK);
  rect(x + 10, y + 18, 34, 8, RED);            // deck cargo
  rect(x + 46, y + 12, 8, 14, INK);            // bridge tower
  rect(x + 48, y + 6, 3, 6, INK);              // mast
  for (let i = 0; i < 4; i++) {                // waves
    line(x + i * 16, y + 44, x + i * 16 + 7, y + 41, 2, DEEPSEA);
    line(x + i * 16 + 7, y + 41, x + i * 16 + 14, y + 44, 2, DEEPSEA);
  }
}
// Medical cross in a ring, with measles spots.
function iconMeasles(x: number, y: number): void {
  ring(x + 26, y + 26, 24, 4, RED);
  rect(x + 21, y + 12, 10, 28, RED);
  rect(x + 12, y + 21, 28, 10, RED);
  disc(x + 48, y + 8, 3, RED); disc(x + 54, y + 20, 2, RED); disc(x + 6, y + 48, 3, RED);
  disc(x + 50, y + 46, 2, RED); disc(x + 4, y + 6, 2, RED);
}
// Computer chip with rising bars.
function iconChip(x: number, y: number): void {
  frame(x + 12, y + 8, 34, 34, 4, INK);
  for (let i = 0; i < 3; i++) {
    rect(x + 4, y + 14 + i * 10, 8, 3, INK); rect(x + 46, y + 14 + i * 10, 8, 3, INK);
    rect(x + 18 + i * 10, y, 3, 8, INK); rect(x + 18 + i * 10, y + 42, 3, 8, INK);
  }
  rect(x + 20, y + 30, 5, 8, GOLD); rect(x + 27, y + 25, 5, 13, GOLD); rect(x + 34, y + 18, 5, 20, RED);
}
// Plane in side profile, tilted down, with smoke puffs behind it.
function iconPlane(x: number, y: number): void {
  line(x + 6, y + 30, x + 46, y + 40, 7, INK);              // fuselage
  tri(x + 46, y + 40, x + 56, y + 44, x + 44, y + 45, INK); // nose
  tri(x + 6, y + 30, x + 2, y + 18, x + 14, y + 27, INK);   // tail fin
  tri(x + 22, y + 34, x + 36, y + 48, x + 30, y + 50, INK); // wing
  disc(x + 16, y + 33, 2, WHITE); disc(x + 24, y + 35, 2, WHITE); // windows
  disc(x + 4, y + 12, 4, GRAY); disc(x + 12, y + 6, 3, GRAY); disc(x + 20, y + 12, 2, GRAY); // smoke
}
// Seismograph trace.
function iconQuake(x: number, y: number): void {
  frame(x, y + 6, 58, 40, 3, INK);
  const pts: [number, number][] = [
    [4, 26], [14, 26], [18, 14], [22, 38], [26, 8], [30, 40], [34, 18], [38, 26], [54, 26],
  ];
  for (let i = 0; i < pts.length - 1; i++)
    line(x + pts[i][0], y + pts[i][1], x + pts[i + 1][0], y + pts[i + 1][1], 2, RED);
}

// ------------------------------------------- headline illustration ------
// The Kerch bridge: two pylons, a broken span, burst and smoke over the sea.
function bridgeScene(x: number, y: number, w: number, h: number): void {
  frame(x, y, w, h, 3, INK);
  const seaY = y + Math.round(h * 0.68);
  rect(x + 3, seaY, w - 6, h - (seaY - y) - 3, SEA);                 // sea
  disc(x + w - 62, y + 34, 15, GOLD);                                // sun
  rect(x + 30, y + 30, 44, 8, LIGHT); rect(x + 52, y + 42, 30, 7, LIGHT); // clouds
  const deckY = seaY - 26;
  rect(x + 14, deckY, Math.round(w * 0.40), 7, INK);                 // left span
  rect(x + Math.round(w * 0.60), deckY + 8, w - Math.round(w * 0.60) - 14, 7, INK); // right span, dropped
  line(x + Math.round(w * 0.40) + 14, deckY + 2, x + Math.round(w * 0.60), deckY + 10, 5, INK); // fallen piece
  rect(x + 58, deckY, 10, 26, INK); rect(x + w - 76, deckY + 8, 10, 18, INK); // pylons into water
  line(x + 63, deckY - 30, x + 63, deckY, 3, INK);                   // pylon tops
  line(x + w - 71, deckY - 22, x + w - 71, deckY + 8, 3, INK);
  line(x + 63, deckY - 30, x + 16, deckY, 2, INK);                   // cables
  line(x + 63, deckY - 30, x + 130, deckY, 2, INK);
  line(x + w - 71, deckY - 22, x + w - 140, deckY + 6, 2, INK);
  line(x + w - 71, deckY - 22, x + w - 16, deckY + 8, 2, INK);
  const bx = x + Math.round(w * 0.5), by = deckY - 6;                // burst
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    line(bx, by, bx + Math.round(Math.cos(a) * 26), by + Math.round(Math.sin(a) * 20), 4, i % 2 ? ORANGE : RED);
  }
  disc(bx, by, 8, ORANGE);
  disc(bx - 24, by - 26, 7, GRAY); disc(bx + 4, by - 38, 9, GRAY); disc(bx + 30, by - 28, 6, GRAY); // smoke
  for (let i = 0; i < 7; i++)                                        // wave strokes
    line(x + 24 + i * 54, seaY + 22, x + 44 + i * 54, seaY + 22, 3, DEEPSEA);
  rect(x + 3, y + h - 24, w - 6, 21, INK);                           // caption strip
  drawText(x + 14, y + h - 18, 'KERCH BRIDGE AFTER THE STRIKE', 2, WHITE);
}

// ------------------------------------------------------------- compose ----
rect(0, 0, W, H, PAPER);
frame(10, 10, W - 20, H - 20, 3, INK);
frame(18, 18, W - 36, H - 36, 1, INK);

// Masthead
centerText(40, 'THE ORBIT', 11, INK, true);
centerText(128, 'WORLD NEWS IN ONE IMAGE · ALL THE DAY THAT FITS ONE PAGE', 2, GRAY);
rect(36, 148, W - 72, 3, INK);

// Date bar
rect(36, 158, W - 72, 44, INK);
centerText(170, 'WEDNESDAY 18 NOVEMBER 2026', 3, WHITE, true);

// Headline story
drawText(36, 220, 'UKRAINE WAR · EUROPE', 2, RED, true);
drawText(36, 244, 'UKRAINE BLOWS OPEN', 6, INK, true);
drawText(36, 300, 'THE CRIMEA BRIDGE', 6, INK, true);
drawPara(36, 362,
  'ZELENSKY CONFIRMS AN OVERNIGHT STRIKE PARTLY DESTROYED THE KERCH ' +
  'BRIDGE, THE ONLY ROAD AND RAIL LINK FROM RUSSIA TO OCCUPIED CRIMEA. ' +
  'MOSCOW CLOSED THE CROSSING AND STRUCK BRIDGES IN KYIV IN REPLY, ' +
  'HOURS BEFORE A SUMMIT OF THE US, CHINESE AND RUSSIAN LEADERS.',
  2, 516, 21, INK);
bridgeScene(584, 356, 404, 168);
rect(36, 534, W - 72, 3, INK);

// Story grid: two columns, three rows of boxes.
type Story = { head: string; body: string; icon: (x: number, y: number) => void };
const stories: Story[] = [
  {
    head: 'SUMMIT IN SHENZHEN',
    body: 'TRUMP FLIES TO CHINA TO MEET XI AND PUTIN IN A THREE-WAY SUMMIT. XI CALLS FOR OPEN ASIA-PACIFIC TRADE.',
    icon: iconFlags,
  },
  {
    head: 'GULF FLARE-UP',
    body: 'US JETS HIT AN IRAN MISSILE SITE ON QESHM ISLAND. IRAN STRIKES BAHRAIN AND KUWAIT; 5 TANKERS HIT NEAR HORMUZ.',
    icon: iconTanker,
  },
  {
    head: 'US LOSES MEASLES-FREE STATUS',
    body: 'THE US LOSES ITS MEASLES ELIMINATION STATUS AFTER 26 YEARS: 5,400+ CASES, THE WORST OUTBREAK IN 3 DECADES.',
    icon: iconMeasles,
  },
  {
    head: 'NVIDIA SALES TOP $100BN',
    body: 'REVENUE DOUBLES TO $115.8BN IN A RECORD QUARTER. THE BOARD RULES OUT FOUNDER HUANG\'S RETURN AS CEO.',
    icon: iconChip,
  },
  {
    head: '19 KILLED IN SIBERIA CRASH',
    body: 'A RUSSIAN MILITARY TRANSPORT PLANE CRASHES IN SIBERIA. ALL 19 PEOPLE ON BOARD ARE KILLED, MOSCOW SAYS.',
    icon: iconPlane,
  },
  {
    head: 'M6.0 QUAKE ROCKS PNG',
    body: 'A MAGNITUDE 6 EARTHQUAKE STRIKES PAPUA NEW GUINEA AT A DEPTH OF 10 KM, THE GFZ RESEARCH CENTRE REPORTS.',
    icon: iconQuake,
  },
];
const colX = [36, 524];
const rowY = [544, 652, 760];
const boxW = 464, boxH = 100;
for (let i = 0; i < stories.length; i++) {
  const x = colX[i % 2], y = rowY[Math.floor(i / 2)];
  const st = stories[i];
  frame(x, y, boxW, boxH, 2, INK);
  st.icon(x + 12, y + 22);
  drawPara(x + 84, y + 10, st.head, 2, boxW - 96, 19, RED);
  drawPara(x + 84, y + 30, st.body, 2, boxW - 96, 17, INK);
}

// Markets strip
rect(36, 872, W - 72, 46, INK);
drawText(52, 882, 'MARKETS', 2, GOLD, true);
drawText(148, 882, 'GOLD $3,775 -2.3% · S&P 500 -1.0% · DAX -2.1% · BRENT $91.55', 2, WHITE);
drawText(52, 902, 'GOLD AT A ONE-YEAR LOW AS STOCKS SLIDE AND THE DOLLAR FIRMS', 2, LIGHT);

// In brief
drawText(36, 930, 'IN BRIEF', 2, RED, true);
drawPara(36, 952,
  'MODI RETURNS FROM THE ASEAN SUMMIT IN MANILA · ISRAEL\'S KNESSET ELECTS A NEW SPEAKER IN A BLOW TO NETANYAHU · JAPAN PROTESTS A SUSPECTED RUSSIAN AIRSPACE VIOLATION',
  2, W - 72, 19, INK);

// ---------------------------------------------------------------- png -----
const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), encodePNG());
