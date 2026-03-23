import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';

/**
 * Vite-плагин для подключения HTML-партиалов.
 *
 * Заменяет директивы вида <!--#include "path/to/file.html" -->
 * содержимым указанных файлов на этапе сборки (build-time).
 * Поддерживает вложенные include (рекурсивно, до 10 уровней).
 *
 * Пути разрешаются относительно файла, содержащего директиву.
 */
export default function htmlIncludes() {
  const MAX_DEPTH = 10;
  const INCLUDE_RE = /<!--\s*#include\s+"([^"]+)"\s*-->/g;

  /**
   * Рекурсивно раскрывает директивы #include
   * @param {string} html - исходный HTML
   * @param {string} baseDir - директория для разрешения относительных путей
   * @param {number} depth - текущая глубина вложенности
   * @returns {string} HTML с раскрытыми include
   */
  function processIncludes(html, baseDir, depth = 0) {
    if (depth > MAX_DEPTH) {
      throw new Error(`[html-includes] Превышена максимальная глубина вложенности (${MAX_DEPTH})`);
    }

    return html.replace(INCLUDE_RE, (_match, relPath) => {
      const filePath = resolve(baseDir, relPath);
      const content = readFileSync(filePath, 'utf-8');
      // Рекурсивно обрабатываем вложенные include
      return processIncludes(content, dirname(filePath), depth + 1);
    });
  }

  return {
    name: 'html-includes',
    enforce: 'pre',

    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const baseDir = dirname(ctx.filename);
        return processIncludes(html, baseDir);
      },
    },
  };
}
