import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
const house = await readFile(new URL('../public/home-illustration.svg', import.meta.url));
const illustration = await sharp(house).resize(500, 493).png().toBuffer();
const svg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#ffffff"/><text x="70" y="102" font-family="Arial,sans-serif" font-size="36" font-weight="700" fill="#111b21">kofutela.</text><text x="70" y="270" font-family="Arial,sans-serif" font-size="57" font-weight="700" fill="#111b21">Close to home.</text><text x="70" y="340" font-family="Arial,sans-serif" font-size="57" font-weight="700" fill="#087f3d">Even from afar.</text><text x="73" y="408" font-family="Arial,sans-serif" font-size="22" fill="#5e5e5e">Your properties. Your people.</text><text x="73" y="441" font-family="Arial,sans-serif" font-size="22" fill="#5e5e5e">A little more peace of mind.</text><text x="73" y="556" font-family="Arial,sans-serif" font-size="16" fill="#5e5e5e">Built for Kinshasa. Wherever you call home.</text></svg>`,
);
await sharp(svg)
  .composite([{ input: illustration, left: 660, top: 80 }])
  .png()
  .toFile(new URL('../public/social-card.png', import.meta.url).pathname);
console.log('Created public/social-card.png (1200 × 630)');
