/**
 * API CLIENT
 *
 * Barrel-файл: собирает BaseApiClient + ресурсные миксины в единый класс ApiClient.
 * Все импорты извне продолжают работать без изменений:
 *   import { ApiClient } from './utils/ApiClient.js'
 *
 * Внутренняя структура:
 *   api/BaseApiClient.js — fetch, CSRF, retry, error handling
 *   api/AuthApi.js       — getMe, register, login, logout
 *   api/BooksApi.js      — CRUD книг
 *   api/ChaptersApi.js   — CRUD глав
 *   api/AppearanceApi.js — внешний вид
 *   api/SoundsApi.js     — звуки
 *   api/AmbientsApi.js   — эмбиенты
 *   api/FontsApi.js      — декоративные + шрифты для чтения
 *   api/SettingsApi.js   — настройки
 *   api/ProgressApi.js   — прогресс чтения
 *   api/UploadApi.js     — загрузка файлов
 *   api/ExportApi.js     — экспорт/импорт + health
 *   api/PublicApi.js     — публичное API
 *   api/ProfileApi.js    — профиль пользователя
 */

import { BaseApiClient } from './api/BaseApiClient.js';
import { AuthApi } from './api/AuthApi.js';
import { BooksApi } from './api/BooksApi.js';
import { ChaptersApi } from './api/ChaptersApi.js';
import { AppearanceApi } from './api/AppearanceApi.js';
import { SoundsApi } from './api/SoundsApi.js';
import { AmbientsApi } from './api/AmbientsApi.js';
import { FontsApi } from './api/FontsApi.js';
import { SettingsApi } from './api/SettingsApi.js';
import { ProgressApi } from './api/ProgressApi.js';
import { UploadApi } from './api/UploadApi.js';
import { ExportApi } from './api/ExportApi.js';
import { PublicApi } from './api/PublicApi.js';
import { ProfileApi } from './api/ProfileApi.js';

// Подмешиваем все ресурсные методы в прототип BaseApiClient
Object.assign(
  BaseApiClient.prototype,
  AuthApi,
  BooksApi,
  ChaptersApi,
  AppearanceApi,
  SoundsApi,
  AmbientsApi,
  FontsApi,
  SettingsApi,
  ProgressApi,
  UploadApi,
  ExportApi,
  PublicApi,
  ProfileApi,
);

export { BaseApiClient as ApiClient };
export { ApiError } from './api/ApiError.js';
