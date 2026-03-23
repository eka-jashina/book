/**
 * Переиспользуемые функции проверок для k6.
 * Все API-ответы сервера следуют формату { data: ... }.
 */

import { check } from 'k6';

/**
 * Проверка стандартного успешного ответа (200).
 */
export function checkOk(res, name) {
  return check(res, {
    [`${name} — status 200`]: (r) => r.status === 200,
    [`${name} — has data`]: (r) => {
      try { return r.json('data') !== undefined; } catch { return false; }
    },
  });
}

/**
 * Проверка успешного создания ресурса (201).
 */
export function checkCreated(res, name) {
  return check(res, {
    [`${name} — status 201`]: (r) => r.status === 201,
    [`${name} — has data`]: (r) => {
      try { return r.json('data') !== undefined; } catch { return false; }
    },
  });
}

/**
 * Проверка ответа без содержимого (204).
 */
export function checkNoContent(res, name) {
  return check(res, {
    [`${name} — status 204`]: (r) => r.status === 204,
  });
}

/**
 * Проверка health-эндпоинта.
 */
export function checkHealthy(res) {
  return check(res, {
    'Health check — status 200': (r) => r.status === 200,
    'Health check — DB ok': (r) => {
      try { return r.json('checks.database') === 'ok'; } catch { return false; }
    },
    'Health check — S3 ok': (r) => {
      try { return r.json('checks.storage') === 'ok'; } catch { return false; }
    },
  });
}

/**
 * Проверка ответа со списком (200 + массив).
 */
export function checkList(res, name, arrayField) {
  return check(res, {
    [`${name} — status 200`]: (r) => r.status === 200,
    [`${name} — is array`]: (r) => {
      try { return Array.isArray(r.json(`data.${arrayField}`)); } catch { return false; }
    },
  });
}
