/**
 * Генерация PWA иконок из SVG
 * Запуск: node scripts/generate-icons.js
 */

import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

const svgPath = resolve(rootDir, 'public/icons/icon.svg');
const svgBuffer = readFileSync(svgPath);

const sizes = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 512, name: 'icon-512-maskable.png', padding: 64 },
];

async function generateIcons() {
  console.log('Генерация PWA иконок...\n');

  for (const { size, name, padding = 0 } of sizes) {
    const outputPath = resolve(rootDir, 'public/icons', name);

    if (padding > 0) {
      // Maskable иконка с отступами
      const innerSize = size - padding * 2;
      await sharp(svgBuffer)
        .resize(innerSize, innerSize)
        .extend({
          top: padding,
          bottom: padding,
          left: padding,
          right: padding,
          background: '#1a1a2e',
        })
        .png()
        .toFile(outputPath);
    } else {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);
    }

    console.log(`✓ ${name} (${size}x${size})`);
  }

  console.log('\nГотово!');
}

generateIcons().catch(console.error);
