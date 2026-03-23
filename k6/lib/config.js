/**
 * Центральная конфигурация k6 нагрузочных тестов.
 * Все сценарии импортируют настройки отсюда.
 */

// Базовый URL сервера (по умолчанию — локальный Docker)
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
export const API_V1 = `${BASE_URL}/api/v1`;
export const API_HEALTH = `${BASE_URL}/api/health`;

// Размер пула предварительно созданных пользователей
export const POOL_SIZE = parseInt(__ENV.POOL_SIZE || '50', 10);

// Пароль по умолчанию для тестовых пользователей
export const DEFAULT_PASSWORD = 'K6LoadTest123!';

// ── Пороговые значения ──────────────────────────────────────

/** Дымовой тест: минимальная нагрузка */
export const SMOKE_THRESHOLDS = {
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  http_req_failed: ['rate<0.01'],
};

/** Нагрузочный тест: нормальный трафик */
export const DEFAULT_THRESHOLDS = {
  http_req_duration: ['p(95)<1000', 'p(99)<2000'],
  http_req_failed: ['rate<0.05'],
  http_reqs: ['rate>10'],
};

/** Стресс-тест: поиск предела */
export const STRESS_THRESHOLDS = {
  http_req_duration: ['p(95)<3000', 'p(99)<5000'],
  http_req_failed: ['rate<0.15'],
};

/** Спайк-тест: резкий всплеск */
export const SPIKE_THRESHOLDS = {
  http_req_duration: ['p(95)<5000'],
  http_req_failed: ['rate<0.20'],
};

/** Тест на выносливость: длительная нагрузка */
export const SOAK_THRESHOLDS = {
  http_req_duration: ['p(95)<1500', 'p(99)<3000'],
  http_req_failed: ['rate<0.05'],
};
