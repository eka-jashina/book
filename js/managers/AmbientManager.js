/**
 * AMBIENT MANAGER
 * Управление фоновыми звуками окружения.
 *
 * Особенности:
 * - Зацикленное воспроизведение
 * - Автоматическая пауза при сворачивании вкладки
 * - Плавные переходы между треками
 * - Независимая регулировка громкости
 */

import { getConfig } from '../config.js';

export class AmbientManager {
  /**
   * Тип "без звука" - используется как значение по умолчанию
   */
  static TYPE_NONE = 'none';

  /**
   * @param {Object} options
   * @param {string} options.currentType - Текущий тип звука
   * @param {number} options.volume - Громкость (0-1)
   * @param {Object} options.sounds - Карта типов к URL файлов
   * @param {Function} options.onLoadStart - Коллбэк начала загрузки
   * @param {Function} options.onLoadEnd - Коллбэк завершения загрузки
   */
  constructor(options = {}) {
    this.currentType = options.currentType ?? AmbientManager.TYPE_NONE;
    this.volume = options.volume ?? 0.5;
    this.sounds = options.sounds ?? {};

    // Коллбэки для UI
    this.onLoadStart = options.onLoadStart ?? (() => {});
    this.onLoadEnd = options.onLoadEnd ?? (() => {});

    this.audio = null;
    this.audioCache = new Map(); // Кэш загруженных Audio объектов по типу
    this.isPlaying = false;
    this.isLoading = false;
    this.fadeInterval = null;

    this._boundVisibilityHandler = this._handleVisibilityChange.bind(this);
    this._setupVisibilityListener();
  }

  /**
   * Зарегистрировать ambient звук
   * @param {string} type - Тип звука
   * @param {string} url - URL аудио файла
   * @returns {AmbientManager}
   */
  register(type, url) {
    this.sounds[type] = url;
    return this;
  }

  /**
   * Установить тип ambient звука
   * @param {string} type - Тип звука
   * @param {boolean} fade - Использовать плавный переход
   */
  async setType(type, fade = true) {
    // Если тот же тип - ничего не делаем
    if (type === this.currentType && this.isPlaying) {
      return;
    }

    this.currentType = type;

    // Если выбрано "без звука" или тип без файла - останавливаем
    if (type === AmbientManager.TYPE_NONE || !this.sounds[type]) {
      await this.stop(fade);
      return;
    }

    // Если есть звук для этого типа - запускаем
    if (this.sounds[type]) {
      await this.play(type, fade);
    }
  }

  /**
   * Воспроизвести ambient звук
   * @param {string} type - Тип звука
   * @param {boolean} fade - Использовать fade in
   */
  async play(type, fade = true) {
    const url = this.sounds[type];
    if (!url) {
      console.warn(`Ambient sound "${type}" not registered`);
      return;
    }

    // Останавливаем текущий звук
    if (this.audio) {
      await this.stop(fade);
    }

    // Проверяем кэш
    const cached = this.audioCache.get(type);

    if (cached) {
      // Используем кэшированный Audio объект
      this.audio = cached;
      this.audio.volume = fade ? 0 : this.volume;
      this.audio.currentTime = 0;

      try {
        await this.audio.play();
        this.isPlaying = true;
        this.currentType = type;

        if (fade) {
          await this._fadeIn();
        }
      } catch (error) {
        if (error.name !== 'NotAllowedError') {
          console.warn('Failed to play ambient sound:', error);
        }
        this.isPlaying = false;
      }
      return;
    }

    // Первая загрузка — создаём новый Audio и кэшируем
    this.isLoading = true;
    this.onLoadStart(type);

    try {
      const audio = new Audio(url);
      audio.loop = true;
      audio.volume = fade ? 0 : this.volume;
      audio.preload = 'auto';

      // Ждём загрузки
      await new Promise((resolve, reject) => {
        audio.addEventListener('canplaythrough', resolve, { once: true });
        audio.addEventListener('error', (e) => {
          reject(new Error(`Failed to load ambient sound: ${e.message}`));
        }, { once: true });
      });

      // Кэшируем загруженный элемент
      this.audioCache.set(type, audio);
      this.audio = audio;

      // Запускаем воспроизведение
      await this.audio.play();
      this.isPlaying = true;
      this.currentType = type;

      // Плавное появление
      if (fade) {
        await this._fadeIn();
      }
    } catch (error) {
      // Игнорируем ошибки autoplay policy
      if (error.name !== 'NotAllowedError') {
        console.warn('Failed to play ambient sound:', error);
      }
      this.isPlaying = false;
    } finally {
      // Загрузка завершена (успешно или с ошибкой)
      this.isLoading = false;
      this.onLoadEnd(type);
    }
  }

  /**
   * Остановить воспроизведение
   * @param {boolean} fade - Использовать fade out
   */
  async stop(fade = true) {
    if (!this.audio) return;

    if (fade && this.isPlaying) {
      await this._fadeOut();
    }

    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio = null; // Убираем ссылку, но объект остаётся в audioCache
    this.isPlaying = false;
  }

  /**
   * Пауза воспроизведения
   */
  pause() {
    if (this.audio && this.isPlaying) {
      this.audio.pause();
    }
  }

  /**
   * Возобновить воспроизведение
   */
  resume() {
    if (this.audio && this.isPlaying && this.audio.paused) {
      this.audio.play().catch(() => {
        // Игнорируем ошибки autoplay
      });
    }
  }

  /**
   * Установить громкость
   * @param {number} volume - Громкость (0-1)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    
    if (this.audio && this.isPlaying) {
      this.audio.volume = this.volume;
    }
  }

  /**
   * Плавное увеличение громкости
   * @private
   */
  _fadeIn() {
    return new Promise((resolve) => {
      this._clearFade();
      
      const targetVolume = this.volume;
      const step = targetVolume / 20; // 20 шагов
      let currentVolume = 0;

      this.fadeInterval = setInterval(() => {
        currentVolume = Math.min(currentVolume + step, targetVolume);
        
        if (this.audio) {
          this.audio.volume = currentVolume;
        }

        if (currentVolume >= targetVolume) {
          this._clearFade();
          resolve();
        }
      }, 50); // 50ms × 20 = 1 секунда fade
    });
  }

  /**
   * Плавное уменьшение громкости
   * @private
   */
  _fadeOut() {
    return new Promise((resolve) => {
      this._clearFade();
      
      if (!this.audio) {
        resolve();
        return;
      }

      let currentVolume = this.audio.volume;
      const step = currentVolume / 20;

      this.fadeInterval = setInterval(() => {
        currentVolume = Math.max(currentVolume - step, 0);
        
        if (this.audio) {
          this.audio.volume = currentVolume;
        }

        if (currentVolume <= 0) {
          this._clearFade();
          resolve();
        }
      }, 50);
    });
  }

  /**
   * Очистить fade интервал
   * @private
   */
  _clearFade() {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
  }

  /**
   * Настроить слушатель видимости вкладки
   * @private
   */
  _setupVisibilityListener() {
    document.addEventListener('visibilitychange', this._boundVisibilityHandler);
  }

  /**
   * Обработчик изменения видимости вкладки
   * @private
   */
  _handleVisibilityChange() {
    if (document.hidden) {
      this.pause();
    } else {
      // Небольшая задержка перед возобновлением
      setTimeout(() => this.resume(), getConfig().AUDIO.VISIBILITY_RESUME_DELAY);
    }
  }

  /**
   * Очистка ресурсов
   */
  destroy() {
    document.removeEventListener('visibilitychange', this._boundVisibilityHandler);
    this._clearFade();
    
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }

    // Очищаем кэш Audio объектов
    for (const audio of this.audioCache.values()) {
      audio.pause();
      audio.src = '';
    }
    this.audioCache.clear();

    this.isPlaying = false;
    this.sounds = {};
  }
}
