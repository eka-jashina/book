/**
 * RATE LIMITER
 * Защита от слишком частых действий (автоматизация, спам-клики).
 *
 * Использует алгоритм Token Bucket:
 * - Каждое действие расходует токен
 * - Токены восстанавливаются со временем
 * - При исчерпании токенов действия блокируются
 */

export class RateLimiter {
  /**
   * @param {Object} options - Опции настройки
   * @param {number} options.maxTokens - Максимальное количество токенов (burst limit)
   * @param {number} options.refillRate - Количество токенов, добавляемых в секунду
   * @param {number} options.minInterval - Минимальный интервал между действиями (мс)
   */
  constructor(options = {}) {
    /** @type {number} Максимальное количество токенов */
    this.maxTokens = options.maxTokens || 10;

    /** @type {number} Скорость восстановления токенов в секунду */
    this.refillRate = options.refillRate || 2;

    /** @type {number} Минимальный интервал между действиями (мс) */
    this.minInterval = options.minInterval || 100;

    /** @type {number} Текущее количество токенов */
    this._tokens = this.maxTokens;

    /** @type {number} Время последнего обновления токенов */
    this._lastRefill = Date.now();

    /** @type {number} Время последнего действия */
    this._lastAction = 0;

    /** @type {number} Счётчик заблокированных действий */
    this._blockedCount = 0;

    /** @type {number} Порог для предупреждения о возможной автоматизации */
    this._warningThreshold = 5;
  }

  /**
   * Проверить, разрешено ли действие, и выполнить его если да
   * @returns {boolean} true если действие разрешено
   */
  tryAction() {
    this._refillTokens();

    const now = Date.now();

    // Проверка минимального интервала
    if (now - this._lastAction < this.minInterval) {
      this._onBlocked();
      return false;
    }

    // Проверка наличия токенов
    if (this._tokens < 1) {
      this._onBlocked();
      return false;
    }

    // Действие разрешено
    this._tokens -= 1;
    this._lastAction = now;
    this._blockedCount = 0; // Сброс счётчика при успешном действии

    return true;
  }

  /**
   * Восстановить токены на основе прошедшего времени
   * @private
   */
  _refillTokens() {
    const now = Date.now();
    const elapsed = (now - this._lastRefill) / 1000; // в секундах
    const tokensToAdd = elapsed * this.refillRate;

    this._tokens = Math.min(this.maxTokens, this._tokens + tokensToAdd);
    this._lastRefill = now;
  }

  /**
   * Обработка заблокированного действия
   * @private
   */
  _onBlocked() {
    this._blockedCount++;

    // Предупреждение при подозрении на автоматизацию
    if (this._blockedCount === this._warningThreshold) {
      console.warn(
        "RateLimiter: обнаружена подозрительная активность. " +
        `Заблокировано ${this._blockedCount} действий подряд.`
      );
    }
  }

  /**
   * Получить текущее состояние лимитера
   * @returns {Object} Состояние
   */
  getState() {
    this._refillTokens();
    return {
      tokens: Math.floor(this._tokens),
      maxTokens: this.maxTokens,
      blockedCount: this._blockedCount,
      canAct: this._tokens >= 1,
    };
  }

  /**
   * Сбросить состояние лимитера
   */
  reset() {
    this._tokens = this.maxTokens;
    this._lastRefill = Date.now();
    this._lastAction = 0;
    this._blockedCount = 0;
  }
}

/**
 * Предустановленные лимитеры для разных типов действий
 */
export const rateLimiters = {
  /** Навигация по страницам: 10 действий burst, 2/сек восстановление */
  navigation: new RateLimiter({
    maxTokens: 10,
    refillRate: 2,
    minInterval: 100,
  }),

  /** Смена глав: более строгие лимиты */
  chapter: new RateLimiter({
    maxTokens: 3,
    refillRate: 0.5,
    minInterval: 500,
  }),

  /** Изменение настроек */
  settings: new RateLimiter({
    maxTokens: 20,
    refillRate: 5,
    minInterval: 50,
  }),
};
