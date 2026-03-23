/**
 * SOUND MANAGER
 * Управление звуковыми эффектами книги.
 */

/** @constant {number} Таймаут загрузки звука (мс) */
const LOAD_TIMEOUT_MS = 10000;

export class SoundManager {
  constructor(options = {}) {
    this.enabled = options.enabled ?? true;
    this.volume = options.volume ?? 0.3;
    this.sounds = new Map();
    this.preloadQueue = [];
  }

  /**
   * Зарегистрировать звук
   * @param {string} name - Имя звука
   * @param {string} url - URL файла
   * @param {Object} options - Опции
   */
  register(name, url, options = {}) {
    const sound = {
      url,
      audio: null,
      loaded: false,
      volume: options.volume ?? this.volume,
      poolSize: options.poolSize ?? 3, // Пул для одновременного воспроизведения
      audioPool: [],
      currentPoolIndex: 0,
    };

    this.sounds.set(name, sound);
    
    if (options.preload) {
      this.preloadQueue.push(name);
    }

    return this;
  }

  /**
   * Предзагрузить звуки
   * @returns {Promise<void>}
   */
  async preload() {
    const promises = this.preloadQueue.map(name => this._loadSound(name));
    await Promise.allSettled(promises);
  }

  /**
   * Загрузить конкретный звук
   * @private
   */
  async _loadSound(name) {
    const sound = this.sounds.get(name);
    if (!sound || sound.loaded) return;

    try {
      // Создаем пул аудио элементов
      for (let i = 0; i < sound.poolSize; i++) {
        const audio = new Audio(sound.url);
        audio.volume = sound.volume;
        audio.preload = 'auto';
        
        // Ждем загрузки первого элемента с таймаутом
        if (i === 0) {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error(`Sound load timeout (${LOAD_TIMEOUT_MS}ms)`));
            }, LOAD_TIMEOUT_MS);

            audio.addEventListener('canplaythrough', () => {
              clearTimeout(timeout);
              resolve();
            }, { once: true });

            audio.addEventListener('error', (e) => {
              clearTimeout(timeout);
              reject(e);
            }, { once: true });
          });
        }
        
        sound.audioPool.push(audio);
      }
      
      sound.loaded = true;
    } catch (error) {
      console.warn(`Failed to load sound "${name}":`, error);
    }
  }

  /**
   * Воспроизвести звук
   * @param {string} name - Имя звука
   * @param {Object} options - Опции воспроизведения
   */
  async play(name, options = {}) {
    if (!this.enabled) return;

    const sound = this.sounds.get(name);
    if (!sound) {
      console.warn(`Sound "${name}" not registered`);
      return;
    }

    // Загружаем если еще не загружен
    if (!sound.loaded) {
      await this._loadSound(name);
    }

    if (!sound.loaded || !sound.audioPool.length) return;

    try {
      // Берем следующий аудио элемент из пула
      const audio = sound.audioPool[sound.currentPoolIndex];
      sound.currentPoolIndex = (sound.currentPoolIndex + 1) % sound.audioPool.length;

      // Применяем громкость: явную опцию или текущую громкость звука
      audio.volume = options.volume !== undefined ? options.volume : sound.volume;

      if (options.playbackRate !== undefined) {
        audio.playbackRate = options.playbackRate;
      }

      // Останавливаем если уже играет и начинаем заново
      audio.currentTime = 0;
      
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          // Игнорируем ошибки autoplay policy
          if (error.name !== 'NotAllowedError') {
            console.warn(`Failed to play sound "${name}":`, error);
          }
        });
      }
    } catch (error) {
      console.warn(`Error playing sound "${name}":`, error);
    }
  }

  /**
   * Включить/выключить звуки
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Установить громкость
   * @param {number} volume - 0.0 - 1.0
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    
    // Обновляем сохранённую громкость и audio-элементы для всех звуков
    for (const sound of this.sounds.values()) {
      sound.volume = this.volume;
      if (sound.loaded) {
        sound.audioPool.forEach(audio => {
          audio.volume = this.volume;
        });
      }
    }
  }

  /**
   * Остановить все звуки
   */
  stopAll() {
    for (const sound of this.sounds.values()) {
      if (sound.loaded) {
        sound.audioPool.forEach(audio => {
          audio.pause();
          audio.currentTime = 0;
        });
      }
    }
  }

  /**
   * Очистка ресурсов
   */
  destroy() {
    this.stopAll();
    
    for (const sound of this.sounds.values()) {
      if (sound.loaded) {
        sound.audioPool.forEach(audio => {
          audio.src = '';
          audio.load();
        });
        sound.audioPool = [];
      }
    }
    
    this.sounds.clear();
    this.preloadQueue = [];
  }
}
