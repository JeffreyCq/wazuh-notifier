const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const outDir = path.resolve(__dirname, '../public/icons');
fs.mkdirSync(outDir, { recursive: true });

function buildSvg(size) {
  // All artwork is defined in a 128x128 viewBox; sharp scales it to `size`.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e3a8a"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
  </defs>

  <!-- Background rounded square -->
  <rect width="128" height="128" rx="26" fill="url(#bg)"/>

  <!-- Minimalist bell, centred at (60, 68) -->
  <g transform="translate(60,68)" fill="white">
    <!-- Stem -->
    <rect x="-4" y="-46" width="8" height="10" rx="4"/>
    <!-- Bell body: smooth dome narrowing at top, flat rim at bottom -->
    <path d="M 0,-36 C -22,-36 -32,-18 -32,8 L -32,20 L 32,20 L 32,8 C 32,-18 22,-36 0,-36 Z"/>
    <!-- Flat rim bar -->
    <rect x="-36" y="20" width="72" height="8" rx="4"/>
    <!-- Clapper dot -->
    <circle cx="0" cy="36" r="6"/>
  </g>

  <!-- W badge, top-right -->
  <circle cx="91" cy="37" r="20" fill="#ef4444"/>
  <text
    x="91" y="44"
    text-anchor="middle"
    font-family="'Arial Black', 'Arial Bold', Arial, sans-serif"
    font-weight="900"
    font-size="22"
    fill="white"
  >W</text>
</svg>`;
}

async function main() {
  for (const size of [16, 48, 128]) {
    const svg = Buffer.from(buildSvg(size));
    const outPath = path.join(outDir, `icon${size}.png`);
    await sharp(svg, { density: 300 }).resize(size, size).png().toFile(outPath);
    console.log(`✓ icon${size}.png`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
