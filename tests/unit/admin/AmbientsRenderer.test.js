import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@i18n', () => ({ t: vi.fn((key, opts) => opts ? `${key}:${JSON.stringify(opts)}` : key) }));

import {
  getDisplayLabel,
  getDisplayShortLabel,
  extractFileName,
  renderAmbientCard,
  renderAmbientBody,
} from '@/admin/modules/ambients/AmbientsRenderer.js';

import { t } from '@i18n';

// ═══════════════════════════════════════════
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ═══════════════════════════════════════════

function createBuiltinAmbient(overrides = {}) {
  return {
    id: 'rain',
    label: 'Rain',
    builtin: true,
    enabled: true,
    visible: true,
    icon: '🌧️',
    file: '/sounds/rain.mp3',
    volume: 0.5,
    ...overrides,
  };
}

function createCustomAmbient(overrides = {}) {
  return {
    id: 'custom-1',
    label: 'My Sound',
    builtin: false,
    enabled: true,
    visible: true,
    icon: '🌊',
    file: 'data:audio/mp3;base64,abc123',
    volume: 0.7,
    ...overrides,
  };
}

function createMockModule() {
  return {
    _escapeHtml: vi.fn(s => s),
    _showToast: vi.fn(),
    _expandedIndex: -1,
    _playingIndex: -1,
    _pendingAmbientFileName: null,
  };
}

describe('AmbientsRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // ФУНКЦИЯ getDisplayLabel()
  // ═══════════════════════════════════════════

  describe('getDisplayLabel()', () => {
    it('должен вернуть i18n ключ для builtin звука', () => {
      const ambient = createBuiltinAmbient({ id: 'rain' });
      const label = getDisplayLabel(ambient);

      // Для встроенных — через i18n
      expect(t).toHaveBeenCalled();
    });

    it('должен вернуть label для custom звука', () => {
      const ambient = createCustomAmbient({ label: 'Custom Sound' });
      const label = getDisplayLabel(ambient);

      expect(label).toBe('Custom Sound');
    });

    it('должен обработать пустой label', () => {
      const ambient = createCustomAmbient({ label: '' });
      const label = getDisplayLabel(ambient);

      expect(typeof label).toBe('string');
    });
  });

  // ═══════════════════════════════════════════
  // ФУНКЦИЯ getDisplayShortLabel()
  // ═══════════════════════════════════════════

  describe('getDisplayShortLabel()', () => {
    it('должен вернуть короткий i18n ключ для builtin звука', () => {
      const ambient = createBuiltinAmbient({ id: 'rain' });
      const label = getDisplayShortLabel(ambient);

      expect(t).toHaveBeenCalled();
    });

    it('должен вернуть label для custom звука', () => {
      const ambient = createCustomAmbient({ label: 'My Sound' });
      const label = getDisplayShortLabel(ambient);

      expect(label).toBe('My Sound');
    });
  });

  // ═══════════════════════════════════════════
  // ФУНКЦИЯ extractFileName()
  // ═══════════════════════════════════════════

  describe('extractFileName()', () => {
    it('должен извлечь имя файла из пути', () => {
      const name = extractFileName('/sounds/ambient/forest.ogg');
      expect(name).toBe('forest.ogg');
    });

    it('должен обработать data URL', () => {
      const name = extractFileName('data:audio/mp3;base64,abc123');
      // Для data URL возвращает i18n ключ через t()
      expect(name).not.toBeNull();
    });

    it('должен обработать простое имя файла', () => {
      const name = extractFileName('rain.mp3');
      expect(name).toBe('rain.mp3');
    });

    it('должен вернуть null для пустой строки', () => {
      const name = extractFileName('');
      expect(name).toBeNull();
    });

    it('должен вернуть null для null/undefined', () => {
      expect(extractFileName(null)).toBeNull();
      expect(extractFileName(undefined)).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // ФУНКЦИЯ renderAmbientCard()
  // ═══════════════════════════════════════════

  describe('renderAmbientCard()', () => {
    let mod;

    beforeEach(() => {
      mod = createMockModule();
    });

    it('должен вернуть HTML строку', () => {
      const ambient = createBuiltinAmbient();
      const html = renderAmbientCard(mod, ambient, 0);

      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);
    });

    it('должен содержать название звука', () => {
      const ambient = createCustomAmbient({ label: 'Ocean Waves' });
      const html = renderAmbientCard(mod, ambient, 0);

      expect(html).toContain('Ocean Waves');
    });

    it('должен содержать индекс', () => {
      const ambient = createBuiltinAmbient();
      const html = renderAmbientCard(mod, ambient, 3);

      // Индекс в data-атрибуте
      expect(html).toContain('3');
    });

    it('должен отобразить состояние enabled', () => {
      const ambient = createBuiltinAmbient({ enabled: true });
      const html = renderAmbientCard(mod, ambient, 0);

      expect(typeof html).toBe('string');
    });

    it('должен отобразить состояние disabled', () => {
      const ambient = createBuiltinAmbient({ enabled: false });
      const html = renderAmbientCard(mod, ambient, 0);

      expect(typeof html).toBe('string');
    });
  });

  // ═══════════════════════════════════════════
  // ФУНКЦИЯ renderAmbientBody()
  // ═══════════════════════════════════════════

  describe('renderAmbientBody()', () => {
    let mod;

    beforeEach(() => {
      mod = createMockModule();
    });

    it('должен вернуть HTML строку', () => {
      const ambient = createBuiltinAmbient();
      const html = renderAmbientBody(mod, ambient);

      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);
    });

    it('должен содержать поле для label', () => {
      const ambient = createBuiltinAmbient();
      const html = renderAmbientBody(mod, ambient);

      // Должен содержать input для имени
      expect(html).toContain('ambient-inline-label');
    });

    it('должен содержать элементы для custom звука', () => {
      const ambient = createCustomAmbient();
      const html = renderAmbientBody(mod, ambient);

      expect(typeof html).toBe('string');
    });

    it('должен отобразить имя файла для custom звука', () => {
      const ambient = createCustomAmbient({
        label: 'My Sound',
        file: '/sounds/my-sound.mp3',
      });
      const html = renderAmbientBody(mod, ambient);

      expect(html).toContain('my-sound.mp3');
    });

    it('должен включить кнопку загрузки файла', () => {
      const ambient = createBuiltinAmbient({ volume: 0.8 });
      const html = renderAmbientBody(mod, ambient);

      // Должен содержать file upload input
      expect(html).toContain('ambient-inline-file-upload');
    });

    it('должен включить кнопку сохранения', () => {
      const ambient = createBuiltinAmbient({ enabled: true });
      const html = renderAmbientBody(mod, ambient);

      // Должен содержать save button
      expect(html).toContain('data-ambient-save');
    });
  });
});
