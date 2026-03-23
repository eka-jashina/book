# k6 — Нагрузочное тестирование Flipbook API

Набор нагрузочных тестов для бэкенда Flipbook на базе [k6](https://grafana.com/docs/k6/).

## Структура

```
k6/
├── lib/                   # Общие библиотеки
│   ├── config.js          # Конфигурация (BASE_URL, пороговые значения)
│   ├── auth.js            # Аутентификация (CSRF + сессия)
│   ├── data.js            # Генераторы тестовых данных
│   ├── checks.js          # Переиспользуемые проверки ответов
│   └── endpoints.js       # Обёртки для всех API-эндпоинтов
├── flows/                 # Пользовательские сценарии
│   ├── reader-flow.js     # Читатель: вход → чтение → прогресс
│   ├── author-flow.js     # Автор: создание книги → главы → настройка
│   ├── browsing-flow.js   # Аноним: обзор → публичные книги
│   └── admin-flow.js      # Админ: шрифты → настройки → экспорт
└── scenarios/             # Сценарии нагрузки
    ├── smoke.js           # Дымовой: 2 VU, 30с
    ├── load.js            # Нагрузочный: до 50 VU, 5 мин
    ├── stress.js          # Стресс: до 200 VU, 10 мин
    ├── spike.js           # Спайк: 10→200 VU мгновенно
    └── soak.js            # Выносливость: 30 VU, 30 мин
```

## Предварительные требования

### Вариант 1: Локальная установка k6

```bash
# macOS
brew install k6

# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Windows
choco install k6
```

### Вариант 2: Docker (не требует установки k6)

Нужен только Docker и Docker Compose.

## Запуск

### Локально (k6 CLI + работающий сервер)

```bash
# 1. Запустить инфраструктуру
docker compose up -d postgres minio minio-init

# 2. Запустить сервер в тестовом режиме (отключает rate limiting)
cd server && NODE_ENV=test npm run dev

# 3. Запустить нагрузочные тесты (из корня проекта)
npm run test:k6:smoke     # Дымовой тест
npm run test:k6:load      # Нагрузочный тест
npm run test:k6:stress    # Стресс-тест
npm run test:k6:spike     # Спайк-тест
npm run test:k6:soak      # Тест на выносливость

# Или напрямую через k6 CLI
k6 run k6/scenarios/smoke.js
k6 run -e BASE_URL=http://localhost:4000 k6/scenarios/load.js
```

### Через Docker (полный стек в контейнерах)

```bash
# Запуск дымового теста
npm run test:k6:docker:smoke

# Запуск нагрузочного теста
npm run test:k6:docker:load

# Запуск стресс-теста
npm run test:k6:docker:stress

# Или напрямую через docker compose
docker compose -f docker-compose.yml -f docker-compose.k6.yml \
  run --rm k6 run /scripts/scenarios/smoke.js
```

## Переменные окружения

| Переменная | По умолчанию | Описание |
|------------|-------------|----------|
| `BASE_URL` | `http://localhost:4000` | URL сервера |
| `POOL_SIZE` | `50` | Размер пула тестовых пользователей |

Передача через CLI:

```bash
k6 run -e BASE_URL=https://staging.example.com -e POOL_SIZE=100 k6/scenarios/load.js
```

## Сценарии

### Smoke (дымовой)

- **VU:** 2
- **Длительность:** 30 секунд
- **Цель:** Проверить работоспособность всех API-эндпоинтов
- **Пороги:** p95 < 500мс, ошибки < 1%

### Load (нагрузочный)

- **VU:** 0 → 10 → 20 → 50 → 20 → 0
- **Длительность:** 5 минут
- **Цель:** Проверить производительность при нормальном трафике
- **Пороги:** p95 < 1с, ошибки < 5%
- **Распределение:** 60% читатели, 15% авторы, 15% анонимы, 10% админы

### Stress (стресс)

- **VU:** 0 → 50 → 100 → 200 → 100 → 50 → 0
- **Длительность:** 10 минут
- **Цель:** Найти точку отказа
- **Пороги:** p95 < 3с, ошибки < 15%

### Spike (спайк)

- **VU:** 10 → 200 (мгновенно) → 200 → 10
- **Длительность:** ~5 минут
- **Цель:** Проверить устойчивость при резком всплеске
- **Пороги:** p95 < 5с, ошибки < 20%

### Soak (выносливость)

- **VU:** 30 (постоянно)
- **Длительность:** 30 минут
- **Цель:** Выявить утечки памяти и деградацию
- **Пороги:** p95 < 1.5с, ошибки < 5%

## Аутентификация

Тесты реализуют полный цикл CSRF + сессионной аутентификации:

1. `GET /api/v1/auth/csrf-token` — получение CSRF-токена (устанавливает cookie `__csrf`)
2. `POST /api/v1/auth/register` или `/login` — с заголовком `x-csrf-token`
3. После входа сессия пересоздаётся (`session.regenerate`) — CSRF-токен обновляется

Каждый VU получает собственную сессию. Пул пользователей создаётся в фазе `setup()`.

## Rate Limiting

Для корректного нагрузочного тестирования сервер должен работать с `NODE_ENV=test`,
что отключает все rate limiters (см. `server/src/middleware/rateLimit.ts`).

Docker override (`docker-compose.k6.yml`) автоматически устанавливает `NODE_ENV=test`.

## Интерпретация результатов

Ключевые метрики k6:

| Метрика | Описание |
|---------|----------|
| `http_req_duration` | Время отклика (p50, p90, p95, p99) |
| `http_req_failed` | Процент неуспешных запросов |
| `http_reqs` | Количество запросов в секунду |
| `iteration_duration` | Длительность полного пользовательского сценария |
| `checks` | Процент пройденных проверок |

Пример вывода:

```
✓ Health check — status 200
✓ List books — status 200
✓ Save progress — status 200

http_req_duration..........: avg=120ms  min=15ms  med=95ms  max=2.1s   p(90)=250ms  p(95)=450ms
http_req_failed............: 0.50%  ✓ 12  ✗ 2388
http_reqs..................: 2400   80/s
```

## Добавление новых сценариев

1. Создайте файл в `k6/flows/` с функцией потока
2. Импортируйте хелперы из `k6/lib/`
3. Создайте сценарий в `k6/scenarios/` с настройками `options`
4. Добавьте npm-скрипт в `package.json` (опционально)
