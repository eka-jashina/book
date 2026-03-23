# Локальный запуск Foliant — пошаговая инструкция

Подробная инструкция по развёртыванию фронтенда и бэкенда проекта Foliant на локальной машине с помощью Docker.

---

## Содержание

1. [Что понадобится](#1-что-понадобится)
2. [Установка Docker](#2-установка-docker)
3. [Клонирование проекта](#3-клонирование-проекта)
4. [Установка зависимостей](#4-установка-зависимостей)
5. [Запуск инфраструктуры (Docker)](#5-запуск-инфраструктуры-docker)
6. [Запуск бэкенда](#6-запуск-бэкенда)
7. [Запуск фронтенда](#7-запуск-фронтенда)
8. [Проверка что всё работает](#8-проверка-что-всё-работает)
9. [Частые проблемы и решения](#9-частые-проблемы-и-решения)
10. [Полезные команды](#10-полезные-команды)
11. [Остановка и очистка](#11-остановка-и-очистка)
12. [Ежедневный запуск](#ежедневный-запуск-сценарий-включила-комп--начала-работать)
13. [Шпаргалка: порты и диагностика](#шпаргалка-порты-процессы-и-диагностика)

---

## 1. Что понадобится

| Инструмент | Минимальная версия | Для чего |
|------------|-------------------|----------|
| **Docker** | 24+ | Контейнеры (PostgreSQL, MinIO, сервер) |
| **Docker Compose** | v2+ (входит в Docker Desktop) | Оркестрация контейнеров |
| **Node.js** | 18+ (рекомендуется 22) | Фронтенд и бэкенд |
| **npm** | 9+ | Менеджер пакетов |
| **Git** | любая | Клонирование репозитория |

---

## 2. Установка Docker

### macOS

1. Скачайте **Docker Desktop** с официального сайта: https://www.docker.com/products/docker-desktop/
2. Откройте скачанный `.dmg` файл
3. Перетащите иконку Docker в папку Applications
4. Запустите Docker Desktop из Applications
5. Дождитесь, пока иконка Docker в панели меню перестанет анимироваться (это значит Docker запущен)

Или через Homebrew:
```bash
brew install --cask docker
open /Applications/Docker.app
```

### Windows

1. Скачайте **Docker Desktop** с https://www.docker.com/products/docker-desktop/
2. Запустите установщик `Docker Desktop Installer.exe`
3. Убедитесь, что в процессе установки отмечен пункт **«Use WSL 2 instead of Hyper-V»** (рекомендуется)
4. Нажмите **OK** и дождитесь завершения установки
5. Перезагрузите компьютер, если установщик попросит
6. Запустите Docker Desktop из меню «Пуск»
7. Дождитесь, пока Docker полностью запустится (зелёный индикатор в левом нижнем углу)

**Если у вас нет WSL 2:**
```powershell
# Откройте PowerShell от администратора и выполните:
wsl --install
# Перезагрузите компьютер
```

### Linux (Ubuntu / Debian)

```bash
# 1. Обновите систему
sudo apt update && sudo apt upgrade -y

# 2. Установите зависимости
sudo apt install -y ca-certificates curl gnupg

# 3. Добавьте GPG-ключ Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# 4. Добавьте репозиторий Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 5. Установите Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 6. Добавьте себя в группу docker (чтобы не писать sudo)
sudo usermod -aG docker $USER

# 7. Перелогиньтесь (или выполните):
newgrp docker
```

### Проверка установки

```bash
docker --version
# Ожидаемый вывод: Docker version 27.x.x (или новее)

docker compose version
# Ожидаемый вывод: Docker Compose version v2.x.x
```

---

## 3. Клонирование проекта

```bash
git clone https://github.com/eka-jashina/flipbook.git
cd flipbook
```

---

## 4. Установка зависимостей

### Фронтенд (корень проекта)

```bash
# Убедитесь, что вы в корне проекта
pwd
# Должно быть: .../flipbook

npm install
```

### Бэкенд (папка server/)

```bash
cd server
npm install
cd ..
```

---

## 5. Запуск инфраструктуры (Docker)

Docker Compose поднимает 3 сервиса:
- **PostgreSQL 17** — база данных (порт 5432)
- **MinIO** — S3-совместимое хранилище файлов (порты 9000, 9001)
- **Автоматическая миграция** — применяет схему БД при первом запуске

### 5.1. Запустите контейнеры

```bash
docker compose up -d
```

Эта команда:
- Скачает образы PostgreSQL и MinIO (при первом запуске, ~300 МБ)
- Создаст и запустит контейнеры
- Создаст базу данных `flipbook`
- Создаст бакет `flipbook-uploads` в MinIO
- Применит Prisma-миграции

Дождитесь завершения (1–3 минуты при первом запуске).

### 5.2. Проверьте, что всё поднялось

```bash
docker compose ps
```

Вы должны увидеть примерно такое:

```
NAME                  STATUS
flipbook-postgres-1   Up (healthy)
flipbook-minio-1      Up (healthy)
flipbook-server-1     Up (healthy)
flipbook-minio-init-1 Exited (0)    ← это нормально, он одноразовый
flipbook-migrate-1    Exited (0)    ← это нормально, он одноразовый
```

Если `postgres` или `minio` не в статусе `Up (healthy)` — подождите ещё минуту и проверьте снова.

### 5.3. Проверьте доступность сервисов

```bash
# Бэкенд API
curl http://localhost:4000/api/health
# Ожидаемый ответ: {"status":"ok"} или аналогичный

# MinIO Console (веб-интерфейс хранилища)
# Откройте в браузере: http://localhost:9001
# Логин: minioadmin
# Пароль: minioadmin
```

---

## 6. Запуск бэкенда

> **Примечание:** Если вы используете `docker compose up -d` как описано выше, бэкенд уже запущен внутри Docker на порту 4000. Этот раздел нужен, если вы хотите запустить бэкенд **вне Docker** (например, для отладки с hot-reload).

### Вариант А: Бэкенд в Docker (рекомендуется)

Бэкенд уже работает после `docker compose up -d`. Переходите к разделу 7.

### Вариант Б: Бэкенд локально (для разработки)

Если вы хотите запускать сервер локально (с hot-reload через tsx):

1. Остановите Docker-версию сервера:
```bash
docker compose stop server
```

2. Создайте файл `server/.env` на основе шаблона:
```bash
cp server/.env.example server/.env
```

3. Отредактируйте `server/.env`:
```env
PORT=4000
NODE_ENV=development

# БД (подключение к Docker PostgreSQL)
DATABASE_URL=postgresql://flipbook:flipbook_dev@localhost:5432/flipbook

# Секреты сессий (придумайте любые строки ≥32 символа)
SESSION_SECRET=my-super-secret-session-key-minimum-32-characters
CSRF_SECRET=my-super-secret-csrf-key-that-differs-from-session

# Куки без HTTPS (для localhost)
SESSION_SECURE=false

# S3 / MinIO (подключение к Docker MinIO)
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=flipbook-uploads
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_URL=http://localhost:9000/flipbook-uploads

# CORS
CORS_ORIGIN=http://localhost:3000
APP_URL=http://localhost:3000

# Google OAuth (необязательно для базового тестирования)
GOOGLE_CLIENT_ID=placeholder
GOOGLE_CLIENT_SECRET=placeholder
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
```

4. Примените миграции и запустите:
```bash
cd server
npx prisma migrate deploy
npm run dev
cd ..
```

Сервер запустится на `http://localhost:4000` с автоматической перезагрузкой при изменении кода.

---

## 7. Запуск фронтенда

```bash
# Из корня проекта
npm run dev
```

Vite dev-сервер запустится и автоматически откроет браузер на `http://localhost:3000`.

Все запросы к `/api/*` автоматически проксируются на бэкенд (`http://localhost:4000`).

---

## 8. Проверка что всё работает

### Откройте браузер

Перейдите на **http://localhost:3000**

Вы должны увидеть лендинг Foliant:
- Заголовок «Foliant» с золотым градиентом
- Слоган «Каждая страница — событие»
- Табы «Книги» / «Фотоальбомы» (переключаются автоматически каждые 6 секунд)
- Секции «Для кого», «Как это работает», «Возможности»

### Протестируйте основные сценарии

1. **Регистрация:**
   - Нажмите «Создать книгу» или «Начать бесплатно»
   - В открывшемся модальном окне создайте аккаунт (email + пароль)

2. **Создание книги:**
   - После регистрации вы попадёте на книжную полку
   - Нажмите «+» чтобы создать новую книгу
   - Загрузите текстовый файл или создайте книгу с нуля

3. **Чтение:**
   - Откройте созданную книгу
   - Проверьте 3D-перелистывание (клик по краям страницы или стрелки клавиатуры)

4. **Настройки:**
   - Проверьте смену шрифта, темы, размера текста
   - Проверьте звуки перелистывания и атмосферную музыку

### Проверка API напрямую

```bash
# Здоровье бэкенда
curl http://localhost:4000/api/health

# Публичные книги (витрина лендинга)
curl http://localhost:4000/api/v1/public/discover?limit=6
```

---

## 9. Частые проблемы и решения

### «Port 5432 already in use» (порт PostgreSQL занят)

У вас уже запущен локальный PostgreSQL. Варианты:
```bash
# Вариант 1: Остановите локальный PostgreSQL
sudo systemctl stop postgresql     # Linux
brew services stop postgresql      # macOS

# Вариант 2: Измените порт в docker-compose.yml
# Замените "5432:5432" на "5433:5432" в секции ports сервиса postgres
```

### «Port 9000 already in use» (порт MinIO занят)

Возможно, порт используется другим сервисом. Измените порт в `docker-compose.yml`:
```yaml
minio:
  ports:
    - "9002:9000"    # Было 9000:9000
    - "9003:9001"    # Было 9001:9001
```

И обновите `S3_ENDPOINT` соответственно.

### «docker compose: command not found»

У вас старая версия Docker без встроенного Compose v2:
```bash
# Проверьте, есть ли docker-compose (через дефис)
docker-compose --version

# Если есть — используйте docker-compose вместо docker compose
docker-compose up -d
```

Или обновите Docker Desktop до последней версии.

### Контейнер server не стартует / падает

Проверьте логи:
```bash
docker compose logs server
docker compose logs migrate
```

Частая причина — миграция не прошла. Попробуйте:
```bash
docker compose down
docker compose up -d
```

### «ECONNREFUSED» при обращении к API с фронтенда

Убедитесь, что:
1. Бэкенд запущен: `docker compose ps` — сервис `server` в статусе `Up`
2. Фронтенд запущен через `npm run dev` (не `npm run preview`)
3. Proxy в vite настроен на порт 4000 (проверьте `vite.config.js`)

### MinIO: файлы не загружаются

Проверьте что бакет создан:
```bash
# Откройте MinIO Console: http://localhost:9001
# Логин: minioadmin / minioadmin
# Убедитесь, что бакет flipbook-uploads существует
```

Если бакет не создан, перезапустите инициализацию:
```bash
docker compose restart minio-init
```

### Node.js не подходящей версии

```bash
node --version
# Нужна 18+, рекомендуется 22

# Если используете nvm:
nvm install 22
nvm use 22
```

---

## 10. Полезные команды

### Docker

```bash
# Статус контейнеров
docker compose ps

# Логи всех сервисов (в реальном времени)
docker compose logs -f

# Логи конкретного сервиса
docker compose logs -f server
docker compose logs -f postgres

# Перезапустить сервис
docker compose restart server

# Пересобрать и перезапустить (после изменения Dockerfile или зависимостей)
docker compose up -d --build
```

### База данных

```bash
# Применить миграции вручную
cd server && npx prisma migrate deploy

# Заполнить БД тестовыми данными
cd server && npx prisma db seed

# Открыть Prisma Studio (GUI для БД)
cd server && npx prisma studio
# Откроется в браузере на http://localhost:5555

# Подключиться к PostgreSQL напрямую
docker compose exec postgres psql -U flipbook -d flipbook
```

### Тесты

```bash
# Фронтенд: юнит + интеграционные тесты
npm run test:run

# Фронтенд: тесты с покрытием
npm run test:coverage

# Бэкенд: API-тесты
cd server && npm run test

# E2E тесты (Playwright, требуется запущенный dev-сервер)
npm run test:e2e:headed
```

### Линтинг

```bash
npm run lint           # Проверить JS + CSS
npm run lint:js:fix    # Автоисправление JS
npm run lint:css:fix   # Автоисправление CSS
```

---

## 11. Остановка и очистка

### Остановить контейнеры (данные сохраняются)

```bash
docker compose down
```

### Остановить и удалить данные (чистый старт)

```bash
# Удалит контейнеры, сети и volumes (БД, файлы MinIO)
docker compose down -v
```

### Полная очистка (освободить место на диске)

```bash
# Остановить и удалить всё
docker compose down -v

# Удалить неиспользуемые Docker-образы
docker image prune -a

# Удалить всё неиспользуемое (образы, контейнеры, сети, volumes)
docker system prune -a --volumes
```

---

## Архитектура при локальной разработке

```
┌──────────────────────────────────────────────────────┐
│                    Ваш браузер                       │
│              http://localhost:3000                    │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────┐
│            Vite Dev Server (порт 3000)               │
│   Отдаёт HTML/CSS/JS + проксирует /api → :4000      │
│                 npm run dev                           │
└──────────────────┬───────────────────────────────────┘
                   │ /api/*
                   ▼
┌──────────────────────────────────────────────────────┐
│           Express Server (порт 4000)                 │
│          REST API + аутентификация                   │
│           docker compose (server)                    │
└──────────┬────────────────────┬──────────────────────┘
           │                    │
           ▼                    ▼
┌─────────────────┐  ┌────────────────────┐
│   PostgreSQL    │  │       MinIO        │
│   порт 5432     │  │  порт 9000 (API)   │
│   БД: flipbook  │  │  порт 9001 (UI)    │
│                 │  │  Бакет: flipbook-  │
│                 │  │  uploads           │
└─────────────────┘  └────────────────────┘

      Всё в Docker              Всё в Docker
```

---

## Быстрый старт (TL;DR)

```bash
# 1. Клонировать
git clone https://github.com/eka-jashina/flipbook.git && cd flipbook

# 2. Установить зависимости
npm install && cd server && npm install && cd ..

# 3. Поднять инфраструктуру
docker compose up -d

# 4. Дождаться готовности (~1-2 мин)
docker compose ps   # все healthy

# 5. Запустить фронтенд
npm run dev

# 6. Открыть http://localhost:3000 — готово!
```

---

## Ежедневный запуск (сценарий «включила комп — начала работать»)

Проект уже склонирован и зависимости установлены. Нужно просто всё поднять.

### Шаг 1. Запусти Docker Desktop

Открой приложение Docker Desktop и дождись, пока иконка в трее перестанет анимироваться (зелёный индикатор = готов).

### Шаг 2. Подтяни свежий код

```bash
cd ~/Documents/GitHub/flipbook
git pull origin main
```

### Шаг 3. Подними инфраструктуру

```bash
docker compose up -d --build
```

Это запустит PostgreSQL (порт 5432), MinIO (порт 9000) и пересоберёт бэкенд (порт 4000) с учётом новых изменений. Если код бэкенда не менялся, `--build` просто использует кэш и отработает быстро.

> **Если после `git pull` изменились зависимости** (`package.json`), сначала:
> ```bash
> npm install
> cd server && npm install && cd ..
> ```
>
> **Если прилетели миграции БД** (`server/prisma/migrations/`):
> ```bash
> cd server && npx prisma migrate deploy && cd ..
> ```

### Шаг 4. Запусти фронтенд

```bash
npm run dev
```

Vite стартует на порту 3000, откроется браузер. **Готово, работай.**

### Шаг 5. Завершение работы

```bash
# Останови Vite — Ctrl+C в терминале
# Останови контейнеры:
docker compose down
```

### Если бэкенд запускаешь локально (не в Docker)

Нужны **два терминала**:

```bash
# Терминал 1: бэкенд
docker compose stop server          # Останови Docker-версию
cd server && npm run dev            # Запусти локально (порт 4000)

# Терминал 2: фронтенд
npm run dev                         # Порт 3000
```

---

## Шпаргалка: порты, процессы и диагностика

### Кто занял порт?

```bash
# Git Bash
netstat -ano | findstr :3000

# PowerShell
Get-NetTCPConnection -LocalPort 3000
```

### Что за процесс по PID?

```bash
# Git Bash (двойные слэши — обязательно!)
tasklist //FI "PID eq 1234"

# CMD / PowerShell (одинарные)
tasklist /FI "PID eq 1234"
```

### Убить процесс

```bash
# Git Bash
taskkill //F //PID 1234

# CMD / PowerShell
taskkill /F /PID 1234
```

### Git Bash — ловушка со слэшами

Git Bash превращает `/F` в `C:/Program Files/Git/F`. Всегда используй `//`:

| CMD / PowerShell | Git Bash |
|------------------|----------|
| `tasklist /FI` | `tasklist //FI` |
| `taskkill /F /PID` | `taskkill //F //PID` |

### Типичные процессы на портах

| Процесс | Что это | Убивать? |
|----------|---------|----------|
| `node.exe` | Vite / Express dev-сервер | Да, если мешает |
| `com.docker.backend.exe` | Docker Desktop | Лучше `docker compose down` |
| `wslrelay.exe` | Проброс портов WSL → Windows | Нет, системный |

### Порты проекта

| Порт | Сервис | Как запускается |
|------|--------|-----------------|
| 3000 | Vite (фронтенд) | `npm run dev` |
| 4000 | Express (бэкенд) | `docker compose up -d` или `cd server && npm run dev` |
| 4173 | Vite preview | `npm run preview` |
| 5432 | PostgreSQL | `docker compose up -d` |
| 9000 | MinIO (S3 API) | `docker compose up -d` |
| 9001 | MinIO (веб-панель) | `docker compose up -d` |

### Быстрая диагностика «порт занят»

```bash
# 1. Найти PID
netstat -ano | findstr :3000

# 2. Узнать процесс
tasklist //FI "PID eq <PID>"

# 3. Решить
#    node.exe              → taskkill //F //PID <PID>
#    com.docker.backend    → docker compose down
#    wslrelay              → не трогать, это нормально
```
