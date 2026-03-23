/**
 * LRU CACHE
 * Least Recently Used кэш для DOM-элементов страниц.
 *
 * Реализация на основе Map, где порядок ключей соответствует порядку доступа.
 * При превышении лимита удаляется самый давно использованный элемент.
 *
 * @template K - Тип ключа
 * @template V - Тип значения
 *
 * @example
 * const cache = new LRUCache(10);
 * cache.set('page_1', domElement);
 * const element = cache.get('page_1'); // Перемещает в конец очереди
 */
export class LRUCache {
  /**
   * Создаёт новый LRU-кэш
   * @param {number} limit - Максимальное количество элементов в кэше
   */
  constructor(limit) {
    /** @type {number} Максимальный размер кэша */
    this.limit = limit;
    /** @type {Map<K, V>} Внутреннее хранилище */
    this.cache = new Map();
  }

  /**
   * Получить значение по ключу
   *
   * При успешном получении элемент перемещается в конец очереди (most recently used).
   *
   * @param {K} key - Ключ для поиска
   * @returns {V|null} Значение или null, если ключ не найден
   */
  get(key) {
    if (!this.cache.has(key)) return null;

    // Перемещаем в конец (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  /**
   * Сохранить значение по ключу
   *
   * Если ключ уже существует - значение обновляется и перемещается в конец.
   * При превышении лимита удаляется самый старый элемент (первый в Map).
   *
   * @param {K} key - Ключ
   * @param {V} value - Значение для сохранения
   */
  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Если превышен лимит - удаляем самый старый
    if (this.cache.size >= this.limit) {
      const first = this.cache.keys().next();
      if (!first.done) {
        this.cache.delete(first.value);
      }
    }

    this.cache.set(key, value);
  }

  /**
   * Проверить наличие ключа в кэше
   *
   * Не изменяет порядок элементов (в отличие от get).
   *
   * @param {K} key - Ключ для проверки
   * @returns {boolean} true, если ключ существует
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Очистить весь кэш
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Текущее количество элементов в кэше
   * @returns {number}
   */
  get size() {
    return this.cache.size;
  }
}
