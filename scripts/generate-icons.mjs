// Generates simple solid-color PWA icons as valid PNG files using only Node.js built-ins
import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

function int32BE(n) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(n, 0);
  return buf;
}

function makeCRCTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
}

const CRC_TABLE = makeCRCTable();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF];
  }
  crc = (crc ^ 0xFFFFFFFF) >>> 0;
  const out = Buffer.alloc(4);
  out.writeUInt32BE(crc, 0);
  return out;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([typeBuf, data]));
  return Buffer.concat([int32BE(data.length), typeBuf, data, crc]);
}

// Draws a filled rounded rectangle and a plane silhouette
function createIconPNG(size) {
  // Background: terracotta #E8622A
  const BG = [0xE8, 0x62, 0x2A];
  // Accent: white
  const FG = [0xFF, 0xFF, 0xFF];

  // Create pixel buffer (RGBA not needed — using RGB color type 2)
  const pixels = new Uint8Array(size * size * 3);

  // Fill background
  for (let i = 0; i < size * size; i++) {
    pixels[i * 3] = BG[0];
    pixels[i * 3 + 1] = BG[1];
    pixels[i * 3 + 2] = BG[2];
  }

  // Draw a simple plane/arrow shape in the center
  // Scale: use a 12x12 grid mapped to the icon size
  const scale = size / 24;
  const cx = size / 2;
  const cy = size / 2;

  // Draw a rounded square "frame" inner border in a slightly darker tone
  // Then draw "TP" as simple pixel blocks at the center

  // Letter "T" — simple block font
  const letterSize = Math.max(4, Math.floor(size * 0.32));
  const strokeW = Math.max(2, Math.floor(letterSize * 0.18));
  const startX = Math.floor(cx - letterSize * 0.5);
  const startY = Math.floor(cy - letterSize * 0.55);

  // Top bar of T
  for (let y = startY; y < startY + strokeW; y++) {
    for (let x = startX; x < startX + letterSize; x++) {
      if (x >= 0 && x < size && y >= 0 && y < size) {
        pixels[(y * size + x) * 3] = FG[0];
        pixels[(y * size + x) * 3 + 1] = FG[1];
        pixels[(y * size + x) * 3 + 2] = FG[2];
      }
    }
  }
  // Stem of T
  const stemX = Math.floor(cx - strokeW / 2);
  for (let y = startY; y < startY + letterSize; y++) {
    for (let x = stemX; x < stemX + strokeW; x++) {
      if (x >= 0 && x < size && y >= 0 && y < size) {
        pixels[(y * size + x) * 3] = FG[0];
        pixels[(y * size + x) * 3 + 1] = FG[1];
        pixels[(y * size + x) * 3 + 2] = FG[2];
      }
    }
  }

  // Build raw image data: filter byte 0 (None) per row
  const rowSize = size * 3;
  const raw = Buffer.alloc((rowSize + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (rowSize + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 3;
      const dst = y * (rowSize + 1) + 1 + x * 3;
      raw[dst] = pixels[src];
      raw[dst + 1] = pixels[src + 1];
      raw[dst + 2] = pixels[src + 2];
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.concat([
    int32BE(size), int32BE(size),
    Buffer.from([8, 2, 0, 0, 0]), // 8-bit RGB
  ]);
  const ihdr = chunk('IHDR', ihdrData);
  const idat = chunk('IDAT', deflateSync(raw));
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

for (const size of [192, 512, 180]) {
  const png = createIconPNG(size);
  const name = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`;
  writeFileSync(join(outDir, name), png);
  console.log(`✅ Generated ${name} (${png.length} bytes)`);
}
