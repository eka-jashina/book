/**
 * Vite-плагин: генерация уменьшенных фоновых изображений для мобильных устройств.
 *
 * При сборке (и в dev-режиме) создаёт копии фонов с суффиксом `-mobile`
 * и уменьшенным разрешением (по умолчанию 960px по ширине).
 */

import sharp from 'sharp';
import { readdirSync, existsSync, mkdirSync, statSync } from 'fs';
import { resolve, join, parse } from 'path';

const DEFAULTS = {
  /** Директория с оригинальными фонами (относительно public/) */
  inputDir: 'images/backgrounds',
  /** Ширина мобильной версии в пикселях */
  mobileWidth: 960,
  /** Суффикс для мобильных файлов */
  suffix: '-mobile',
  /** Качество WebP */
  quality: 85,
};

/**
 * @param {Partial<typeof DEFAULTS>} options
 */
export default function mobileBackgrounds(options = {}) {
  const config = { ...DEFAULTS, ...options };
  let publicDir;

  async function generateMobileImages() {
    const srcDir = resolve(publicDir, config.inputDir);
    if (!existsSync(srcDir)) return;

    const files = readdirSync(srcDir).filter(f => /\.(webp|jpe?g|png)$/i.test(f));

    for (const file of files) {
      const { name, ext } = parse(file);

      // Пропускаем файлы, которые уже являются мобильными версиями
      if (name.endsWith(config.suffix)) continue;

      const srcPath = join(srcDir, file);
      const outName = `${name}${config.suffix}${ext}`;
      const outPath = join(srcDir, outName);

      // Пропускаем если мобильная версия уже существует и новее оригинала
      if (existsSync(outPath)) {
        const srcStat = statSync(srcPath);
        const outStat = statSync(outPath);
        if (outStat.mtimeMs >= srcStat.mtimeMs) continue;
      }

      const metadata = await sharp(srcPath).metadata();

      // Пропускаем если оригинал уже меньше целевой ширины
      if (metadata.width && metadata.width <= config.mobileWidth) {
        continue;
      }

      await sharp(srcPath)
        .resize(config.mobileWidth)
        .webp({ quality: config.quality })
        .toFile(outPath);

      console.log(`[mobile-bg] ${file} → ${outName} (${metadata.width}→${config.mobileWidth}px)`);
    }
  }

  return {
    name: 'vite-plugin-mobile-backgrounds',

    configResolved(resolvedConfig) {
      publicDir = resolvedConfig.publicDir;
    },

    // Генерируем при старте dev-сервера и при сборке
    async buildStart() {
      await generateMobileImages();
    },
  };
}
