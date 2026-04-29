const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const outDir = path.resolve(__dirname, '../public/icons');
fs.mkdirSync(outDir, { recursive: true });

// Primary blue from the reference image
const BLUE = '#4287f5';
const BLUE_LIGHT = '#7ab3f8';

function buildSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">

  <!-- Solid blue background -->
  <rect width="128" height="128" rx="24" fill="${BLUE}"/>

  <!-- Subtle inner border ring -->
  <rect x="4" y="4" width="120" height="120" rx="21"
        fill="none" stroke="${BLUE_LIGHT}" stroke-width="2.5" opacity="0.6"/>

  <!-- Bell: top knob (circle) -->
  <circle cx="64" cy="20" r="9" fill="white"/>

  <!-- Bell body -->
  <path d="
    M 64,29
    C 40,29 18,46 18,70
    L 18,91
    Q 18,102 64,102
    Q 110,102 110,91
    L 110,70
    C 110,46 88,29 64,29
    Z
  " fill="white"/>

  <!-- Bell mount (clapper holder at bottom) -->
  <path d="M 44,102 Q 44,116 64,116 Q 84,116 84,102 Z" fill="white"/>

  <!-- W letter — blue on white, large and bold -->
  <text
    x="60" y="84"
    text-anchor="middle"
    font-family="'Arial Black', 'Arial Bold', Arial, sans-serif"
    font-weight="900"
    font-size="44"
    fill="${BLUE}"
  >W</text>

  <!-- Clapper dot — dark circle, right of W -->
  <circle cx="86" cy="80" r="10" fill="#111827"/>
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
