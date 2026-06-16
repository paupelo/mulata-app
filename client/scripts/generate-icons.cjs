// Genera los iconos PWA de Mulata (PNG) sin dependencias externas.
// Dibuja una "M" blanca sobre fondo rosa de marca. Ejecutar con: node scripts/generate-icons.cjs
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG = [168, 69, 107]; // mulata-600 #a8456b
const FG = [255, 255, 255];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(size, px) {
  // px: función (x,y) -> [r,g,b,a]
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filtro None
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = px(x, y);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
      raw[o++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Dibuja una "M" centrada. Devuelve true si (nx,ny) en [0,1] pertenece al trazo.
function isM(nx, ny) {
  // Área de la letra dentro de un margen.
  const m = 0.26;
  if (nx < m || nx > 1 - m || ny < m || ny > 1 - m) return false;
  const x = (nx - m) / (1 - 2 * m); // 0..1
  const y = (ny - m) / (1 - 2 * m); // 0..1
  const t = 0.2; // grosor relativo del trazo
  // Patas izquierda y derecha
  if (x < t || x > 1 - t) return true;
  // Diagonales internas que bajan desde arriba al centro
  const left = Math.abs(y - (2 * x)); // \ desde (0,0) a (0.5,1)
  const right = Math.abs(y - (2 * (1 - x))); // / desde (1,0) a (0.5,1)
  if (x <= 0.5 && left < t && y <= 1) return true;
  if (x >= 0.5 && right < t && y <= 1) return true;
  return false;
}

function makeIcon(size, { padding = 0.12 } = {}) {
  const radius = size * 0.22;
  return encodePng(size, (x, y) => {
    // Esquinas redondeadas
    const inCorner = (cx, cy) => Math.hypot(x - cx, y - cy) > radius;
    let rounded = false;
    if (x < radius && y < radius && inCorner(radius, radius)) rounded = true;
    if (x > size - radius && y < radius && inCorner(size - radius, radius)) rounded = true;
    if (x < radius && y > size - radius && inCorner(radius, size - radius)) rounded = true;
    if (x > size - radius && y > size - radius && inCorner(size - radius, size - radius)) rounded = true;
    if (rounded) return [0, 0, 0, 0];

    // Coordenadas normalizadas con padding (para maskable)
    const nx = (x / size - padding) / (1 - 2 * padding);
    const ny = (y / size - padding) / (1 - 2 * padding);
    if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1 && isM(nx, ny)) {
      return [...FG, 255];
    }
    return [...BG, 255];
  });
}

const outDir = path.join(__dirname, '..', 'public');
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  { file: 'icon-192.png', size: 192, padding: 0.14 },
  { file: 'icon-512.png', size: 512, padding: 0.14 },
  { file: 'icon-maskable.png', size: 512, padding: 0.22 },
  { file: 'apple-touch-icon.png', size: 180, padding: 0.14 },
];

for (const t of targets) {
  fs.writeFileSync(path.join(outDir, t.file), makeIcon(t.size, { padding: t.padding }));
  console.log('Generado', t.file);
}
