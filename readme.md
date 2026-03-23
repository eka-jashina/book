# Foliant

> Платформа для создания интерактивных книг и фотоальбомов с реалистичным 3D-перелистыванием

*Каждая страница — событие*

[![Deploy to GitHub Pages](https://github.com/eka-jashina/flipbook/actions/workflows/deploy.yml/badge.svg)](https://github.com/eka-jashina/flipbook/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

[![Vanilla JS](https://img.shields.io/badge/Vanilla-JavaScript-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![ES Modules](https://img.shields.io/badge/ES-Modules-4285F4)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
[![Vite](https://img.shields.io/badge/Vite-7.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![CSS3](https://img.shields.io/badge/CSS3-3D%20Transforms-1572B6?logo=css3)](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Transforms)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

[![Express](https://img.shields.io/badge/Express-5.0-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.0-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

[![Vitest](https://img.shields.io/badge/Vitest-4.0-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)
[![ESLint](https://img.shields.io/badge/ESLint-9.x-4B32C3?logo=eslint&logoColor=white)](https://eslint.org/)
[![Stylelint](https://img.shields.io/badge/Stylelint-17.x-263238?logo=stylelint&logoColor=white)](https://stylelint.io/)

[**Live Demo**](https://eka-jashina.github.io/flipbook/) · [Документация](./CLAUDE.md)

---

## Что такое Foliant?

Foliant — платформа, на которой авторы и фотографы создают интерактивные книги и фотоальбомы с реалистичным 3D-перелистыванием. Читатели листают страницы как настоящую книгу — с физикой, тенями, звуками и атмосферой.

### Как это работает

1. **Загрузите** — текст, фотографии или готовый файл (TXT, DOCX, EPUB, FB2)
2. **Оформите** — обложку, шрифты, звуки перелистывания, атмосферу
3. **Поделитесь** — опубликуйте и отправьте ссылку читателям или клиентам

### Для кого

**Для авторов и писателей:**
- Загружайте тексты (TXT, DOCX, EPUB, FB2) или пишите в редакторе
- Настраивайте обложку, шрифты, фоны, цвета
- Добавляйте звуки перелистывания и атмосферную музыку
- Публикуйте и делитесь с читателями
- Создавайте авторскую полку со всеми работами

**Для фотографов:**
- Создавайте альбомы для клиентов: свадьбы, портреты, репортажи
- Каждый снимок — на отдельной странице с эффектом перелистывания
- Настраивайте обложку и оформление под свой стиль
- Собирайте портфолио с wow-эффектом
- Отправляйте ссылку вместо архива файлов

---

## Возможности

### Ключевые

- **3D-перелистывание** — реалистичная физика, тени, анимация страниц (CSS 3D-трансформации)
- **Звуковое оформление** — шелест страниц, дождь, камин, атмосфера кафе
- **Полная кастомизация** — обложка, шрифты, цвета, текстуры страниц
- **Фотоальбомы** — лайтбокс, кроппер, полноэкранные страницы
- **Мобильная версия** — перелистывание свайпом на телефонах и планшетах
- **Авторские профили** — публичная полка с работами и персональная ссылка

### Платформа

- **Мультикнижность** — поддержка нескольких книг, per-book прогресс чтения (кнопка «Продолжить чтение»)
- **Импорт книг** — загрузка из форматов TXT, DOC, DOCX, EPUB, FB2
- **WYSIWYG-редактор** — редактирование глав через Quill с поддержкой форматирования, таблиц и изображений
- **Книжная полка** — стартовый экран с карточками книг, контекстное меню (читать / редактировать / удалить)
- **Личный кабинет** — управление книгами, главами, шрифтами, звуками, оформлением, профилем
- **Публичное обнаружение книг** — просмотр опубликованных книг других авторов, авторские полки
- **Мультиязычность (i18n)** — 5 языков: русский, английский, испанский, французский, немецкий (через i18next)
- **SPA-роутинг** — навигация по History API (лендинг → полка → читалка → кабинет)

### Техническая база

- **Бэкенд-сервер** — REST API, авторизация (email/пароль + Google OAuth), S3 файловое хранилище
- **Двойная персистентность** — localStorage/IndexedDB (офлайн) или серверный API (авторизованные пользователи)
- **Миграция данных** — автоматический перенос из localStorage на сервер при первом логине
- **PWA** — установка как приложение, офлайн-доступ через Service Worker
- **Мониторинг ошибок** — Sentry интеграция (клиент + сервер)
- **Нагрузочное тестирование** — K6 (smoke, load, stress, spike, soak сценарии)
- **Сессии чтения** — трекинг прочитанных страниц, длительности, аналитика по книгам
- **Web Vitals** — мониторинг производительности (LCP, FID, CLS через web-vitals)
- **Prometheus-метрики** — эндпоинт серверных метрик для мониторинга
- **Lighthouse CI** — автоматические проверки качества (производительность, доступность, SEO)
- **Сканирование безопасности** — npm audit + Trivy для Docker-образов
- **SEO** — robots.txt, sitemap.xml, серверный SEO-сервис

---

## Архитектурные решения

### Паттерны проектирования

| Паттерн | Реализация | Назначение |
|---------|------------|------------|
| **State Machine** | `BookStateMachine` | Гарантия валидных переходов между состояниями книги |
| **Observer** | `EventEmitter` | Слабое связывание компонентов через события |
| **Dependency Injection** | `BookController` | Тестируемость и модульность |
| **Builder** | `BookControllerBuilder` | Пофазное конструирование графа зависимостей |
| **Factory** | `ComponentFactory` | Централизованное создание компонентов |
| **Delegate** | `delegates/` | Разделение ответственности по доменам |
| **Mediator** | `DelegateMediator` | Коммуникация между делегатами |
| **Double Buffering** | `BookRenderer` | Плавные переходы между страницами |
| **LRU Cache** | `LRUCache` | Оптимизация производительности пагинации |
| **Adapter** | `ServerAdminConfigStore` | Единый интерфейс, серверный бэкенд |
| **Service Groups** | `services/` | Группировка связанных зависимостей для DI |

### Конечный автомат состояний

```
┌────────┐      ┌─────────┐      ┌────────┐
│ CLOSED │ ───▶ │ OPENING │ ───▶ │ OPENED │ ◀─┐
└────────┘      └─────────┘      └────────┘   │
    ▲                                │        │
    │           ┌─────────┐          ▼        │
    └────────── │ CLOSING │ ◀── ┌──────────┐  │
                └─────────┘     │ FLIPPING │ ─┘
                                └──────────┘
```

Все переходы между состояниями валидируются. Недопустимые переходы отклоняются с логированием.

### Поток данных

```
User Input (click / touch / keyboard)
          │
          ▼
    ┌─────────────────┐
    │ EventController │  ← Нормализация событий
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │    Delegate     │  ← Navigation / Drag / Settings / Lifecycle
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ BookController  │  ← Координатор + State Machine
    └────────┬────────┘
             │
      ┌──────┴──────┐
      ▼             ▼
┌───────────┐ ┌───────────┐
│ Animator  │ │ Renderer  │  ← CSS-анимации + DOM-рендеринг
└─────┬─────┘ └─────┬─────┘
      │             │
      └──────┬──────┘
             ▼
           DOM
```

---

## Структура проекта

```
flipbook/
├── index.html                     # Точка входа — SPA (лендинг + полка + читалка + кабинет)
│
├── js/
│   ├── index.js                    # Точка входа
│   ├── config.js                   # Конфигурация (admin-aware, мультикнижная)
│   ├── sentry.js                   # Sentry мониторинг ошибок
│   ├── types.js                    # Определения типов (TypeScript-style)
│   ├── config/                     # Вспомогательные модули конфигурации
│   │   ├── configHelpers.js        # Чистые хелперы: пути, шрифты, амбиенты
│   │   └── enrichConfigFromIDB.js  # Дозагрузка данных из IndexedDB
│   │
│   ├── i18n/                       # Интернационализация (i18next)
│   │   ├── index.js                # Инициализация и хелперы (initI18n, t, setLanguage)
│   │   └── locales/                # Файлы переводов
│   │       ├── index.js            # Точка входа локалей
│   │       ├── ru.js / en.js / es.js / fr.js / de.js
│   │
│   ├── utils/                      # Низкоуровневые утилиты
│   │   ├── Analytics.js            # Web Vitals мониторинг (LCP, FID, CLS)
│   │   ├── ApiClient.js            # HTTP API клиент (связь с сервером)
│   │   ├── Router.js               # SPA-роутер (History API)
│   │   ├── EventEmitter.js         # Реализация паттерна Observer
│   │   ├── EventListenerManager.js # Автоматическая очистка listeners
│   │   ├── LRUCache.js             # Кэш с вытеснением
│   │   ├── CSSVariables.js         # Чтение CSS Custom Properties
│   │   ├── MediaQueryManager.js    # Реактивные media queries
│   │   ├── TransitionHelper.js     # Промисификация CSS transitions
│   │   ├── TimerManager.js         # Управление таймерами с debounce
│   │   ├── HTMLSanitizer.js        # Защита от XSS (движок DOMPurify)
│   │   ├── ErrorHandler.js         # Централизованная обработка ошибок
│   │   ├── StorageManager.js       # Абстракция над localStorage
│   │   ├── IdbStorage.js           # IndexedDB-обёртка для крупных данных
│   │   ├── SettingsValidator.js    # Валидация и санитизация настроек
│   │   ├── RateLimiter.js          # Ограничение частоты вызовов
│   │   ├── InstallPrompt.js        # PWA-промпт установки
│   │   ├── OfflineIndicator.js     # Индикатор офлайн-режима
│   │   ├── ScreenReaderAnnouncer.js # Анонсы для скринридеров
│   │   ├── SwipeHint.js            # Подсказка жеста свайпа (мобильные)
│   │   └── PhotoLightbox.js        # Лайтбокс фотоальбома
│   │
│   ├── routes/                     # Обработчики SPA-маршрутов
│   │   └── handlers.js             # Функции-обработчики для Router
│   │
│   ├── managers/                   # Бизнес-логика и данные
│   │   ├── BookStateMachine.js     # Конечный автомат состояний
│   │   ├── SettingsManager.js      # Персистентные настройки (localStorage)
│   │   ├── ContentLoader.js        # Загрузка HTML-контента глав
│   │   ├── AsyncPaginator.js       # CSS multi-column пагинация
│   │   ├── BackgroundManager.js    # Кроссфейд фонов глав
│   │   ├── SoundManager.js         # Управление звуковыми эффектами
│   │   └── AmbientManager.js       # Фоновые ambient-звуки
│   │
│   ├── core/                       # Ядро приложения
│   │   ├── BookController.js       # Главный координатор (DI-контейнер)
│   │   ├── BookControllerBuilder.js # Конструирование графа зависимостей
│   │   ├── BookDIConfig.js         # Конфигурация DI для делегатов
│   │   ├── ComponentFactory.js     # Фабрика компонентов
│   │   ├── DOMManager.js           # Централизованный доступ к DOM
│   │   ├── BookRenderer.js         # Рендеринг страниц (double buffering)
│   │   ├── BookAnimator.js         # Оркестрация CSS-анимаций
│   │   ├── EventController.js      # Обработка пользовательского ввода
│   │   ├── SettingsBindings.js     # Привязки UI настроек (шрифт, тема, звук)
│   │   ├── LoadingIndicator.js     # UI индикатора загрузки
│   │   ├── DebugPanel.js           # Панель отладки (dev)
│   │   ├── AppInitializer.js       # Инициализация приложения
│   │   ├── AuthModal.js            # Модалка логина/регистрации (email + Google OAuth)
│   │   ├── MigrationHelper.js      # Миграция данных localStorage → сервер
│   │   ├── SubscriptionManager.js  # Управление подписками на события
│   │   ├── ResizeHandler.js        # Обработка изменения размера окна
│   │   ├── DelegateMediator.js     # Коммуникация между делегатами
│   │   ├── LandingScreen.js        # Лендинг для гостей (витрина публичных книг)
│   │   ├── BookshelfScreen.js      # Экран книжной полки (мультикнижность)
│   │   ├── AccountScreen.js        # Личный кабинет (книги, профиль, настройки, экспорт)
│   │   ├── AccountScreenUI.js     # Хелперы рендеринга UI кабинета
│   │   ├── AccountPublishTab.js   # Вкладка публикации книг (видимость, описание)
│   │   ├── ProfileHeader.js        # Компонент профиля (аватар, имя, био)
│   │   ├── bookshelfUtils.js       # Утилиты книжной полки
│   │   │
│   │   ├── services/               # Сервисные группы (DI)
│   │   │   ├── CoreServices.js         # DOM, события, таймеры, storage
│   │   │   ├── AudioServices.js        # Звуки и ambient
│   │   │   ├── RenderServices.js       # Рендеринг и анимации
│   │   │   └── ContentServices.js      # Загрузка и пагинация контента
│   │   │
│   │   └── delegates/              # Делегаты по доменам
│   │       ├── BaseDelegate.js         # Абстрактный базовый класс
│   │       ├── NavigationDelegate.js   # Логика перелистывания
│   │       ├── DragDelegate.js         # Touch-перетаскивание страниц
│   │       ├── DragAnimator.js         # Анимация угла поворота при drag
│   │       ├── DragDOMPreparer.js      # Подготовка DOM для drag
│   │       ├── DragShadowRenderer.js   # Рендеринг теней при drag
│   │       ├── SettingsDelegate.js     # UI настроек
│   │       ├── ChapterDelegate.js      # Переключение глав
│   │       ├── LifecycleDelegate.js    # Открытие/закрытие книги
│   │       ├── AudioController.js      # Управление аудио и ambient
│   │       ├── FontController.js       # Управление шрифтами
│   │       └── ThemeController.js      # Управление темами оформления
│   │
│   └── admin/                      # Админ-панель (вкладки в личном кабинете)
│       ├── index.js                # Точка входа админки
│       ├── AdminConfigStore.js     # Персистентное хранилище конфига (localStorage/IndexedDB)
│       ├── ServerAdminConfigStore.js # Серверный конфиг (API-адаптер)
│       ├── AdminConfigDefaults.js  # Константы дефолтных значений конфига
│       ├── AdminConfigMigration.js # Валидация и нормализация схемы конфига
│       ├── AdminConfigStrip.js     # Стриппинг data URL для localStorage
│       ├── ServerConfigOperations.js # Серверные CRUD-операции конфига
│       ├── BookParser.js           # Диспетчер парсинга книг
│       ├── modeCardsData.js        # Данные карточек режимов создания книг
│       ├── modules/                # Функциональные модули админки
│       │   ├── BaseModule.js           # Абстрактный базовый модуль
│       │   ├── adminHelpers.js        # Общие хелперы админ-панели
│       │   ├── albumConstants.js      # Константы конфигурации альбома
│       │   ├── AlbumManager.js         # Управление фотоальбомом
│       │   ├── AlbumHtmlBuilder.js    # Генерация HTML альбома
│       │   ├── AlbumImageProcessor.js # Обработка и загрузка изображений альбома
│       │   ├── AlbumPageRenderer.js   # Рендеринг страниц альбома
│       │   ├── AmbientsModule.js       # Настройка ambient-звуков
│       │   ├── AppearanceModule.js     # Кастомизация оформления книги
│       │   ├── BookSelectorManager.js  # Выбор книги
│       │   ├── BookUploadManager.js    # Загрузка книг
│       │   ├── CoverManager.js         # Управление обложкой книги
│       │   ├── ChaptersModule.js       # Управление главами
│       │   ├── ChapterFileHandler.js   # Загрузка файлов глав
│       │   ├── ExportModule.js         # Экспорт конфигурации
│       │   ├── FontsModule.js          # Управление шрифтами
│       │   ├── PhotoCropper.js         # Интерактивный инструмент обрезки фото
│       │   ├── ProfileModule.js        # Управление профилем (username, био, аватар)
│       │   ├── QuillEditorWrapper.js   # Обёртка WYSIWYG-редактора Quill
│       │   ├── SettingsModule.js       # Глобальные настройки
│       │   └── SoundsModule.js         # Управление звуковыми эффектами
│       └── parsers/                # Парсеры форматов книг
│           ├── BaseParser.js          # Абстрактный базовый парсер
│           ├── parserUtils.js          # Общие утилиты парсеров
│           ├── TxtParser.js            # Парсер .txt
│           ├── DocParser.js            # Парсер .doc (Word 97-2003)
│           ├── DocxParser.js           # Парсер .docx
│           ├── EpubParser.js           # Парсер .epub
│           ├── Fb2Parser.js            # Парсер .fb2
│           └── OLE2Parser.js           # Парсер OLE2-формата (для .doc)
│
├── css/                            # Модульная CSS-архитектура
│   ├── index.css                   # Входная точка (импорты)
│   ├── variables.css               # Design tokens (CSS Custom Properties)
│   ├── reset.css                   # Сброс браузерных стилей
│   ├── themes.css                  # Светлая / тёмная / ч/б темы
│   ├── layout.css                  # Grid/flex разметка
│   ├── book.css                    # 3D-контейнер книги
│   ├── pages.css                   # Стили страниц
│   ├── cover.css                   # Обложка книги
│   ├── sheet.css                   # Анимированный лист
│   ├── typography.css              # Типографика
│   ├── images.css                  # Стили изображений в контенте
│   ├── loading.css                 # Индикатор загрузки
│   ├── debug.css                   # Панель отладки (dev)
│   ├── animations.css              # Keyframe-анимации
│   ├── drag.css                    # Стили drag-взаимодействия
│   ├── accessibility.css           # Стили доступности (skip-link, focus)
│   ├── auth.css                    # Модалка авторизации (логин/регистрация)
│   ├── install-prompt.css          # PWA-промпт установки
│   ├── offline.css                 # Индикатор офлайн-режима
│   ├── bookshelf.css               # Экран книжной полки
│   ├── landing.css                 # Лендинг для гостей
│   ├── embed.css                   # Встраиваемый режим чтения
│   ├── photo-album.css             # Фотоальбом / лайтбокс
│   ├── swipe-hint.css              # Подсказка свайпа (мобильные)
│   ├── responsive.css              # Адаптивность
│   ├── controls/                   # Стили UI-контролов
│   │   ├── index.css               # Входная точка + общие стили
│   │   ├── pod-variables.css       # CSS-переменные контролов
│   │   ├── navigation-pod.css      # Навигация и прогресс-бар
│   │   ├── settings-pod.css        # Панель настроек
│   │   └── audio-pod.css           # Аудио-контролы
│   └── admin/                      # Стили админ-панели
│       ├── index.css               # Входная точка
│       ├── base.css                # Базовые стили
│       ├── variables.css           # CSS-переменные админки
│       ├── buttons.css             # Кнопки
│       ├── modal.css               # Модальные окна
│       ├── tabs.css                # Вкладки
│       ├── screens.css             # Экраны
│       ├── responsive.css          # Адаптивность админки
│       ├── book-selector.css       # Выбор книги
│       ├── book-upload.css         # Загрузка книги
│       ├── chapters.css            # Управление главами
│       ├── fonts.css               # Управление шрифтами
│       ├── sounds.css              # Звуки и ambient-звуки
│       ├── appearance.css          # Кастомизация оформления
│       ├── settings.css            # Настройки
│       ├── album.css               # Фотоальбом
│       ├── cropper.css             # Оверлей обрезки фото
│       ├── editor.css              # Стили WYSIWYG-редактора Quill
│       ├── export.css              # Экспорт
│       ├── profile.css             # Профиль пользователя
│       └── toast.css               # Toast-уведомления
│
├── html/                           # HTML-фрагменты (подключение при сборке)
│   └── partials/
│       ├── admin/                  # Фрагменты админ-панели (11 файлов вкл. templates.html)
│       └── reader/                 # Фрагменты читалки
│           ├── landing.html        # Лендинг (гости)
│           ├── bookshelf.html      # Книжная полка
│           ├── account.html        # Личный кабинет
│           ├── book-container.html # Контейнер книги
│           ├── controls.html       # Контролы
│           ├── pwa.html            # PWA
│           └── templates.html      # Шаблоны
│
├── shared/                        # Общий код (фронтенд + бэкенд)
│   └── parsers/                   # Общие утилиты парсеров
│       ├── baseParser.js          # Базовые утилиты парсера
│       ├── parserUtils.js         # Общие функции парсинга
│       └── index.js               # Точка входа
│
├── server/                         # Бэкенд (Express + Prisma + PostgreSQL)
│   ├── prisma/                     # Схема БД (16 моделей) + миграции
│   ├── src/
│   │   ├── routes/                 # API-маршруты (16 файлов: auth, books, chapters, profile, public, readingSessions и т.д.)
│   │   ├── services/              # Бизнес-логика (17 файлов: profile, public, readingSessions, seo, books и т.д.)
│   │   ├── middleware/            # Middleware (8 файлов: auth, CSRF, rate limit, upload, validate, metrics)
│   │   ├── parsers/               # Серверные парсеры книг (BaseParser + 5 форматов)
│   │   └── utils/                 # Утилиты сервера (14 файлов: prisma, storage, mappers и т.д.)
│   └── tests/                     # Тесты API (Vitest + supertest)
│
├── k6/                             # K6 нагрузочное тестирование
│   ├── lib/                        # Общие утилиты (auth, checks, config, endpoints)
│   ├── flows/                      # Сценарии пользователей (reader, author, browsing, admin)
│   └── scenarios/                  # Сценарии нагрузки (smoke, load, stress, spike, soak)
│
├── public/                         # Статические ресурсы
│   ├── content/                    # HTML-контент глав
│   ├── images/                     # Фоны и иллюстрации (.webp)
│   ├── fonts/                      # Кастомные шрифты (.woff2)
│   ├── icons/                      # PWA-иконки (SVG, PNG)
│   ├── sounds/                     # Аудио (перелистывание, ambient)
│   ├── robots.txt                  # SEO-директивы для роботов
│   └── sitemap.xml                 # SEO-карта сайта
│
├── tests/                          # Фронтенд-тесты
│   ├── unit/                       # Юнит-тесты (Vitest)
│   ├── integration/                # Интеграционные тесты (Vitest + jsdom)
│   └── e2e/                        # E2E-тесты (Playwright)
│
├── scripts/                       # Скрипты сборки и обслуживания
│   ├── generate-icons.js          # Генерация PWA-иконок (sharp)
│   ├── backup-db.sh               # Резервное копирование PostgreSQL
│   └── cleanup-s3-orphans.sh      # Очистка orphan-файлов в S3
│
├── infra/                         # Конфигурация инфраструктуры
│   ├── loki-config.yaml           # Конфигурация Loki (агрегация логов)
│   ├── grafana-datasources.yaml   # Provisioning data source для Grafana
│   ├── grafana-alerting.yaml      # Правила алертинга Grafana
│   └── prometheus.yaml            # Конфигурация Prometheus (scrape метрик)
│
├── .github/workflows/             # CI/CD
│   ├── deploy.yml                 # Lint → Test → E2E → Build → Deploy (GitHub Pages)
│   ├── server-tests.yml           # Тесты серверного API (PostgreSQL)
│   ├── lighthouse.yml             # Lighthouse CI аудит (производительность, доступность, SEO)
│   └── security.yml               # Сканирование безопасности (npm audit + Trivy)
│
├── .husky/                         # Git-хуки (pre-commit линтинг)
├── .nvmrc                          # Версия Node.js (22)
├── docker-compose.yml              # Docker Compose (PostgreSQL + MinIO + сервер)
├── docker-compose.k6.yml           # Docker Compose оверлей для K6
├── docker-compose.observability.yml # Docker Compose оверлей (Loki + Grafana + backup)
├── Dockerfile                      # Full-stack Docker-образ
├── LOCAL_SETUP.md                  # Руководство по локальной разработке
├── lighthouserc.json               # Конфигурация Lighthouse CI (пороги качества)
└── package.json                    # Зависимости и скрипты
```

---

## Быстрый старт

```bash
# Клонирование
git clone https://github.com/eka-jashina/flipbook.git
cd flipbook

# Установка зависимостей
npm install

# Запуск dev-сервера
npm run dev
```

### Доступные команды

| Команда | Описание |
|---------|----------|
| `npm run dev` | Запуск dev-сервера (порт 3000, авто-открытие браузера) |
| `npm run build` | Production-сборка в `dist/` |
| `npm run build:prod` | Полная очистка + сборка |
| `npm run build:analyze` | Сборка с анализом бандла |
| `npm run preview` | Превью production-сборки (порт 4173) |
| `npm run serve` | Запуск статик-сервера для `dist/` |
| `npm run size` | Проверка размера файлов в `dist/` |
| `npm run clean` | Удаление папки `dist/` |
| `npm run deploy` | Production-сборка (деплой через git push amvera main) |
| `npm run test` | Запуск unit/integration тестов (Vitest) |
| `npm run test:run` | Однократный запуск тестов |
| `npm run test:watch` | Тесты в watch-режиме |
| `npm run test:coverage` | Тесты с отчётом покрытия |
| `npm run test:ui` | Тесты с UI-интерфейсом Vitest |
| `npm run test:e2e` | Запуск E2E-тестов (Playwright) |
| `npm run test:e2e:ui` | E2E-тесты с UI-интерфейсом |
| `npm run test:e2e:debug` | E2E-тесты в режиме отладки |
| `npm run test:e2e:headed` | E2E-тесты с видимым браузером |
| `npm run test:e2e:report` | Показать отчёт E2E-тестов |
| **K6 нагрузочное тестирование** | |
| `npm run test:k6:smoke` | Smoke-тест (2 VU, 30с) |
| `npm run test:k6:load` | Нагрузочный тест (до 50 VU, 5 мин) |
| `npm run test:k6:stress` | Стресс-тест (до 200 VU, 10 мин) |
| `npm run test:k6:spike` | Spike-тест (10→200 VU мгновенно) |
| `npm run test:k6:soak` | Soak-тест (30 VU, 30 мин) |
| `npm run test:k6:docker:*` | Docker-варианты K6-тестов |
| `npm run lint` | Запуск ESLint + Stylelint |
| `npm run lint:js` | ESLint на js/ |
| `npm run lint:css` | Stylelint на css/ |
| `npm run lint:js:fix` | ESLint с автоисправлением |
| `npm run lint:css:fix` | Stylelint с автоисправлением |
| `npm run docs` | Генерация API-документации в `docs/` |
| `npm run docs:serve` | Генерация и сервер документации (порт 3001) |
| **Бэкенд (из server/)** | |
| `npm run dev` | Запуск dev-сервера (порт 4000, tsx watch) |
| `npm run test` | Тесты API (Vitest + supertest) |
| `npm run db:backup` | Резервное копирование БД |
| `npm run db:migrate` | Применить Prisma миграции |
| `npm run db:seed` | Заполнить БД тестовыми данными |
| `npm run db:studio` | Открыть Prisma Studio |
| **Инфраструктура** | |
| `docker compose up -d` | Запуск PostgreSQL + MinIO + сервер |
| `npm run infra:observability` | Запуск стека наблюдаемости (Loki + Grafana + backup) |
| `npm run infra:backup` | Ручное резервное копирование БД |

---

## Ключевые компоненты

| Компонент | Файл | Ответственность |
|-----------|------|-----------------|
| **BookController** | `core/BookController.js` | Главный координатор, DI-контейнер |
| **BookControllerBuilder** | `core/BookControllerBuilder.js` | Конструирование графа зависимостей |
| **BookDIConfig** | `core/BookDIConfig.js` | Конфигурация DI для делегатов |
| **BookStateMachine** | `managers/BookStateMachine.js` | Валидация переходов состояний |
| **BookRenderer** | `core/BookRenderer.js` | DOM-рендеринг, double buffering |
| **BookAnimator** | `core/BookAnimator.js` | Оркестрация CSS 3D-анимаций |
| **AsyncPaginator** | `managers/AsyncPaginator.js` | Разбивка контента на страницы |
| **EventController** | `core/EventController.js` | Клики, свайпы, клавиатура |
| **SettingsBindings** | `core/SettingsBindings.js` | Привязки UI настроек (шрифт, тема, звук) |
| **NavigationDelegate** | `core/delegates/NavigationDelegate.js` | Логика навигации по страницам |
| **DelegateMediator** | `core/DelegateMediator.js` | Коммуникация между делегатами |
| **LandingScreen** | `core/LandingScreen.js` | Лендинг для гостей (витрина публичных книг, CTA) |
| **BookshelfScreen** | `core/BookshelfScreen.js` | Экран книжной полки (мультикнижность) |
| **AccountScreen** | `core/AccountScreen.js` | Личный кабинет (книги, профиль, настройки, экспорт) |
| **AccountScreenUI** | `core/AccountScreenUI.js` | Хелперы рендеринга UI кабинета |
| **AccountPublishTab** | `core/AccountPublishTab.js` | Вкладка публикации книг (видимость, описание) |
| **ProfileHeader** | `core/ProfileHeader.js` | Компонент профиля (аватар, имя, био) |
| **AuthModal** | `core/AuthModal.js` | Модалка логина/регистрации (email + Google OAuth) |
| **MigrationHelper** | `core/MigrationHelper.js` | Миграция данных localStorage → сервер |
| **DragDelegate** | `core/delegates/DragDelegate.js` | Touch-перетаскивание страниц |
| **DragAnimator** | `core/delegates/DragAnimator.js` | Анимация угла поворота при drag |
| **DragDOMPreparer** | `core/delegates/DragDOMPreparer.js` | Подготовка DOM для drag |
| **DragShadowRenderer** | `core/delegates/DragShadowRenderer.js` | Рендеринг теней при drag |
| **AudioController** | `core/delegates/AudioController.js` | Управление аудио и ambient |
| **FontController** | `core/delegates/FontController.js` | Управление шрифтами |
| **ThemeController** | `core/delegates/ThemeController.js` | Управление темами оформления |
| **CoreServices** | `core/services/CoreServices.js` | Группа: DOM, события, таймеры, storage |
| **AudioServices** | `core/services/AudioServices.js` | Группа: звуки и ambient |
| **RenderServices** | `core/services/RenderServices.js` | Группа: рендеринг и анимации |
| **ContentServices** | `core/services/ContentServices.js` | Группа: загрузка и пагинация |
| **Router** | `utils/Router.js` | SPA-роутер (History API: /, /book/:id, /account, /:username) |
| **ApiClient** | `utils/ApiClient.js` | HTTP API клиент (связь с сервером) |
| **i18n** | `i18n/index.js` | Интернационализация (initI18n, t, setLanguage, applyTranslations) |
| **PhotoLightbox** | `utils/PhotoLightbox.js` | Лайтбокс фотоальбома |
| **SwipeHint** | `utils/SwipeHint.js` | Подсказка жеста свайпа (мобильные) |
| **InstallPrompt** | `utils/InstallPrompt.js` | PWA-промпт установки приложения |
| **OfflineIndicator** | `utils/OfflineIndicator.js` | Индикатор офлайн-режима |
| **ScreenReaderAnnouncer** | `utils/ScreenReaderAnnouncer.js` | Анонсы для скринридеров (a11y) |
| **RateLimiter** | `utils/RateLimiter.js` | Ограничение частоты вызовов |
| **AdminConfigStore** | `admin/AdminConfigStore.js` | Персистентное хранилище конфига (localStorage/IndexedDB) |
| **ServerAdminConfigStore** | `admin/ServerAdminConfigStore.js` | Серверный конфиг (API-адаптер) |
| **AdminConfigDefaults** | `admin/AdminConfigDefaults.js` | Константы дефолтных значений конфига |
| **AdminConfigMigration** | `admin/AdminConfigMigration.js` | Валидация и нормализация схемы конфига |
| **AdminConfigStrip** | `admin/AdminConfigStrip.js` | Стриппинг data URL для localStorage |
| **BookParser** | `admin/BookParser.js` | Диспетчер парсинга книг |
| **ProfileModule** | `admin/modules/ProfileModule.js` | Управление профилем (username, био, аватар) |
| **PhotoCropper** | `admin/modules/PhotoCropper.js` | Интерактивный инструмент обрезки фото |
| **QuillEditorWrapper** | `admin/modules/QuillEditorWrapper.js` | Обёртка WYSIWYG-редактора Quill |
| **Analytics** | `utils/Analytics.js` | Web Vitals мониторинг производительности (LCP, FID, CLS) |
| **IdbStorage** | `utils/IdbStorage.js` | IndexedDB-обёртка для крупных данных |
| **SettingsValidator** | `utils/SettingsValidator.js` | Валидация и санитизация настроек |
| **ServerConfigOperations** | `admin/ServerConfigOperations.js` | Серверные CRUD-операции конфига |
| **bookshelfUtils** | `core/bookshelfUtils.js` | Утилиты книжной полки |
| **BookSelectorManager** | `admin/modules/BookSelectorManager.js` | Выбор книги |
| **CoverManager** | `admin/modules/CoverManager.js` | Управление обложкой книги |
| **ChapterFileHandler** | `admin/modules/ChapterFileHandler.js` | Загрузка файлов глав |

---

## Личный кабинет

Личный кабинет (экран `/account` в SPA) позволяет управлять содержимым, оформлением и профилем без изменения кода. Открывается кнопкой «Редактировать» из контекстного меню на книжной полке или через навигацию.

### Вкладка «Мои книги»

- **Управление книгами** — создание, выбор, удаление книг; экран выбора режима создания (загрузка файла или создание вручную)
- **Загрузка книг** — импорт из txt, doc, docx, epub, fb2
- **Управление главами** — добавление, редактирование, переупорядочивание глав; WYSIWYG-редактор (Quill) с поддержкой форматирования, таблиц и изображений; переключатель тем оформления (светлая/тёмная) прямо на вкладке «Страницы»
- **Шрифты** — выбор из встроенных или загрузка кастомных (woff2/ttf/otf)
- **Звуки** — настройка звуков перелистывания и обложки
- **Ambient-звуки** — добавление и настройка фоновых звуков
- **Оформление** — цвета обложки, текстуры страниц, фон приложения (отдельно для light/dark тем)
- **Фотоальбом** — управление галереей изображений

### Вкладка «Профиль»

- **Username** — уникальное имя пользователя (проверка доступности в реальном времени)
- **Отображаемое имя** — имя для публичного профиля
- **Био** — краткое описание (до 500 символов)
- **Аватар** — загрузка фото профиля
- **Предпросмотр** — как профиль выглядит на публичной полке

### Вкладка «Настройки»

- **Настройки видимости** — какие настройки показывать читателю (шрифт, размер, тема, звук, ambient)
- **Шрифты платформы** — управление доступными шрифтами для чтения

### Вкладка «Экспорт»

- **Экспорт конфигурации** — сохранение всего конфига в файл

Конфигурация сохраняется в localStorage (`flipbook-admin-config`), крупный контент (HTML глав) — в IndexedDB. При авторизации данные хранятся на сервере.

---

## Бэкенд (server/)

Серверная часть на Express + Prisma + PostgreSQL. Обеспечивает авторизацию, хранение данных пользователей и файлов.

### Стек технологий

- **Express 5** — HTTP-фреймворк
- **Prisma ORM** — работа с PostgreSQL
- **Passport.js** — авторизация (email/пароль + Google OAuth)
- **S3** — хранилище файлов (MinIO в dev, AWS S3 / совместимые в prod)
- **Zod** — валидация запросов
- **Vitest + supertest** — тестирование API
- **prom-client** — Prometheus-метрики

### Быстрый старт (full-stack)

```bash
# Запуск инфраструктуры (PostgreSQL + MinIO)
docker compose up -d

# Настройка сервера
cd server
npm install
npm run db:migrate     # Применить миграции
npm run db:seed        # Заполнить тестовыми данными
npm run dev            # Запуск с tsx watch (порт 4000)

# Фронтенд (в корне проекта) — проксирует /api → :4000
npm run dev            # Vite dev-сервер (порт 3000)
```

### Команды сервера

| Команда | Описание |
|---------|----------|
| `npm run dev` | Запуск dev-сервера (порт 4000, tsx watch) |
| `npm run build` | Сборка TypeScript |
| `npm run start` | Запуск production-сервера |
| `npm run db:migrate` | Применить Prisma миграции |
| `npm run db:seed` | Заполнить БД тестовыми данными |
| `npm run db:generate` | Генерация Prisma-клиента |
| `npm run db:studio` | Открыть Prisma Studio (GUI) |
| `npm run db:backup` | Резервное копирование БД |
| `npm run test` | Запуск тестов API (Vitest + supertest) |
| `npm run test:coverage` | Тесты с отчётом покрытия |
| `npm run lint` | ESLint на server src/ |

### API-маршруты

| Маршрут | Методы | Описание |
|---------|--------|----------|
| `/api/auth/*` | POST | Регистрация, логин, логаут, Google OAuth |
| `/api/books` | CRUD | Управление книгами |
| `/api/books/:id/chapters` | CRUD | Управление главами |
| `/api/books/:id/sounds` | PUT | Настройка звуков |
| `/api/books/:id/ambients` | CRUD | Ambient-звуки |
| `/api/books/:id/appearance` | PUT | Оформление тем |
| `/api/books/:id/decorative-font` | PUT/DELETE | Декоративный шрифт |
| `/api/books/:id/default-settings` | PUT | Настройки по умолчанию |
| `/api/fonts` | CRUD | Шрифты пользователя |
| `/api/settings` | GET/PUT | Глобальные настройки |
| `/api/progress` | GET/PUT | Прогресс чтения |
| `/api/upload` | POST | Загрузка файлов в S3 |
| `/api/profile` | GET/PUT | Профиль пользователя (username, имя, био, аватар) |
| `/api/profile/check-username/:name` | GET | Проверка доступности username |
| `/api/public/discover` | GET | Каталог опубликованных книг (пагинация) |
| `/api/public/shelves/:username` | GET | Публичная полка автора |
| `/api/public/books/:bookId` | GET | Публичная информация о книге |
| `/api/reading-sessions` | POST/GET | Трекинг сессий чтения и аналитика |
| `/api/metrics` | GET | Эндпоинт Prometheus-метрик |
| `/api/export`, `/api/import` | GET/POST | Экспорт/импорт конфигурации |

### CI/CD (GitHub Actions)

Проект использует четыре workflow для автоматизации:

**deploy.yml** — CI/CD фронтенда (при push в `main`):
1. **Lint** — ESLint + Stylelint
2. **Test** — Unit/integration тесты (Vitest)
3. **E2E** — Playwright тесты (Chromium)
4. **Build** — Production-сборка (после прохождения lint + test)
5. **Deploy** — Деплой на GitHub Pages

**server-tests.yml** — Тесты серверного API (при изменениях в `server/`):
- PostgreSQL 17 тестовый сервис
- Prisma миграции + Vitest + supertest

**lighthouse.yml** — Lighthouse CI аудит (при push/PR в `main`):
- Сборка проекта + 3 прогона Lighthouse
- Пороги качества: производительность ≥ 0.85, доступность ≥ 0.85, best-practices ≥ 0.85, SEO ≥ 0.85

**security.yml** — Сканирование безопасности (при push/PR в `main` + еженедельно):
- npm audit для фронтенда и сервера
- Trivy-сканирование Docker-образа с загрузкой SARIF в GitHub Security

### Наблюдаемость (Observability)

Стек наблюдаемости запускается отдельным docker-compose оверлеем:

```bash
npm run infra:observability
```

Включает:
- **Loki** — агрегация логов (порт 3200, ретенция 14 дней)
- **Prometheus** — сбор метрик с сервера `/api/metrics` (порт 9090)
- **Grafana** — дашборды, визуализация и алертинг (порт 3100, admin/admin)
- **pg-backup** — ежедневное резервное копирование PostgreSQL (3:00 UTC, ротация 7 дней)
- Интеграция `pino-loki` для отправки логов из сервера в Loki
- Серверные метрики через `prom-client` (длительность HTTP-запросов, активные соединения)
- Правила алертинга Grafana через `infra/grafana-alerting.yaml`

### Деплой

Проект поддерживает несколько вариантов деплоя:

- **Docker** — root-level `Dockerfile` собирает фронтенд + сервер в единый образ
- **Docker Compose + K6** — `docker-compose.k6.yml` оверлей для нагрузочного тестирования
- **Docker Compose + Observability** — `docker-compose.observability.yml` оверлей для мониторинга
- **Amvera Cloud** — конфигурация в `amvera.yml`
- **GitHub Pages** — только фронтенд (автоматически через GitHub Actions)

Подробная инструкция по деплою: [`DEPLOYMENT.md`](./DEPLOYMENT.md)

---

## Тестирование

### Стратегия тестирования

Проект использует пятиуровневую стратегию тестирования:

| Уровень | Инструмент | Назначение |
|---------|------------|------------|
| **Unit** | Vitest | Изолированное тестирование модулей |
| **Integration** | Vitest + jsdom | Тестирование взаимодействия компонентов |
| **E2E** | Playwright | Сквозное тестирование в реальных браузерах |
| **Server API** | Vitest + supertest | Тестирование бэкенд-эндпоинтов |
| **Load** | K6 | Нагрузочное и стресс-тестирование (smoke, load, stress, spike, soak) |

### E2E-тестирование (Playwright)

E2E-тесты запускаются в пяти окружениях:
- Desktop Chrome, Firefox, Safari
- Mobile Chrome (Pixel 5), Mobile Safari (iPhone 12)

```bash
# Запуск всех E2E-тестов
npm run test:e2e

# С UI-интерфейсом Playwright
npm run test:e2e:ui

# С видимым браузером
npm run test:e2e:headed

# Отладка
npm run test:e2e:debug
```

### Page Object паттерн

E2E-тесты используют Page Object модели для абстракции взаимодействия с UI:
- `BookPage` — основная страница книги
- `SettingsPanel` — панель настроек

---

## Технические особенности

### Производительность
- **LRU-кэш** для распарсенных страниц (лимит: 50 страниц)
- **Double buffering** для плавных переходов
- **GPU-ускоренные** CSS 3D-трансформации
- **Debounce** обработки resize

### PWA (Progressive Web App)
- **Service Worker** с автообновлением (Workbox)
- **Офлайн-доступ** — предкэширование JS, CSS, HTML, шрифтов
- **Runtime-кэширование** изображений (30 дней, до 60 записей) и аудио (30 дней, до 15 записей)
- **Установка** как нативное приложение на десктопе и мобильных устройствах
- **Иконки** — SVG, PNG 192px, PNG 512px, maskable 512px

### Качество кода
- Чистая архитектура с разделением ответственности
- Автоматическая очистка event listeners и таймеров
- Централизованная обработка ошибок
- JSDoc-документация

### Безопасность
- XSS-защита через `HTMLSanitizer` (на базе DOMPurify — защита от mXSS, namespace pollution)
- Валидация настроек через `SettingsValidator` перед применением к DOM
- Загрузка контента только с того же origin
- Серверная сторона: Helmet, CSRF-защита, rate limiting
- Авторизация: bcrypt для паролей, secure session cookies
- Валидация входных данных: Zod-схемы на всех API-эндпоинтах
- Загрузка файлов: ограничения типа/размера, хранение в S3

### Content Security Policy (CSP)

Рекомендуемые HTTP-заголовки безопасности для production-деплоя:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: blob:;
  font-src 'self' https://fonts.gstatic.com data:;
  media-src 'self' data:;
  connect-src 'self';
  object-src 'none';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'none'
```

| Директива | Значение | Причина |
|-----------|----------|---------|
| `script-src 'self'` | Только свои скрипты | ES Modules, нет inline-скриптов |
| `style-src 'self' 'unsafe-inline' fonts.googleapis.com` | Свои + inline + Google Fonts CSS | CSS custom properties в JS + системные шрифты |
| `img-src 'self' data: blob:` | Свои + data URI + blob | WebP фоны + base64 + blob-объекты |
| `font-src 'self' fonts.gstatic.com data:` | Свои + Google Fonts файлы + data URI | Системные и кастомные шрифты |
| `media-src 'self' data:` | Свои + data URI | MP3 звуки страниц и ambient |
| `object-src 'none'` | Запрет плагинов | Защита от Flash/Java |
| `frame-ancestors 'none'` | Запрет iframe | Защита от clickjacking |

#### Настройка для хостингов

<details>
<summary><b>Netlify</b> (_headers файл)</summary>

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' https://fonts.gstatic.com data:; media-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
```

</details>

<details>
<summary><b>Vercel</b> (vercel.json)</summary>

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' https://fonts.gstatic.com data:; media-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'"
        },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

</details>

<details>
<summary><b>Nginx</b></summary>

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' https://fonts.gstatic.com data:; media-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

</details>

---

## Зависимости

### Frontend Runtime
- **dompurify** `^3.3.2` — XSS-защита (движок санитизации HTML)
- **jszip** `^3.10.1` — ZIP-операции (экспорт конфига, парсинг docx/epub)
- **quill** `^2.0.3` — WYSIWYG-редактор (редактирование глав в личном кабинете)
- **i18next** `^25.8.13` — Интернационализация (5 языков)
- **@sentry/browser** `^10.40.0` — Мониторинг ошибок (клиент)
- **web-vitals** `^5.1.0` — Мониторинг Core Web Vitals (LCP, FID, CLS)

### Frontend Dev Dependencies (ключевые)
- **vite** `^7.3.1` — Бандлер
- **vitest** `^4.0.18` — Юнит/интеграционное тестирование
- **@playwright/test** `^1.58.1` — E2E-тестирование
- **eslint** `^9.39.2` — Линтинг JS
- **stylelint** `^17.1.1` — Линтинг CSS
- **sharp** `^0.34.5` — Обработка изображений (генерация иконок)
- **vite-plugin-pwa** `^1.2.0` — PWA/Service Worker
- **husky** `^9.1.7` — Git-хуки (pre-commit линтинг)
- **lint-staged** `^16.3.1` — Запуск линтеров для staged файлов

### Backend Runtime (server/)
- **express** `^5.0.1` — HTTP-фреймворк
- **@prisma/client** `^6.0.0` — ORM для PostgreSQL
- **passport** `^0.7.0` — Авторизация (email/пароль + Google OAuth)
- **@aws-sdk/client-s3** `^3.700.0` — S3-хранилище (MinIO в dev)
- **zod** `^3.23.0` — Валидация запросов/ответов
- **helmet** `^8.0.0` — Заголовки безопасности
- **pino** `^9.0.0` — Структурированное логирование
- **pino-loki** `^2.6.0` — Отправка логов в Grafana Loki
- **bcrypt** `^5.1.0` — Хеширование паролей
- **csrf-csrf** `^4.0.3` — CSRF-защита
- **express-rate-limit** `^7.0.0` — Ограничение запросов
- **@sentry/node** `^9.47.1` — Мониторинг ошибок
- **prom-client** `^15.1.3` — Сбор Prometheus-метрик

---

## Управление

| Клавиша | Действие |
|---------|----------|
| `←` / `→` | Предыдущая / следующая страница |
| `Home` | В начало книги |
| `End` | В конец книги |
| `Ctrl+D` | Панель отладки (dev) |

---

## Требования

- Node.js >= 18.0.0
- npm >= 9.0.0
- Современный браузер (ES Modules, CSS 3D Transforms)
- PostgreSQL 17+ (через Docker или локально) — для бэкенда
- Docker & Docker Compose — для full-stack разработки
- Для E2E-тестов: Playwright (устанавливается автоматически)

---

## Лицензия

MIT © [Ekaterina Yashina](https://github.com/eka-jashina)
